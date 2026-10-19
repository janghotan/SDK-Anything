import type { SourceSnapshot, ResolveSourceOptions } from "./types.js";
import { parseSourceLocator } from "./locator.js";
import { resolveLocalSource } from "./local-resolver.js";
import { resolveNpmSource } from "./npm-resolver.js";
import { resolveGitHubSource } from "./github-resolver.js";

export * from "./types.js";
export * from "./locator.js";
export * from "./archive-extractor.js";
export * from "./local-resolver.js";
export * from "./npm-resolver.js";
export * from "./github-resolver.js";

export async function resolveSource(
  locator: string,
  options: ResolveSourceOptions = {},
): Promise<SourceSnapshot> {
  const parsed = parseSourceLocator(locator);

  switch (parsed.kind) {
    case "local":
      return resolveLocalSource(parsed, options);
    case "npm":
      return resolveNpmSource(parsed, options);
    case "github":
      return resolveGitHubSource(parsed, options);
    default: {
      const _exhaustiveCheck: never = parsed;
      throw new Error(
        `Unhandled source locator kind: ${(_exhaustiveCheck as any)?.kind}`,
      );
    }
  }
}
