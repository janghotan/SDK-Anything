export type SourceKind = "npm" | "local" | "github";

export interface NpmLocator {
  kind: "npm";
  packageName: string;
  versionOrTag?: string;
}

export interface LocalLocator {
  kind: "local";
  localPath: string;
}

export interface GitHubLocator {
  kind: "github";
  owner: string;
  repo: string;
  ref?: string;
}

export type ParsedSourceLocator = NpmLocator | LocalLocator | GitHubLocator;

export interface SourceSnapshot {
  kind: SourceKind;
  identifier: string;
  packageName?: string;
  version: string;
  revision?: string;
  snapshotPath: string;
  digest: string; // sha256:<hex>
  warnings: string[];
  manifestPath?: string;
}

export interface ResolveSourceOptions {
  cacheDir?: string;
  maxArchiveSizeBytes?: number;
  maxFileCount?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}
