import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type { GitHubLocator, SourceSnapshot, ResolveSourceOptions } from './types.js';
import { extractTarballSafely, computeTreeDigest } from './archive-extractor.js';

export async function resolveGitHubSource(
  locator: GitHubLocator,
  options: ResolveSourceOptions = {}
): Promise<SourceSnapshot> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30000;

  let ref = locator.ref;
  if (!ref) {
    // Determine default branch from GitHub API
    const repoApiUrl = `https://api.github.com/repos/${locator.owner}/${locator.repo}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(repoApiUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SDK-Anything-Resolver/0.1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as any;
        ref = data.default_branch || 'main';
      } else {
        // Fallback default
        ref = 'main';
      }
    } catch {
      clearTimeout(timer);
      ref = 'main';
    }
  }

  const resolvedRef = ref || 'main';
  const tarballUrl = `https://api.github.com/repos/${locator.owner}/${locator.repo}/tarball/${resolvedRef}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let tarballRes: Response;
  try {
    tarballRes = await fetchFn(tarballUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SDK-Anything-Resolver/0.1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(`Failed to download GitHub archive for ${locator.owner}/${locator.repo}: ${err?.message || String(err)}`);
  }
  clearTimeout(timer);

  if (!tarballRes.ok) {
    throw new Error(`GitHub returned HTTP ${tarballRes.status} for ${locator.owner}/${locator.repo} (${tarballUrl})`);
  }

  const arrayBuffer = await tarballRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const cacheBase = options.cacheDir ?? path.join(os.tmpdir(), 'sdk-anything-snapshots');
  const safeRepoId = `${locator.owner}_${locator.repo}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const snapshotDir = path.join(
    cacheBase,
    `gh-${safeRepoId}-${resolvedRef}-${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8)}`
  );

  await extractTarballSafely(buffer, snapshotDir, {
    stripLeadingDir: true, // GitHub tarball has top-level folder <owner>-<repo>-<commit>
    maxFiles: options.maxFileCount,
    maxSizeBytes: options.maxArchiveSizeBytes,
  });

  const digest = computeTreeDigest(snapshotDir);
  const pkgJsonPath = path.join(snapshotDir, 'package.json');

  return {
    kind: 'github',
    identifier: `https://github.com/${locator.owner}/${locator.repo}${locator.ref ? `/tree/${locator.ref}` : ''}`,
    version: resolvedRef,
    revision: resolvedRef,
    snapshotPath: snapshotDir,
    digest,
    warnings: [],
    manifestPath: fs.existsSync(pkgJsonPath) ? pkgJsonPath : undefined,
  };
}
