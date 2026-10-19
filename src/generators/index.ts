import * as fs from "node:fs";
import * as path from "node:path";
import type { CapabilityManifest } from "../manifest/types.js";
import { generateMcpProject } from "./mcp/generator.js";
import { generateCliProject } from "./cli/generator.js";
import { generateConsumerSkill } from "./consumer-skill/generator.js";

export * from "./mcp/index.js";
export * from "./cli/index.js";
export * from "./consumer-skill/index.js";

export interface GenerateArtifactsOptions {
  sdkDependencyVersion?: string;
}

export function generateArtifacts(
  manifest: CapabilityManifest,
  targets: string[] = ["mcp", "cli"],
  outputDir: string,
  options: GenerateArtifactsOptions = {},
): string[] {
  const resolvedOutDir = path.resolve(outputDir);
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  const writtenFiles: string[] = [];

  // 1. capability-manifest.json
  const manifestPath = path.join(resolvedOutDir, "capability-manifest.json");
  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(manifestPath, manifestJson, "utf8");
  writtenFiles.push(manifestPath);

  // 2. SKILL.md
  const skillPath = path.join(resolvedOutDir, "SKILL.md");
  const skillMarkdown = generateConsumerSkill(manifest);
  fs.writeFileSync(skillPath, skillMarkdown, "utf8");
  writtenFiles.push(skillPath);

  // 3. MCP Adapter
  if (targets.includes("mcp")) {
    const mcpDir = path.join(resolvedOutDir, "mcp");
    fs.mkdirSync(mcpDir, { recursive: true });
    const mcpFiles = generateMcpProject(manifest, options);
    for (const [relPath, content] of Object.entries(mcpFiles)) {
      const fullPath = path.join(mcpDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf8");
      writtenFiles.push(fullPath);
    }
  }

  // 4. CLI Adapter
  if (targets.includes("cli")) {
    const cliDir = path.join(resolvedOutDir, "cli");
    fs.mkdirSync(cliDir, { recursive: true });
    const cliFiles = generateCliProject(manifest, options);
    for (const [relPath, content] of Object.entries(cliFiles)) {
      const fullPath = path.join(cliDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf8");
      writtenFiles.push(fullPath);
    }
  }

  return writtenFiles;
}
