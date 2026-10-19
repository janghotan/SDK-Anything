# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-19

First public release of SDK-Anything.

### Added

- **Static SDK analysis**: inspect local directories, npm packages, and public
  GitHub repositories without executing target code or package lifecycle
  scripts.
- **Portable capability manifest** (`sdk-anything/manifest/v1`) as the single
  source of truth, with byte-stable serialization and `.sdk-anything-inventory.json`
  artifact inventory.
- **Generated MCP server, developer CLI, and `SKILL.md`** from the shared
  manifest, with collision-safe command/tool naming across all surfaces.
- **Analyzer diagnostics and overrides** for unresolved types, enums, index
  signatures, utility types, and factory-returned client methods.
- **Authenticated client support**: environment-referenced credentials, cursor
  pagination, and secret redaction.
- **Vendoring and dependency options**: `--vendor-sdk` and `--sdk-dependency`
  for standalone generated projects.
- **Safe regeneration**: `--check` drift detection, user-file preservation, and
  generated-artifact checksum validation via `validate`.
- **Effect policy**: write, destructive, and unknown operations fail closed by
  default; explicit opt-in via `--allow-effects`, `--allow-operations`,
  `--allow-destructive`, and MCP environment equivalents.
- **Bounded npm dependency retrieval** (script-free, depth/package/size budgets)
  enabling aggregate-package re-export discovery.
- **Compatibility fixture matrix**, `doctor` health check, and package
  distribution tests.
- Installable npm package with `sdk-anything` CLI binary.

### Security

- Fail-closed container sandbox semantics: container execution requires
  Docker/Podman and never silently falls back to host execution.
- Credential redaction for explicit keys, bearer tokens, URL credentials, and
  query tokens.

[0.1.0]: https://github.com/janghotan/SDK-Anything/releases/tag/v0.1.0
