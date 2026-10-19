import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export interface ArtifactFileEntry {
  path: string;
  sha256: string;
  strategy: "overwrite" | "preserve-if-edited";
}

export interface ArtifactInventory {
  schemaVersion: "sdk-anything/inventory/v1";
  generatorVersion: string;
  manifestDigest: string;
  files: ArtifactFileEntry[];
}

export interface DriftReport {
  hasDrift: boolean;
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];
  userModifiedConflicts: string[];
  unownedFilesPreserved: string[];
}

export function computeSha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function createArtifactInventory(
  fileMap: Map<string, string>,
  manifestDigest: string,
  generatorVersion = "0.1.0",
): ArtifactInventory {
  const files: ArtifactFileEntry[] = [];
  for (const [relPath, content] of fileMap.entries()) {
    if (relPath === ".sdk-anything-inventory.json") continue;
    files.push({
      path: relPath.replace(/\\/g, "/"),
      sha256: computeSha256(content),
      strategy: "overwrite",
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    schemaVersion: "sdk-anything/inventory/v1",
    generatorVersion,
    manifestDigest,
    files,
  };
}

export function checkDrift(
  targetDir: string,
  newFileMap: Map<string, string>,
): DriftReport {
  const resolvedDir = path.resolve(targetDir);
  const inventoryFile = path.join(resolvedDir, ".sdk-anything-inventory.json");

  const addedFiles: string[] = [];
  const removedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const userModifiedConflicts: string[] = [];
  const unownedFilesPreserved: string[] = [];

  let previousInventory: ArtifactInventory | null = null;
  if (fs.existsSync(inventoryFile)) {
    try {
      previousInventory = JSON.parse(fs.readFileSync(inventoryFile, "utf8"));
    } catch {
      // Ignored
    }
  }

  const prevFileMap = new Map<string, ArtifactFileEntry>();
  if (previousInventory?.files) {
    for (const entry of previousInventory.files) {
      prevFileMap.set(entry.path, entry);
    }
  }

  // 1. Check newly generated files against disk and previous inventory
  for (const [relPath, newContent] of newFileMap.entries()) {
    const normalizedRel = relPath.replace(/\\/g, "/");
    if (normalizedRel === ".sdk-anything-inventory.json") continue;

    const fullDiskPath = path.join(resolvedDir, normalizedRel);

    if (!fs.existsSync(fullDiskPath)) {
      addedFiles.push(normalizedRel);
      continue;
    }

    const diskContent = fs.readFileSync(fullDiskPath, "utf8");
    const diskSha = computeSha256(diskContent);
    const newSha = computeSha256(newContent);

    if (diskSha !== newSha) {
      modifiedFiles.push(normalizedRel);

      // Check if user edited it
      const prevEntry = prevFileMap.get(normalizedRel);
      if (prevEntry && diskSha !== prevEntry.sha256) {
        userModifiedConflicts.push(normalizedRel);
      }
    }
  }

  // 2. Check for files present in previous inventory but not in newFileMap
  if (previousInventory?.files) {
    for (const entry of previousInventory.files) {
      if (entry.path === ".sdk-anything-inventory.json") continue;
      if (!newFileMap.has(entry.path)) {
        removedFiles.push(entry.path);
      }
    }
  }

  // 3. Check for unowned files present on disk but not in previous inventory or new generation
  function scanDir(current: string) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      const rel = path.relative(resolvedDir, full).replace(/\\/g, "/");
      if (e.name === ".sdk-anything-inventory.json" || e.name === "node_modules" || e.name === ".git") {
        continue;
      }
      if (e.isDirectory()) {
        scanDir(full);
      } else if (e.isFile()) {
        if (!newFileMap.has(rel) && !prevFileMap.has(rel)) {
          unownedFilesPreserved.push(rel);
        }
      }
    }
  }

  scanDir(resolvedDir);

  const hasDrift =
    addedFiles.length > 0 ||
    removedFiles.length > 0 ||
    modifiedFiles.length > 0;

  return {
    hasDrift,
    addedFiles,
    removedFiles,
    modifiedFiles,
    userModifiedConflicts,
    unownedFilesPreserved,
  };
}
