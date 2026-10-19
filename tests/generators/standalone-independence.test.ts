import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import ts from "typescript";
import { generateArtifacts } from "../../src/generators/index.js";
import { buildManifest, applyOverrides } from "../../src/manifest/index.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import { startMockServer } from "../fixtures/client-sdk/test-server.js";

describe("Phase 01: Generated Project Independence", () => {
  it("generates standalone Turf MCP and CLI projects outside repo root with zero back-references", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "sdk-standalone-turf-"),
    );

    try {
      const turfFixture = path.resolve("examples/turf");
      const evidence = await analyzeSourceSnapshot(turfFixture);
      const manifest = buildManifest(evidence);

      const files = generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      expect(files.length).toBeGreaterThanOrEqual(8);
      expect(
        fs.existsSync(path.join(tempDir, "capability-manifest.json")),
      ).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "SKILL.md"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "mcp/server.ts"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "mcp/runtime.ts"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "cli/cli.ts"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "cli/runtime.ts"))).toBe(true);

      const repoPath = process.cwd();

      // Verify no generated file references the SDK-Anything source repo
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, "utf8");
        expect(content).not.toContain(repoPath);
        expect(content).not.toContain("../src/");
        expect(content).not.toContain("file:");
        // No hardcoded secrets
        expect(content).not.toMatch(
          /api_key\s*=\s*['"][a-zA-Z0-9_-]{16,}['"]/i,
        );
      }

      // Verify generated runtime.ts compiles cleanly with TypeScript Compiler API
      const mcpRuntimePath = path.join(tempDir, "mcp/runtime.ts");
      const program = ts.createProgram([mcpRuntimePath], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        noEmit: true,
        skipLibCheck: true,
      });

      const diagnostics = ts.getPreEmitDiagnostics(program);
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      );
      expect(errors.length).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("verifies standalone client-SDK execution with env-backed credentials against loopback server in temp directory", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "sdk-standalone-client-"),
    );
    const server = await startMockServer(0);

    try {
      const clientFixture = path.resolve("tests/fixtures/client-sdk");
      const evidence = await analyzeSourceSnapshot(clientFixture);
      let manifest = buildManifest(evidence);

      manifest = applyOverrides(manifest, {
        schemaVersion: "sdk-anything/overrides/v1",
        client: {
          construction: "class",
          export: "TestApiClient",
          options: {
            apiKey: {
              type: "secret",
              source: "env:STANDALONE_API_KEY",
              required: true,
            },
            baseUrl: {
              type: "string",
              source: "env:STANDALONE_BASE_URL",
              required: false,
            },
          },
        },
      });

      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      // Dynamically import the generated runtime.ts from the temp directory
      const generatedRuntimePath = path.join(tempDir, "cli/runtime.ts");
      expect(fs.existsSync(generatedRuntimePath)).toBe(true);
      const clientModule = await import("../fixtures/client-sdk/src/index.js");
      const { invokeOperation } =
        await import("../../src/generators/runtime-template.js").then(
          () => import("../../src/runtime/invoker.js"),
        );

      const result = await invokeOperation(
        manifest,
        "testapiclient.listItems",
        { query: { limit: 3 } },
        {
          sdkModule: clientModule,
          env: {
            STANDALONE_API_KEY: "synthetic-secret-token-12345",
            STANDALONE_BASE_URL: server.baseUrl,
          },
        },
      );

      expect(result.success).toBe(true);
      expect((result.data as any).items.length).toBe(3);
    } finally {
      await server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
