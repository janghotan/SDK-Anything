import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { generateArtifacts } from "../../src/generators/index.js";
import { buildManifest, validateManifest } from "../../src/manifest/index.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import { createCli } from "../../src/cli/index.js";

describe("Phase 03: Manifest Completeness and Safe Regeneration", () => {
  const turfSourceDir = path.resolve("examples/turf");

  it("produces identical file digests and artifact inventory on repeated generation", async () => {
    const tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-regen-1-"));
    const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-regen-2-"));

    try {
      const evidence = await analyzeSourceSnapshot(turfSourceDir);
      const manifest = buildManifest(evidence);

      const files1 = generateArtifacts(manifest, ["mcp", "cli"], tempDir1);
      const files2 = generateArtifacts(manifest, ["mcp", "cli"], tempDir2);

      expect(files1.length).toBe(files2.length);

      for (let i = 0; i < files1.length; i++) {
        const rel1 = path.relative(tempDir1, files1[i]);
        const rel2 = path.relative(tempDir2, files2[i]);
        expect(rel1).toBe(rel2);

        const content1 = fs.readFileSync(files1[i], "utf8");
        const content2 = fs.readFileSync(files2[i], "utf8");
        expect(content1).toBe(content2);
      }

      // Verify inventory file exists
      const inventoryPath = path.join(tempDir1, ".sdk-anything-inventory.json");
      expect(fs.existsSync(inventoryPath)).toBe(true);
      const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
      expect(inventory.schemaVersion).toBe("sdk-anything/inventory/v1");
      expect(inventory.files.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tempDir1, { recursive: true, force: true });
      fs.rmSync(tempDir2, { recursive: true, force: true });
    }
  });

  it("detects drift with --check without modifying filesystem", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-check-drift-"));

    try {
      const evidence = await analyzeSourceSnapshot(turfSourceDir);
      const manifest = buildManifest(evidence);

      // Initial generation
      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

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

      // Run check mode on up-to-date directory -> should pass (no drift)
      await cli.parseAsync([
        "node",
        "sdk-anything",
        "generate",
        turfSourceDir,
        "--output",
        tempDir,
        "--check",
      ]);

      expect(output).toMatch(/no drift|up to date/i);
      expect(errOutput).toBe("");

      // Now introduce drift: modify a generated file on disk
      const cliTsPath = path.join(tempDir, "cli/cli.ts");
      fs.appendFileSync(cliTsPath, "\n// added drift line\n");

      let driftErr = "";
      const cliWithDrift = createCli({
        writeOut: () => {},
        writeErr: (str: string) => {
          driftErr += str;
        },
        exitOverride: true,
      });

      await expect(
        cliWithDrift.parseAsync([
          "node",
          "sdk-anything",
          "generate",
          turfSourceDir,
          "--output",
          tempDir,
          "--check",
        ]),
      ).rejects.toThrow();

      expect(driftErr).toMatch(/drift detected/i);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves unowned user files during regeneration", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-unowned-preserve-"));

    try {
      const evidence = await analyzeSourceSnapshot(turfSourceDir);
      const manifest = buildManifest(evidence);

      // Initial generation
      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      // User creates custom files in generated directory
      const customFile = path.join(tempDir, "my-custom-script.js");
      fs.writeFileSync(customFile, "console.log('custom user code');", "utf8");

      const customSubFile = path.join(tempDir, "cli/user-config.json");
      fs.writeFileSync(customSubFile, JSON.stringify({ custom: true }), "utf8");

      // Regenerate
      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      // Verify unowned user files are still intact
      expect(fs.existsSync(customFile)).toBe(true);
      expect(fs.readFileSync(customFile, "utf8")).toBe("console.log('custom user code');");
      expect(fs.existsSync(customSubFile)).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("detects hand-edited generated files and prevents silent overwrite without force", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-conflict-detect-"));

    try {
      const evidence = await analyzeSourceSnapshot(turfSourceDir);
      const manifest = buildManifest(evidence);

      // Initial generation
      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      // User modifies a generated file
      const cliTsPath = path.join(tempDir, "cli/cli.ts");
      fs.writeFileSync(cliTsPath, "// user hand-edited this file\n", "utf8");

      // Attempt regeneration without force -> should throw conflict error
      expect(() => {
        generateArtifacts(manifest, ["mcp", "cli"], tempDir);
      }).toThrow(/conflict|modified by user/i);

      // Regenerate with force: true -> should succeed and overwrite
      generateArtifacts(manifest, ["mcp", "cli"], tempDir, { force: true });
      expect(fs.readFileSync(cliTsPath, "utf8")).not.toBe("// user hand-edited this file\n");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("provides actionable migration diagnostic on unsupported or old schemaVersion", () => {
    const invalidManifest: any = {
      schemaVersion: "sdk-anything/manifest/v0-deprecated",
      generatorVersion: "0.0.1",
      source: {
        kind: "local",
        package: "test-pkg",
        version: "1.0.0",
        digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      operations: [],
      unresolved: [],
    };

    const result = validateManifest(invalidManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unsupported schema version"))).toBe(true);
  });
});
