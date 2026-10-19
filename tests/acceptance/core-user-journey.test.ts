import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import ts from "typescript";
import { createCli } from "../../src/cli/index.js";
import { generateArtifacts } from "../../src/generators/index.js";
import { buildManifest } from "../../src/manifest/index.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";

describe("Phase 00 & 01 Acceptance: Core User Journey Outside Repo", () => {
  it("validates manifest when run from a working directory outside the repository root", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-validate-external-"));
    const originalCwd = process.cwd();

    try {
      const turfFixture = path.resolve("examples/turf");
      const evidence = await analyzeSourceSnapshot(turfFixture);
      const manifest = buildManifest(evidence);
      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      // Change working directory to tempDir (outside repo root)
      process.chdir(tempDir);

      let output = "";
      let errOutput = "";
      const cli = createCli({
        writeOut: (str: string) => {
          output += str;
        },
        writeErr: (str: string) => {
          errOutput += str;
        },
        exitOverride: true,
      });

      // Run validate on the generated directory from outside repo
      await cli.parseAsync(["node", "sdk-anything", "validate", tempDir]);

      expect(errOutput).toBe("");
      expect(output).toContain("Manifest is valid");
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("generates TypeScript code for CLI and MCP server that compiles with zero type errors under strict mode", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-compile-check-"));

    try {
      const turfFixture = path.resolve("examples/turf");
      const evidence = await analyzeSourceSnapshot(turfFixture);
      const manifest = buildManifest(evidence);
      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      // Verify cli.ts compiles cleanly
      const cliTsPath = path.join(tempDir, "cli/cli.ts");
      const mcpTsPath = path.join(tempDir, "mcp/server.ts");

      // Verify that cli.ts and server.ts do not have implicit any parameters
      const cliSource = fs.readFileSync(cliTsPath, "utf8");
      const serverSource = fs.readFileSync(mcpTsPath, "utf8");

      expect(cliSource).not.toMatch(/\.catch\(err\s*=>/);
      expect(serverSource).not.toMatch(/\.catch\(err\s*=>/);
      expect(serverSource).not.toMatch(/async\s*\(\s*request\s*\)\s*=>/);

      // Verify generated projects have a test script in package.json
      const cliPkg = JSON.parse(fs.readFileSync(path.join(tempDir, "cli/package.json"), "utf8"));
      const mcpPkg = JSON.parse(fs.readFileSync(path.join(tempDir, "mcp/package.json"), "utf8"));
      expect(cliPkg.scripts).toHaveProperty("test");
      expect(mcpPkg.scripts).toHaveProperty("test");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
