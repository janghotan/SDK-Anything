import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { CapabilityManifest } from "../../src/manifest/types.js";
import { generateArtifacts } from "../../src/generators/index.js";

const manifest: CapabilityManifest = {
  schemaVersion: "sdk-anything/manifest/v1",
  generatorVersion: "0.1.0",
  source: {
    kind: "local",
    package: "@example/vendored-sdk",
    version: "1.2.3",
    digest:
      "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  },
  operations: [
    {
      id: "greet",
      name: "greet",
      summary: "Greet someone",
      description: "Return a greeting",
      invoke: { kind: "top-level-function", functionName: "greet" },
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      effect: "pure",
      enabledByDefault: true,
      result: { mode: "direct" },
      provenance: { sourceFile: "index.ts", confidence: "high" },
    },
  ],
  unresolved: [],
};

describe("Standalone vendored SDK packaging", () => {
  it("copies the SDK and points adapter dependencies at the project-root vendor directory", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-vendor-test-"));
    try {
      const sdkDir = path.join(workDir, "built-sdk");
      fs.mkdirSync(path.join(sdkDir, "dist"), { recursive: true });
      fs.writeFileSync(
        path.join(sdkDir, "package.json"),
        JSON.stringify({
          name: "@example/vendored-sdk",
          version: "1.2.3",
          main: "./dist/index.js",
        }),
      );
      fs.writeFileSync(
        path.join(sdkDir, "dist/index.js"),
        "export function greet(name) { return `hi ${name}`; }\n",
      );

      const outputDir = path.join(workDir, "generated");
      generateArtifacts(manifest, ["cli", "mcp"], outputDir, {
        vendorSdkPath: sdkDir,
      });

      const vendorDir = path.join(outputDir, "vendor/-example-vendored-sdk");
      expect(fs.existsSync(path.join(vendorDir, "dist/index.js"))).toBe(true);

      for (const adapter of ["cli", "mcp"]) {
        const pkg = JSON.parse(
          fs.readFileSync(
            path.join(outputDir, adapter, "package.json"),
            "utf8",
          ),
        );
        expect(pkg.dependencies["@example/vendored-sdk"]).toBe(
          "file:../vendor/-example-vendored-sdk",
        );
        expect(pkg.scripts.build).toContain("capability-manifest.json");
        expect(pkg.scripts.build).toContain("dist/capability-manifest.json");
      }

      const cliSource = fs.readFileSync(
        path.join(outputDir, "cli/cli.ts"),
        "utf8",
      );
      const mcpSource = fs.readFileSync(
        path.join(outputDir, "mcp/server.ts"),
        "utf8",
      );
      // Node 20-safe manifest loading: no JSON import attributes.
      expect(cliSource).not.toContain("with { type: 'json' }");
      expect(mcpSource).not.toContain("with { type: 'json' }");
      expect(cliSource).toContain("loadManifest()");
      expect(mcpSource).toContain("loadManifest()");
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("rejects a vendored SDK whose package name does not match the manifest", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-vendor-test-"));
    try {
      const sdkDir = path.join(workDir, "built-sdk");
      fs.mkdirSync(sdkDir, { recursive: true });
      fs.writeFileSync(
        path.join(sdkDir, "package.json"),
        JSON.stringify({ name: "@other/package", version: "1.2.3" }),
      );

      const outputDir = path.join(workDir, "generated");
      expect(() =>
        generateArtifacts(manifest, ["cli"], outputDir, {
          vendorSdkPath: sdkDir,
        }),
      ).toThrow(/does not match manifest source package/);

      fs.rmSync(path.join(sdkDir, "package.json"));
      expect(() =>
        generateArtifacts(manifest, ["cli"], outputDir, {
          vendorSdkPath: sdkDir,
        }),
      ).toThrow(/missing package\.json/);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("honours an explicit SDK dependency specifier over the vendored default", () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-vendor-test-"));
    try {
      const sdkDir = path.join(workDir, "built-sdk");
      fs.mkdirSync(sdkDir, { recursive: true });
      fs.writeFileSync(
        path.join(sdkDir, "package.json"),
        JSON.stringify({ name: "@example/vendored-sdk", version: "1.2.3" }),
      );

      const outputDir = path.join(workDir, "generated");
      generateArtifacts(manifest, ["cli"], outputDir, {
        vendorSdkPath: sdkDir,
        sdkDependencySpec: "file:./custom-sdk",
      });

      const pkg = JSON.parse(
        fs.readFileSync(path.join(outputDir, "cli/package.json"), "utf8"),
      );
      expect(pkg.dependencies["@example/vendored-sdk"]).toBe(
        "file:./custom-sdk",
      );
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });
});
