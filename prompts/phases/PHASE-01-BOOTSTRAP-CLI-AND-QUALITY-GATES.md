# Phase 01 — Bootstrap the TypeScript Project and Quality Gates

**Goal:** Create the smallest usable project foundation, CLI shell, tests, typecheck, lint/format policy, and CI-ready checks.

**Required skills:** `test-driven-development`, `codebase-design`, `conventional-commit`, `verification-before-completion`.

## Scope

- TypeScript/Node.js project, package metadata, build/test/typecheck/lint scripts, `.gitignore`, editor conventions, and license placeholder only if the user's intended license is confirmed from the spec/repo. Prefer Apache-2.0 only if approved in the spec or repo conventions; otherwise record decision, do not assume legal licensing.
- Use Commander.js for CLI command structure unless the repo already has a well-founded equivalent.
- Confirm current stable compatible versions of the TypeScript compiler and official MCP TypeScript SDK by consulting their installed/current docs or package metadata. Pin versions. Do not invent package names or copy stale API examples.
- Minimal `sdk-anything --help` and `sdk-anything --version` behavior with predictable exit codes.
- Add baseline Vitest (or repo-standard test runner) and CI workflow if appropriate for the remote's established conventions.
- Establish generated output conventions and temporary test directories.

## TDD tasks

1. Test CLI help/version and unknown command behavior; run failing test.
2. Implement command bootstrap and metadata.
3. Test config resolution from explicit CLI argument, environment, and defaults in a defined order; implement only settings needed in v0.1.
4. Add baseline scripts and ensure build, typecheck, lint, and tests produce independent outcomes.

## Acceptance criteria

- Clean install/build/test on supported Node LTS.
- CLI help/version work and errors go to stderr with non-zero status.
- Strict TS checking enabled; test runner works without network/API keys.
- No domain features or fake implementations are added prematurely.
- Commit a passing bootstrap slice; update state/log and push safely if possible.
