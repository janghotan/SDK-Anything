import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCli } from "../../src/cli/index.js";
import { generateArtifacts } from "../../src/generators/index.js";
import { buildManifest } from "../../src/manifest/index.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import { runDoctorCheck } from "../../src/cli/doctor.js";

const execFileAsync = promisify(execFile);
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

async function run(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

describe("Phase 08: Installable Deliverables & Package Distribution", () => {
  const turfSourceDir = path.resolve("examples/turf");

  it("generates MCP client configuration examples in generated bundles", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-mcp-cfg-"));

    try {
      const evidence = await analyzeSourceSnapshot(turfSourceDir);
      const manifest = buildManifest(evidence);

      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      const mcpConfigPath = path.join(
        tempDir,
        "mcp/claude_desktop_config.json",
      );
      expect(fs.existsSync(mcpConfigPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf8"));
      expect(config.mcpServers).toBeDefined();
      const serverKey = Object.keys(config.mcpServers)[0];
      expect(config.mcpServers[serverKey].command).toBe("node");
      expect(config.mcpServers[serverKey].args).toEqual(["./dist/server.js"]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("runs sdk-anything doctor to verify generated bundle integrity", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-doctor-test-"));

    try {
      const evidence = await analyzeSourceSnapshot(turfSourceDir);
      const manifest = buildManifest(evidence);

      generateArtifacts(manifest, ["mcp", "cli"], tempDir);

      const report = runDoctorCheck(tempDir);
      expect(report.healthy).toBe(true);
      expect(report.inventoryValid).toBe(true);
      expect(report.missingFiles.length).toBe(0);
      expect(report.corruptedFiles.length).toBe(0);
      expect(report.cliPresent).toBe(true);
      expect(report.mcpPresent).toBe(true);
      expect(report.packageName).toBe("@example/turf-sample");

      // Verify CLI doctor command
      let output = "";
      const cli = createCli({
        writeOut: (str: string) => {
          output += str;
        },
        writeErr: () => {},
        exitOverride: true,
      });

      await cli.parseAsync([
        "node",
        "sdk-anything",
        "doctor",
        tempDir,
        "--json",
      ]);
      const parsed = JSON.parse(output);
      expect(parsed.healthy).toBe(true);
      expect(parsed.inventoryValid).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("verifies package tarball contents contain all necessary runtime files", async () => {
    const repoRoot = path.resolve(".");
    const dryRunOutput = await run(npmBin, ["pack", "--dry-run", "--json"], {
      cwd: repoRoot,
    });

    const packData = JSON.parse(dryRunOutput);
    const files = packData[0]?.files?.map((f: any) => f.path) ?? [];

    // Check critical runtime files are included in the published package
    expect(files).toContain("package.json");
    expect(files).toContain("LICENSE");
    expect(files).toContain("README.md");
    expect(files).toContain("schema/capability-manifest.schema.json");
    expect(files).toContain("dist/cli/bin.js");
    expect(files).toContain("dist/cli/index.js");
    expect(files).toContain("dist/index.js");
    expect(files).toContain("dist/manifest/validator.js");
    expect(files).toContain("dist/generators/index.js");
    expect(files).toContain("dist/runtime/invoker.js");

    // Check test files, fixtures, and internal prompt pack are EXCLUDED from published package
    expect(files.some((f: string) => f.startsWith("tests/"))).toBe(false);
    expect(files.some((f: string) => f.startsWith("examples/"))).toBe(false);
    expect(files.some((f: string) => f.startsWith("prompts/"))).toBe(false);
  }, 120000);

  it("extracts packed tarball into an isolated directory and executes binary independently", async () => {
    const repoRoot = path.resolve(".");
    const tempConsumerDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "sdk-tarball-install-"),
    );

    try {
      // 1. Pack tarball into temp directory
      await run(npmBin, ["pack", "--pack-destination", tempConsumerDir], {
        cwd: repoRoot,
      });

      const tarballName = fs
        .readdirSync(tempConsumerDir)
        .find((entry) => entry.endsWith(".tgz"));
      expect(tarballName).toBeTruthy();
      const tarballPath = path.join(tempConsumerDir, tarballName!);
      expect(fs.existsSync(tarballPath)).toBe(true);

      // 2. Install tarball into clean consumer workspace via npm install
      fs.writeFileSync(
        path.join(tempConsumerDir, "package.json"),
        JSON.stringify({ name: "tarball-consumer", private: true }),
      );
      await run(
        npmBin,
        ["install", tarballPath, "--prefer-offline", "--no-audit", "--no-fund"],
        { cwd: tempConsumerDir },
      );

      // 3. Execute binary directly via npx sdk-anything
      const helpOutput = await run("npx", ["sdk-anything", "--help"], {
        cwd: tempConsumerDir,
      });

      expect(helpOutput).toContain("sdk-anything [options] [command]");
      expect(helpOutput).toContain("inspect");
      expect(helpOutput).toContain("generate");
      expect(helpOutput).toContain("validate");
      expect(helpOutput).toContain("test");
      expect(helpOutput).toContain("doctor");
    } finally {
      fs.rmSync(tempConsumerDir, { recursive: true, force: true });
    }
  }, 180000);
});
