import * as fs from "node:fs";
import * as path from "node:path";
import { computeSha256 } from "../generators/inventory.js";
import { detectContainerRuntime } from "../sandbox/runner.js";
import { validateManifest } from "../manifest/validator.js";

export interface DoctorCheckResult {
  healthy: boolean;
  targetPath: string;
  manifestVersion?: string;
  generatorVersion?: string;
  packageName?: string;
  packageVersion?: string;
  digest?: string;
  inventoryValid: boolean;
  totalFiles: number;
  missingFiles: string[];
  corruptedFiles: string[];
  cliPresent: boolean;
  mcpPresent: boolean;
  nodeVersion: string;
  containerRuntime: string | null;
  policySummary: {
    enabledOperations: number;
    disabledOperations: number;
  };
  warnings: string[];
  errors: string[];
}

export function runDoctorCheck(targetPath: string): DoctorCheckResult {
  const resolvedPath = path.resolve(targetPath);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Project directory does not exist: ${resolvedPath}`);
  }

  // 1. Locate and validate capability-manifest.json
  let manifestPath = path.join(resolvedPath, "capability-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    manifestPath = path.join(resolvedPath, "sdk-anything.manifest.json");
  }

  let manifest: any = null;
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const val = validateManifest(manifest);
      if (!val.valid) {
        errors.push(`Manifest validation errors: ${val.errors.join("; ")}`);
      }
    } catch (err: any) {
      errors.push(`Failed to parse manifest: ${err.message}`);
    }
  } else {
    errors.push(`Missing capability-manifest.json in ${resolvedPath}`);
  }

  // 2. Check artifact inventory integrity
  const inventoryPath = path.join(resolvedPath, ".sdk-anything-inventory.json");
  let inventoryValid = false;
  const missingFiles: string[] = [];
  const corruptedFiles: string[] = [];
  let totalFiles = 0;

  if (fs.existsSync(inventoryPath)) {
    try {
      const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
      totalFiles = inventory.files?.length ?? 0;
      for (const entry of inventory.files ?? []) {
        const filePath = path.join(resolvedPath, entry.path);
        if (!fs.existsSync(filePath)) {
          missingFiles.push(entry.path);
        } else {
          const content = fs.readFileSync(filePath, "utf8");
          const hash = computeSha256(content);
          if (hash !== entry.sha256) {
            corruptedFiles.push(entry.path);
          }
        }
      }
      inventoryValid = missingFiles.length === 0 && corruptedFiles.length === 0;
    } catch (err: any) {
      warnings.push(
        `Could not read .sdk-anything-inventory.json: ${err.message}`,
      );
    }
  } else {
    warnings.push(
      "No .sdk-anything-inventory.json found; skipping checksum integrity verification",
    );
  }

  // 3. Check CLI and MCP project files
  const cliPresent = fs.existsSync(path.join(resolvedPath, "cli/cli.ts"));
  const mcpPresent = fs.existsSync(path.join(resolvedPath, "mcp/server.ts"));

  if (!cliPresent && !mcpPresent) {
    warnings.push("Neither CLI nor MCP server target found in project");
  }

  // 4. Policy summary
  const ops = manifest?.operations ?? [];
  const enabledOps = ops.filter((o: any) => o.enabledByDefault).length;
  const disabledOps = ops.length - enabledOps;

  const containerRuntime = detectContainerRuntime();
  const healthy = errors.length === 0 && missingFiles.length === 0;

  return {
    healthy,
    targetPath: resolvedPath,
    manifestVersion: manifest?.schemaVersion,
    generatorVersion: manifest?.generatorVersion,
    packageName: manifest?.source?.package,
    packageVersion: manifest?.source?.version,
    digest: manifest?.source?.digest,
    inventoryValid,
    totalFiles,
    missingFiles,
    corruptedFiles,
    cliPresent,
    mcpPresent,
    nodeVersion: process.version,
    containerRuntime,
    policySummary: {
      enabledOperations: enabledOps,
      disabledOperations: disabledOps,
    },
    warnings,
    errors,
  };
}
