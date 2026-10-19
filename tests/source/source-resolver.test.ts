import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as zlib from "node:zlib";
import {
  parseSourceLocator,
  resolveSource,
  extractTarballSafely,
  computeTreeDigest,
} from "../../src/source/index.js";

describe("Source Locator Parser", () => {
  it("parses valid npm package locators", () => {
    expect(parseSourceLocator("npm:@turf/turf")).toEqual({
      kind: "npm",
      packageName: "@turf/turf",
    });
    expect(parseSourceLocator("npm:lodash@4.17.21")).toEqual({
      kind: "npm",
      packageName: "lodash",
      versionOrTag: "4.17.21",
    });
  });

  it("parses valid local directory locators", () => {
    expect(parseSourceLocator("./tests/fixtures/sample-local-sdk")).toEqual({
      kind: "local",
      localPath: "./tests/fixtures/sample-local-sdk",
    });
    expect(parseSourceLocator("/tmp/my-sdk")).toEqual({
      kind: "local",
      localPath: "/tmp/my-sdk",
    });
  });

  it("parses valid public GitHub locators", () => {
    expect(parseSourceLocator("https://github.com/Turfjs/turf")).toEqual({
      kind: "github",
      owner: "Turfjs",
      repo: "turf",
    });
    expect(
      parseSourceLocator("https://github.com/org/project/tree/v2.1.0"),
    ).toEqual({
      kind: "github",
      owner: "org",
      repo: "project",
      ref: "v2.1.0",
    });
  });

  it("rejects unsupported protocols and non-GitHub URLs", () => {
    expect(() => parseSourceLocator("ftp://example.com/repo")).toThrow(
      /unsupported protocol/i,
    );
    expect(() => parseSourceLocator("http://github.com/org/repo")).toThrow(
      /only https is supported/i,
    );
    expect(() => parseSourceLocator("https://gitlab.com/org/repo")).toThrow(
      /only public github\.com repositories are supported/i,
    );
    expect(() => parseSourceLocator("npm:")).toThrow(/missing package name/i);
  });
});

describe("Local Directory Resolver", () => {
  it("normalizes local directory into a digested source snapshot", async () => {
    const fixturePath = path.resolve("tests/fixtures/sample-local-sdk");
    const snapshot = await resolveSource(fixturePath);

    expect(snapshot.kind).toBe("local");
    expect(snapshot.identifier).toBe(fixturePath);
    expect(snapshot.version).toBe("1.0.0");
    expect(snapshot.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(fs.existsSync(snapshot.snapshotPath)).toBe(true);
    expect(
      fs.existsSync(path.join(snapshot.snapshotPath, "package.json")),
    ).toBe(true);
  });

  it("fails with clear error when directory does not exist", async () => {
    await expect(resolveSource("./nonexistent-directory-xyz")).rejects.toThrow(
      /does not exist/i,
    );
  });
});

describe("Safe Archive Extractor & Path Traversal Prevention", () => {
  // Helper to create a minimal in-memory tarball
  function createTarGz(
    entries: Array<{
      name: string;
      content: string;
      type?: string;
      linkname?: string;
    }>,
  ): Buffer {
    const blocks: Buffer[] = [];

    for (const entry of entries) {
      const header = Buffer.alloc(512);
      // Name
      header.write(entry.name, 0, 100, "utf8");
      // Mode
      header.write("0000644\0", 100, 8, "utf8");
      // UID / GID
      header.write("0000000\0", 108, 8, "utf8");
      header.write("0000000\0", 116, 8, "utf8");
      // Size in octal
      const contentBuf = Buffer.from(entry.content, "utf8");
      const sizeOctal = contentBuf.length.toString(8).padStart(11, "0") + "\0";
      header.write(sizeOctal, 124, 12, "utf8");
      // Mtime
      header.write("00000000000\0", 136, 12, "utf8");
      // Type flag ('0' for normal file, '2' for symlink)
      header.write(entry.type ?? "0", 156, 1, "utf8");
      // Linkname
      if (entry.linkname) {
        header.write(entry.linkname, 157, 100, "utf8");
      }
      // Magic ustar
      header.write("ustar\0", 257, 6, "utf8");
      header.write("00", 263, 2, "utf8");

      // Checksum
      header.write("        ", 148, 8, "utf8"); // 8 spaces
      let sum = 0;
      for (let i = 0; i < 512; i++) {
        sum += header[i];
      }
      const sumOctal = sum.toString(8).padStart(6, "0") + "\0 ";
      header.write(sumOctal, 148, 8, "utf8");

      blocks.push(header);
      blocks.push(contentBuf);
      const remainder = contentBuf.length % 512;
      if (remainder !== 0) {
        blocks.push(Buffer.alloc(512 - remainder));
      }
    }

    // Two 512-byte zero blocks at the end of tar
    blocks.push(Buffer.alloc(1024));
    return zlib.gzipSync(Buffer.concat(blocks));
  }

  it("extracts normal safe tarballs without error", async () => {
    const tarGz = createTarGz([
      {
        name: "package/package.json",
        content: '{"name":"test","version":"1.0.0"}',
      },
      { name: "package/src/index.js", content: 'console.log("hello");' },
    ]);
    const outDir = path.resolve("tmp/test-extract-safe");
    fs.rmSync(outDir, { recursive: true, force: true });

    await extractTarballSafely(tarGz, outDir);
    expect(fs.existsSync(path.join(outDir, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "src/index.js"))).toBe(true);
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("rejects path traversal attacks with ../ in filename", async () => {
    const maliciousTarGz = createTarGz([
      { name: "package/../../etc/passwd", content: "malicious payload" },
    ]);
    const outDir = path.resolve("tmp/test-extract-traversal");
    fs.rmSync(outDir, { recursive: true, force: true });

    await expect(extractTarballSafely(maliciousTarGz, outDir)).rejects.toThrow(
      /path traversal/i,
    );
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("rejects symlinks targeting paths outside destination", async () => {
    const symlinkTarGz = createTarGz([
      {
        name: "package/escape-symlink",
        content: "",
        type: "2",
        linkname: "../../etc/passwd",
      },
    ]);
    const outDir = path.resolve("tmp/test-extract-symlink");
    fs.rmSync(outDir, { recursive: true, force: true });

    await expect(extractTarballSafely(symlinkTarGz, outDir)).rejects.toThrow(
      /symlink/i,
    );
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("computes stable tree digest for a directory", () => {
    const fixturePath = path.resolve("tests/fixtures/sample-local-sdk");
    const digest1 = computeTreeDigest(fixturePath);
    const digest2 = computeTreeDigest(fixturePath);
    expect(digest1).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(digest1).toBe(digest2);
  });
});

describe("npm Package Resolver", () => {
  it("resolves npm package metadata and downloads archive without executing scripts", async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("registry.npmjs.org/@sample%2Fdummy")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            name: "@sample/dummy",
            "dist-tags": { latest: "2.0.0" },
            versions: {
              "2.0.0": {
                name: "@sample/dummy",
                version: "2.0.0",
                dist: {
                  tarball:
                    "https://registry.npmjs.org/@sample/dummy/-/dummy-2.0.0.tgz",
                  shasum: "abc",
                },
              },
            },
          }),
        } as Response;
      }
      if (urlStr.includes("dummy-2.0.0.tgz")) {
        // Return valid tarball
        const tarGz = zlib.gzipSync(Buffer.alloc(1024));
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => tarGz,
        } as unknown as Response;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as Response;
    };

    // Test with mock
    const snapshot = await resolveSource("npm:@sample/dummy", {
      fetchFn: mockFetch as any,
    });
    expect(snapshot.kind).toBe("npm");
    expect(snapshot.version).toBe("2.0.0");
    expect(snapshot.identifier).toBe("npm:@sample/dummy");
    expect(snapshot.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("fails with clear error when npm package does not exist", async () => {
    const mockFetch = async () =>
      ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }) as Response;

    await expect(
      resolveSource("npm:@nonexistent/pkg-xyz", { fetchFn: mockFetch as any }),
    ).rejects.toThrow(/package not found/i);
  });
});

describe("GitHub Repository Resolver", () => {
  it("resolves public GitHub repository snapshot", async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("tarball")) {
        const tarGz = zlib.gzipSync(Buffer.alloc(1024));
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => tarGz,
        } as unknown as Response;
      }
      if (urlStr.includes("api.github.com/repos/sample-org/sample-repo")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ default_branch: "main" }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    };

    const snapshot = await resolveSource(
      "https://github.com/sample-org/sample-repo",
      { fetchFn: mockFetch as any },
    );
    expect(snapshot.kind).toBe("github");
    expect(snapshot.identifier).toBe(
      "https://github.com/sample-org/sample-repo",
    );
    expect(snapshot.version).toBe("main");
  });
});
