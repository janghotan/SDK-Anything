import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import {
  fetchDeclaredDependencies,
  resolveDependencyVersion,
} from "../../src/source/dependency-fetcher.js";

function createTarGz(
  entries: Array<{ name: string; content: string }>,
): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100, "utf8");
    header.write("0000644\0", 100, 8, "utf8");
    header.write("0000000\0", 108, 8, "utf8");
    header.write("0000000\0", 116, 8, "utf8");
    const contentBuf = Buffer.from(entry.content, "utf8");
    const sizeOctal = contentBuf.length.toString(8).padStart(11, "0") + "\0";
    header.write(sizeOctal, 124, 12, "utf8");
    header.write("00000000000\0", 136, 12, "utf8");
    header.write("0", 156, 1, "utf8");
    header.write("ustar\0", 257, 6, "utf8");
    header.write("00", 263, 2, "utf8");
    header.write("        ", 148, 8, "utf8");
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += header[i];
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf8");
    blocks.push(header, contentBuf);
    const remainder = contentBuf.length % 512;
    if (remainder !== 0) blocks.push(Buffer.alloc(512 - remainder));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

interface RegistryPackage {
  name: string;
  versions: Record<
    string,
    {
      tarballPath: string;
      packageJson: Record<string, unknown>;
      extraFiles?: Array<{ name: string; content: string }>;
    }
  >;
  distTags?: Record<string, string>;
}

function createRegistry(packages: RegistryPackage[]) {
  const tarballs = new Map<string, Buffer>();
  const metadata = new Map<string, unknown>();

  for (const pkg of packages) {
    metadata.set(pkg.name, {
      name: pkg.name,
      "dist-tags": pkg.distTags ?? { latest: Object.keys(pkg.versions).at(-1) },
      versions: Object.fromEntries(
        Object.entries(pkg.versions).map(([version, data]) => [
          version,
          {
            name: pkg.name,
            version,
            dist: { tarball: `https://registry.test/${data.tarballPath}` },
          },
        ]),
      ),
    });
    for (const [version, data] of Object.entries(pkg.versions)) {
      tarballs.set(
        `https://registry.test/${data.tarballPath}`,
        createTarGz([
          {
            name: "package/package.json",
            content: JSON.stringify({
              name: pkg.name,
              version,
              ...data.packageJson,
            }),
          },
          ...(data.extraFiles ?? []),
        ]),
      );
    }
  }

  const requests: string[] = [];
  const fetchFn = async (url: string | URL | Request) => {
    const urlStr = url.toString();
    requests.push(urlStr);
    if (tarballs.has(urlStr)) {
      const buffer = tarballs.get(urlStr)!;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ),
      } as unknown as Response;
    }
    const encodedName = urlStr.replace("https://registry.npmjs.org/", "");
    const name = decodeURIComponent(
      encodedName.startsWith("@") ? "@" + encodedName.slice(1) : encodedName,
    );
    const meta = metadata.get(name);
    if (meta) {
      return { ok: true, status: 200, json: async () => meta } as Response;
    }
    return { ok: false, status: 404 } as Response;
  };

  return { fetchFn: fetchFn as unknown as typeof fetch, requests };
}

function makeSnapshot(pkg: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-dep-test-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "root-sdk", version: "1.0.0", ...pkg }),
  );
  return dir;
}

describe("Dependency version resolution", () => {
  const metadata = {
    "dist-tags": { latest: "3.0.0", beta: "3.1.0-beta.1" },
    versions: {
      "1.0.0": {},
      "2.0.0": {},
      "2.5.3": {},
      "3.0.0": {},
      "3.1.0-beta.1": {},
    },
  };

  it("resolves dist-tags and exact versions", () => {
    expect(resolveDependencyVersion("latest", metadata)).toBe("3.0.0");
    expect(resolveDependencyVersion("beta", metadata)).toBe("3.1.0-beta.1");
    expect(resolveDependencyVersion("2.0.0", metadata)).toBe("2.0.0");
  });

  it("resolves semver ranges without selecting prereleases", () => {
    expect(resolveDependencyVersion("^2.0.0", metadata)).toBe("2.5.3");
    expect(resolveDependencyVersion("~2.0.0", metadata)).toBe("2.0.0");
    expect(resolveDependencyVersion(">=2.0.0 <3.0.0", metadata)).toBe("2.5.3");
    expect(resolveDependencyVersion("*", metadata)).toBe("3.0.0");
  });

  it("returns undefined for unresolvable or non-registry specs", () => {
    expect(resolveDependencyVersion("^9.0.0", metadata)).toBeUndefined();
    expect(resolveDependencyVersion("workspace:*", metadata)).toBeUndefined();
    expect(resolveDependencyVersion("file:../local", metadata)).toBeUndefined();
    expect(
      resolveDependencyVersion("^1.0.0", { versions: {} }),
    ).toBeUndefined();
  });
});

describe("npm declared dependency retrieval", () => {
  it("materialises transitive dependencies and exposes re-exported declarations", async () => {
    const { fetchFn, requests } = createRegistry([
      {
        name: "@aggregate/sdk",
        versions: {
          "2.0.0": {
            tarballPath: "@aggregate/sdk/-/sdk-2.0.0.tgz",
            packageJson: {
              dependencies: { "leaf-pkg": "^1.2.0" },
              scripts: { postinstall: "node should-not-run.js" },
            },
            extraFiles: [
              {
                name: "package/dist/index.d.ts",
                content:
                  'export { compute } from "leaf-pkg";\nexport declare function local(value: string): string;',
              },
              {
                name: "package/should-not-run.js",
                content:
                  'require("node:fs").writeFileSync("EXECUTED_MARKER", "x");',
              },
            ],
          },
        },
      },
      {
        name: "leaf-pkg",
        versions: {
          "1.2.0": {
            tarballPath: "leaf-pkg/-/leaf-pkg-1.2.0.tgz",
            packageJson: {},
            extraFiles: [
              {
                name: "package/dist/index.d.ts",
                content: "export declare function compute(a: number): number;",
              },
            ],
          },
          "1.3.0": {
            tarballPath: "leaf-pkg/-/leaf-pkg-1.3.0.tgz",
            packageJson: {},
            extraFiles: [
              {
                name: "package/dist/index.d.ts",
                content: "export declare function compute(a: number): number;",
              },
            ],
          },
        },
      },
    ]);

    const snapshotDir = makeSnapshot({
      dependencies: { "@aggregate/sdk": "^2.0.0" },
    });

    const report = await fetchDeclaredDependencies(snapshotDir, { fetchFn });

    expect(report.failed).toEqual([]);
    expect(report.installed).toEqual(
      expect.arrayContaining(["@aggregate/sdk@2.0.0", "leaf-pkg@1.3.0"]),
    );
    expect(
      fs.existsSync(
        path.join(snapshotDir, "node_modules/@aggregate/sdk/dist/index.d.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(snapshotDir, "node_modules/leaf-pkg/dist/index.d.ts"),
      ),
    ).toBe(true);
    // Lifecycle scripts are never executed.
    expect(
      fs.existsSync(
        path.join(snapshotDir, "node_modules/@aggregate/sdk/EXECUTED_MARKER"),
      ),
    ).toBe(false);
    expect(fs.existsSync(path.join(snapshotDir, "EXECUTED_MARKER"))).toBe(
      false,
    );
    // Re-exported dependency declarations are resolvable from the snapshot.
    expect(
      fs.readFileSync(
        path.join(snapshotDir, "node_modules/@aggregate/sdk/dist/index.d.ts"),
        "utf8",
      ),
    ).toContain('from "leaf-pkg"');
    expect(
      requests.every(
        (url) =>
          url.startsWith("https://registry.npmjs.org/") ||
          url.startsWith("https://registry.test/"),
      ),
    ).toBe(true);

    fs.rmSync(snapshotDir, { recursive: true, force: true });
  });

  it("is non-fatal and reports warnings when the registry cannot resolve a dependency", async () => {
    const { fetchFn } = createRegistry([]);
    const snapshotDir = makeSnapshot({
      dependencies: { "missing-pkg": "^1.0.0" },
    });

    const report = await fetchDeclaredDependencies(snapshotDir, { fetchFn });

    expect(report.installed).toEqual([]);
    expect(report.failed).toEqual(["missing-pkg@^1.0.0"]);
    expect(report.warnings.join("\n")).toMatch(/registry metadata/i);
    expect(fs.existsSync(snapshotDir)).toBe(true);

    fs.rmSync(snapshotDir, { recursive: true, force: true });
  });

  it("skips dependencies already present in the snapshot", async () => {
    const { fetchFn, requests } = createRegistry([]);
    const snapshotDir = makeSnapshot({
      dependencies: { "present-pkg": "^1.0.0" },
    });
    fs.mkdirSync(path.join(snapshotDir, "node_modules/present-pkg"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(snapshotDir, "node_modules/present-pkg/package.json"),
      JSON.stringify({ name: "present-pkg", version: "1.0.0" }),
    );

    const report = await fetchDeclaredDependencies(snapshotDir, { fetchFn });

    expect(report.skipped).toEqual(["present-pkg (already present)"]);
    expect(requests).toEqual([]);

    fs.rmSync(snapshotDir, { recursive: true, force: true });
  });
});
