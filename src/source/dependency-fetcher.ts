import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as semver from "semver";
import { extractTarballSafely } from "./archive-extractor.js";

export interface DependencyFetchOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxPackages?: number;
  maxDepth?: number;
  maxConcurrency?: number;
}

export interface DependencyFetchReport {
  installed: string[];
  skipped: string[];
  failed: string[];
  warnings: string[];
}

interface QueueEntry {
  name: string;
  spec: string;
  depth: number;
}

function encodePackageName(packageName: string): string {
  return packageName.startsWith("@")
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName);
}

export function resolveDependencyVersion(
  spec: string,
  metadata: {
    "dist-tags"?: Record<string, string>;
    versions?: Record<string, unknown>;
  },
): string | undefined {
  const versions = Object.keys(metadata.versions ?? {});
  if (versions.length === 0) return undefined;

  const cleanSpec = spec.trim();
  if (metadata["dist-tags"]?.[cleanSpec]) {
    return metadata["dist-tags"][cleanSpec];
  }
  if (metadata.versions?.[cleanSpec]) {
    return cleanSpec;
  }

  // Delegate range semantics to semver rather than guessing. We strip common
  // npm protocol prefixes that cannot be resolved from a registry packument.
  const range = cleanSpec.replace(
    /^(npm|workspace|file|link|git\+https?):.*/,
    "",
  );
  if (!range) return undefined;

  try {
    return (
      semver.maxSatisfying(versions, range, {
        includePrerelease: false,
      }) ?? undefined
    );
  } catch {
    return undefined;
  }
}

async function fetchJson(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<any | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTarball(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<Buffer | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    if (!res.ok) return undefined;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Materialise the declared dependency graph of an npm package into its
 * snapshot's `node_modules` directory without running package lifecycle
 * scripts. This is what allows TypeScript to resolve re-exported declarations
 * from aggregate packages such as `@turf/turf`.
 *
 * Failure is deliberately non-fatal: unresolved dependencies are reported as
 * warnings and the analyzer still produces actionable diagnostics.
 */
export async function fetchDeclaredDependencies(
  snapshotDir: string,
  options: DependencyFetchOptions = {},
): Promise<DependencyFetchReport> {
  const report: DependencyFetchReport = {
    installed: [],
    skipped: [],
    failed: [],
    warnings: [],
  };

  const pkgJsonPath = path.join(snapshotDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    report.warnings.push(
      "No package.json found; skipping dependency retrieval",
    );
    return report;
  }

  let rootPkg: any;
  try {
    rootPkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  } catch (err: unknown) {
    report.warnings.push(
      `Could not parse package.json for dependency retrieval: ${err instanceof Error ? err.message : String(err)}`,
    );
    return report;
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxPackages = options.maxPackages ?? 250;
  const maxDepth = options.maxDepth ?? 3;
  const maxConcurrency = options.maxConcurrency ?? 8;

  const queue: QueueEntry[] = [];
  const enqueueDependencies = (
    deps: Record<string, string> | undefined,
    depth: number,
  ) => {
    if (!deps) return;
    for (const [name, spec] of Object.entries(deps)) {
      queue.push({ name, spec, depth });
    }
  };

  enqueueDependencies(rootPkg.dependencies, 1);
  enqueueDependencies(rootPkg.optionalDependencies, 1);
  enqueueDependencies(rootPkg.peerDependencies, 1);

  const attempted = new Set<string>();
  const metadataCache = new Map<string, any>();
  let installedCount = 0;

  const worker = async () => {
    while (queue.length > 0) {
      if (installedCount >= maxPackages) return;
      const entry = queue.shift();
      if (!entry) return;
      if (entry.depth > maxDepth) continue;
      if (attempted.has(entry.name)) continue;
      attempted.add(entry.name);

      const targetDir = path.join(snapshotDir, "node_modules", entry.name);
      if (fs.existsSync(path.join(targetDir, "package.json"))) {
        report.skipped.push(`${entry.name} (already present)`);
        continue;
      }

      let metadata = metadataCache.get(entry.name);
      if (!metadata) {
        metadata = await fetchJson(
          fetchFn,
          `https://registry.npmjs.org/${encodePackageName(entry.name)}`,
          timeoutMs,
        );
        if (metadata) metadataCache.set(entry.name, metadata);
      }
      if (!metadata) {
        report.failed.push(`${entry.name}@${entry.spec}`);
        report.warnings.push(
          `Could not retrieve registry metadata for dependency ${entry.name}@${entry.spec}`,
        );
        continue;
      }

      const version = resolveDependencyVersion(entry.spec, metadata);
      if (!version || !metadata.versions?.[version]) {
        report.failed.push(`${entry.name}@${entry.spec}`);
        report.warnings.push(
          `Could not resolve a version for dependency ${entry.name}@${entry.spec}`,
        );
        continue;
      }

      const versionData = metadata.versions[version];
      const tarballUrl = versionData?.dist?.tarball;
      if (!tarballUrl) {
        report.failed.push(`${entry.name}@${version}`);
        report.warnings.push(
          `No tarball URL for dependency ${entry.name}@${version}`,
        );
        continue;
      }

      const buffer = await fetchTarball(fetchFn, tarballUrl, timeoutMs);
      if (!buffer) {
        report.failed.push(`${entry.name}@${version}`);
        report.warnings.push(`Could not download ${entry.name}@${version}`);
        continue;
      }

      const staging = fs.mkdtempSync(
        path.join(os.tmpdir(), "sdk-anything-dep-"),
      );
      try {
        await extractTarballSafely(buffer, staging, {
          stripLeadingDir: true,
          maxFiles: 5000,
          maxSizeBytes: 20 * 1024 * 1024,
        });
        fs.mkdirSync(path.dirname(targetDir), { recursive: true });
        fs.rmSync(targetDir, { recursive: true, force: true });
        fs.renameSync(staging, targetDir);
        report.installed.push(`${entry.name}@${version}`);
        installedCount += 1;

        const depPkgPath = path.join(targetDir, "package.json");
        if (fs.existsSync(depPkgPath)) {
          try {
            const depPkg = JSON.parse(fs.readFileSync(depPkgPath, "utf8"));
            enqueueDependencies(depPkg.dependencies, entry.depth + 1);
            enqueueDependencies(depPkg.peerDependencies, entry.depth + 1);
          } catch {
            report.warnings.push(
              `Could not parse dependency package.json for ${entry.name}@${version}`,
            );
          }
        }
      } catch (err: unknown) {
        report.failed.push(`${entry.name}@${version}`);
        report.warnings.push(
          `Could not extract dependency ${entry.name}@${version}: ${err instanceof Error ? err.message : String(err)}`,
        );
        fs.rmSync(staging, { recursive: true, force: true });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrency, 8) }, () => worker()),
  );

  return report;
}
