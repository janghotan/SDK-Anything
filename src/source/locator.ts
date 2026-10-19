import * as fs from "node:fs";
import type { ParsedSourceLocator } from "./types.js";

export function parseSourceLocator(locator: string): ParsedSourceLocator {
  const trimmed = locator.trim();
  if (!trimmed) {
    throw new Error("Source locator cannot be empty");
  }

  // Check npm prefix
  if (trimmed.startsWith("npm:")) {
    const pkgSpec = trimmed.slice(4).trim();
    if (!pkgSpec) {
      throw new Error("Invalid npm locator: missing package name");
    }

    // Scoped or unscoped package with optional version: e.g. @scope/pkg@1.0.0 or lodash@4.17.21
    if (pkgSpec.startsWith("@")) {
      const slashIndex = pkgSpec.indexOf("/");
      if (slashIndex === -1) {
        throw new Error(`Invalid scoped npm package name: ${pkgSpec}`);
      }
      const atIndex = pkgSpec.indexOf("@", slashIndex + 1);
      if (atIndex !== -1) {
        return {
          kind: "npm",
          packageName: pkgSpec.slice(0, atIndex),
          versionOrTag: pkgSpec.slice(atIndex + 1),
        };
      }
      return {
        kind: "npm",
        packageName: pkgSpec,
      };
    } else {
      const atIndex = pkgSpec.indexOf("@");
      if (atIndex !== -1) {
        return {
          kind: "npm",
          packageName: pkgSpec.slice(0, atIndex),
          versionOrTag: pkgSpec.slice(atIndex + 1),
        };
      }
      return {
        kind: "npm",
        packageName: pkgSpec,
      };
    }
  }

  // Check URL
  if (trimmed.includes("://")) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new Error(`Invalid source URL: ${trimmed}`);
    }

    if (parsedUrl.protocol !== "https:") {
      if (parsedUrl.protocol === "http:") {
        throw new Error(
          `Insecure URL: only HTTPS is supported for remote sources (${trimmed})`,
        );
      }
      throw new Error(
        `Unsupported protocol: ${parsedUrl.protocol} (${trimmed})`,
      );
    }

    if (
      parsedUrl.hostname !== "github.com" &&
      parsedUrl.hostname !== "www.github.com"
    ) {
      throw new Error(
        `Unsupported host: only public github.com repositories are supported in v0.1 (${trimmed})`,
      );
    }

    // Pathname e.g. /owner/repo or /owner/repo/tree/branch
    const pathParts = parsedUrl.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (pathParts.length < 2) {
      throw new Error(
        `Invalid GitHub repository URL: expected https://github.com/<owner>/<repo>`,
      );
    }

    const owner = pathParts[0];
    const repo = pathParts[1].replace(/\.git$/, "");

    let ref: string | undefined;
    if (pathParts.length >= 4 && pathParts[2] === "tree") {
      ref = pathParts.slice(3).join("/");
    }

    return {
      kind: "github",
      owner,
      repo,
      ref,
    };
  }

  // Local directory path
  if (
    trimmed.startsWith(".") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("~") ||
    fs.existsSync(trimmed)
  ) {
    return {
      kind: "local",
      localPath: trimmed,
    };
  }

  // If none matched, check if it could be a local path or npm locator without npm: prefix?
  // Spec says `npm:<package>` for npm, `./path` for local, `https://github...` for github.
  // If it's not starting with npm: or https: and exists or has path separators, treat as local
  return {
    kind: "local",
    localPath: trimmed,
  };
}
