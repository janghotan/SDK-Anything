import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import type {
  NpmLocator,
  SourceSnapshot,
  ResolveSourceOptions,
} from "./types.js";
import {
  extractTarballSafely,
  computeTreeDigest,
} from "./archive-extractor.js";
import { fetchDeclaredDependencies } from "./dependency-fetcher.js";

export async function resolveNpmSource(
  locator: NpmLocator,
  options: ResolveSourceOptions = {},
): Promise<SourceSnapshot> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30000;

  // Encode package name: @scope/pkg -> @scope%2Fpkg
  const encodedName = locator.packageName.startsWith("@")
    ? `@${encodeURIComponent(locator.packageName.slice(1))}`
    : encodeURIComponent(locator.packageName);

  const registryUrl = `https://registry.npmjs.org/${encodedName}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let metadataRes: Response;
  try {
    metadataRes = await fetchFn(registryUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(
      `Failed to query npm registry for ${locator.packageName}: ${err?.message || String(err)}`,
    );
  }
  clearTimeout(timer);

  if (!metadataRes.ok) {
    if (metadataRes.status === 404) {
      throw new Error(`npm package not found: ${locator.packageName}`);
    }
    throw new Error(
      `npm registry returned status ${metadataRes.status} for ${locator.packageName}`,
    );
  }

  const metadata = (await metadataRes.json()) as any;
  const requestedVersion =
    locator.versionOrTag ?? metadata["dist-tags"]?.latest;

  if (!requestedVersion) {
    throw new Error(
      `Could not resolve latest version for npm package: ${locator.packageName}`,
    );
  }

  const versionData = metadata.versions?.[requestedVersion];
  if (!versionData) {
    // Check if requestedVersion is a dist-tag
    const tagVersion = metadata["dist-tags"]?.[requestedVersion];
    if (tagVersion && metadata.versions?.[tagVersion]) {
      return downloadAndExtractNpm(
        locator,
        tagVersion,
        metadata.versions[tagVersion],
        options,
      );
    }
    throw new Error(
      `Version ${requestedVersion} not found for package ${locator.packageName}`,
    );
  }

  return downloadAndExtractNpm(locator, requestedVersion, versionData, options);
}

async function downloadAndExtractNpm(
  locator: NpmLocator,
  resolvedVersion: string,
  versionData: any,
  options: ResolveSourceOptions,
): Promise<SourceSnapshot> {
  const fetchFn = options.fetchFn ?? fetch;
  const tarballUrl = versionData.dist?.tarball;
  if (!tarballUrl) {
    throw new Error(
      `No tarball URL found for package ${locator.packageName}@${resolvedVersion}`,
    );
  }

  const res = await fetchFn(tarballUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download tarball from ${tarballUrl}: ${res.statusText}`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const cacheBase =
    options.cacheDir ?? path.join(os.tmpdir(), "sdk-anything-snapshots");
  const safePkgId = locator.packageName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const snapshotDir = path.join(
    cacheBase,
    `npm-${safePkgId}-${resolvedVersion}-${crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 8)}`,
  );

  // Extract safely (stripping npm's leading `package/` folder)
  await extractTarballSafely(buffer, snapshotDir, {
    stripLeadingDir: true,
    maxFiles: options.maxFileCount,
    maxSizeBytes: options.maxArchiveSizeBytes,
  });

  const digest = computeTreeDigest(snapshotDir);
  const pkgJsonPath = path.join(snapshotDir, "package.json");

  let warnings: string[] = [];
  if (options.fetchDependencies !== false) {
    const dependencyReport = await fetchDeclaredDependencies(snapshotDir, {
      fetchFn: options.fetchFn,
      timeoutMs: options.timeoutMs,
    });
    warnings = dependencyReport.warnings;
  }

  return {
    kind: "npm",
    identifier: `npm:${locator.packageName}${locator.versionOrTag ? `@${locator.versionOrTag}` : ""}`,
    packageName: locator.packageName,
    version: resolvedVersion,
    snapshotPath: snapshotDir,
    digest,
    warnings,
    manifestPath: fs.existsSync(pkgJsonPath) ? pkgJsonPath : undefined,
  };
}
