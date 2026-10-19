import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

export interface ExtractTarballOptions {
  stripLeadingDir?: boolean;
  maxFiles?: number;
  maxSizeBytes?: number;
}

export function computeTreeDigest(dir: string): string {
  const fileEntries: Array<{ relativePath: string; hash: string }> = [];

  function walk(currentDir: string, baseDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    // Sort entries for deterministic walk
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

      // Ignore common non-reproducible artifacts
      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath, baseDir);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(fullPath);
        const fileHash = crypto
          .createHash("sha256")
          .update(content)
          .digest("hex");
        fileEntries.push({ relativePath, hash: fileHash });
      }
    }
  }

  if (fs.existsSync(dir)) {
    walk(dir, dir);
  }

  // Sort by relativePath deterministically
  fileEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const treeHash = crypto.createHash("sha256");
  for (const entry of fileEntries) {
    treeHash.update(`${entry.relativePath}:${entry.hash}\n`);
  }

  return `sha256:${treeHash.digest("hex")}`;
}

export async function extractTarballSafely(
  archiveBuffer: Buffer,
  destinationDir: string,
  options: ExtractTarballOptions = {},
): Promise<string[]> {
  const maxFiles = options.maxFiles ?? 10000;
  const maxSizeBytes = options.maxSizeBytes ?? 50 * 1024 * 1024; // 50MB

  // Decompress
  let tarBuffer: Buffer;
  try {
    tarBuffer = zlib.gunzipSync(archiveBuffer);
  } catch {
    // If not gzipped, try raw tar buffer
    tarBuffer = archiveBuffer;
  }

  if (tarBuffer.length > maxSizeBytes) {
    throw new Error(
      `Archive exceeds maximum size limit of ${maxSizeBytes} bytes`,
    );
  }

  fs.mkdirSync(destinationDir, { recursive: true });
  const realDestDir = fs.realpathSync(destinationDir);

  const extractedFiles: string[] = [];
  let offset = 0;
  let fileCount = 0;
  let totalExtractedBytes = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;

    // Check for end of archive (two consecutive zero blocks)
    let isZero = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        isZero = false;
        break;
      }
    }
    if (isZero) {
      break;
    }

    // Read name (offset 0, length 100)
    let rawName = header.toString("utf8", 0, 100).replace(/\0.*$/, "").trim();
    if (!rawName) continue;

    // Read prefix if ustar (offset 345, length 155)
    const magic = header.toString("utf8", 257, 263);
    if (magic.startsWith("ustar")) {
      const prefix = header
        .toString("utf8", 345, 500)
        .replace(/\0.*$/, "")
        .trim();
      if (prefix) {
        rawName = `${prefix}/${rawName}`;
      }
    }

    // Normalize slashes
    rawName = rawName.replace(/\\/g, "/");

    // Path traversal check
    if (
      rawName.startsWith("/") ||
      rawName.includes("../") ||
      rawName === ".." ||
      rawName.endsWith("/..")
    ) {
      throw new Error(
        `Path traversal attack detected in archive entry: ${rawName}`,
      );
    }

    // Read size (offset 124, length 12, octal)
    const sizeStr = header
      .toString("utf8", 124, 136)
      .replace(/\0.*$/, "")
      .trim();
    const size = parseInt(sizeStr, 8) || 0;

    // Read typeflag (offset 156, length 1)
    const typeflag = header.toString("utf8", 156, 157);

    // Symlink / hardlink checks (type '1' or '2')
    if (typeflag === "1" || typeflag === "2") {
      const linkname = header
        .toString("utf8", 157, 257)
        .replace(/\0.*$/, "")
        .trim();
      if (
        linkname.startsWith("/") ||
        linkname.includes("../") ||
        linkname.includes("..")
      ) {
        throw new Error(
          `Unsafe symlink target in archive: ${rawName} -> ${linkname}`,
        );
      }
      // In safe mode, we disallow symlinks that might escape or point to non-extracted files
      throw new Error(
        `Symlinks in archives are not permitted for security: ${rawName} -> ${linkname}`,
      );
    }

    // Determine normalized relative path in destination
    // npm tarballs have entries starting with `package/...`; GitHub has `<repo>-<ref>/...`
    let relativeEntryPath = rawName;
    if (options.stripLeadingDir !== false) {
      const parts = rawName.split("/");
      if (parts.length > 1) {
        relativeEntryPath = parts.slice(1).join("/");
      }
    }

    if (!relativeEntryPath) {
      // Skipped root directory header
      const blocksToSkip = Math.ceil(size / 512);
      offset += blocksToSkip * 512;
      continue;
    }

    // Verify resolved destination does not escape
    const targetPath = path.resolve(realDestDir, relativeEntryPath);
    if (
      !targetPath.startsWith(realDestDir + path.sep) &&
      targetPath !== realDestDir
    ) {
      throw new Error(
        `Path traversal detected: target ${targetPath} escapes destination ${realDestDir}`,
      );
    }

    // Directory entry (type '5' or trailing slash)
    if (typeflag === "5" || rawName.endsWith("/")) {
      fs.mkdirSync(targetPath, { recursive: true });
      const blocksToSkip = Math.ceil(size / 512);
      offset += blocksToSkip * 512;
      continue;
    }

    // Regular file (type '0' or '\0')
    fileCount++;
    if (fileCount > maxFiles) {
      throw new Error(
        `Archive exceeds maximum file count limit of ${maxFiles}`,
      );
    }

    totalExtractedBytes += size;
    if (totalExtractedBytes > maxSizeBytes) {
      throw new Error(
        `Archive exceeds maximum uncompressed size of ${maxSizeBytes} bytes`,
      );
    }

    const fileContent = tarBuffer.subarray(offset, offset + size);
    const blocksToAdvance = Math.ceil(size / 512);
    offset += blocksToAdvance * 512;

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, fileContent);
    extractedFiles.push(targetPath);
  }

  return extractedFiles;
}
