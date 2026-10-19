import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type { LocalLocator, SourceSnapshot, ResolveSourceOptions } from './types.js';
import { computeTreeDigest } from './archive-extractor.js';

export async function resolveLocalSource(
  locator: LocalLocator,
  options: ResolveSourceOptions = {}
): Promise<SourceSnapshot> {
  const resolvedPath = path.resolve(locator.localPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Local source directory does not exist: ${locator.localPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Local source path is not a directory: ${locator.localPath}`);
  }

  // Check package.json for version and name
  let version = '0.0.0-local';
  let packageName = path.basename(resolvedPath);
  let manifestPath: string | undefined;
  const pkgJsonPath = path.join(resolvedPath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.name) {
        packageName = pkg.name;
      }
      if (pkg.version) {
        version = pkg.version;
      }
      manifestPath = pkgJsonPath;
    } catch {
      // Malformed or missing package.json is allowed, warning will be appended
    }
  }

  // Compute content digest
  const digest = computeTreeDigest(resolvedPath);

  // Create isolated snapshot copy in cacheDir
  const cacheBase = options.cacheDir ?? path.join(os.tmpdir(), 'sdk-anything-snapshots');
  const snapshotId = crypto.createHash('sha256').update(resolvedPath + ':' + digest).digest('hex').slice(0, 16);
  const snapshotDir = path.join(cacheBase, `local-${snapshotId}`);

  // Copy directory excluding .git and node_modules
  copyDirFilter(resolvedPath, snapshotDir);

  const snapshotPkgJson = path.join(snapshotDir, 'package.json');

  return {
    kind: 'local',
    identifier: resolvedPath,
    packageName,
    version,
    snapshotPath: snapshotDir,
    digest,
    warnings: manifestPath ? [] : ['No valid package.json found in local source root'],
    manifestPath: fs.existsSync(snapshotPkgJson) ? snapshotPkgJson : undefined,
  };
}

function copyDirFilter(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirFilter(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
