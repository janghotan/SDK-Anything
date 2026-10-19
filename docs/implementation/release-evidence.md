# SDK-Anything — Release Evidence Report

- **Date:** 2026-10-19
- **Working Branch:** `feat/product-completion`
- **Base Branch:** `chore/sdk-anything-v0.1-finish`
- **Environment:**
  - OS: Linux x86_64 (Kernel 6.6.137)
  - Node.js: `v24.22.0` (primary), plus full-suite verification on `v20.20.2` and `v22.23.3`
  - pnpm: `12.14.0`
  - TypeScript: `5.9.3`
  - Vitest: `3.2.7`
  - Container Runtimes: None on host (verified fail-closed behavior)
- **Release Verdict:** **GO** (Ready for v0.1.0 Release Candidate)

---

## 1. Quality Gates Summary

All automated quality gates pass with zero errors:

| Quality Gate | Command | Outcome | Evidence |
|---|---|---|---|
| **Code Formatting** | `pnpm run format` | `PASS` (0 issues) | Prettier checked across all `src` and `tests` |
| **TypeScript Typecheck** | `pnpm run typecheck` | `PASS` (exit 0) | `tsc --noEmit` clean under strict mode |
| **ESLint** | `pnpm run lint` | `PASS` (0 errors, 100 warnings) | ESLint clean across all source files and test suites |
| **Automated Tests** | `pnpm test` | `PASS` (121/121 passed) | 23 test files, 100% pass rate in Vitest |
| **Production Build** | `pnpm run build` | `PASS` (exit 0) | `tsc -p tsconfig.build.json` clean |
| **Distribution Tarball** | `npm pack --dry-run` | `PASS` (214 files, 114.0 kB) | Whitelist enforced; tests/fixtures excluded; `prepack` builds `dist` from a clean checkout |
| **Multi-version matrix** | `nvm use 20/22/24 && pnpm test` | `PASS` (121/121 on each) | Node `20.20.2`, `22.23.3`, and `24.22.0` all pass the complete suite, including the external generated-project build/execution harness |

---

## 2. Mandatory Release Gates Matrix

| Gate ID | Target Behavior | Executed Command / Test | Result | Path to Evidence | Limitations / Notes |
|---|---|---|:---:|---|---|
| **GATE-01** | External CWD manifest validation | `tests/acceptance/core-user-journey.test.ts` | `PASS` | `tests/acceptance/core-user-journey.test.ts` | Schema resolved via `import.meta.url` regardless of working directory |
| **GATE-02** | Generated code strict type compliance | `tests/acceptance/core-user-journey.test.ts` | `PASS` | `src/generators/cli/generator.ts`, `src/generators/mcp/generator.ts` | Explicit typing in catch and MCP request handlers |
| **GATE-03** | Pure-function SDK end-to-end | `tests/e2e/core-user-journey-e2e.test.ts` | `PASS` | `tests/e2e/core-user-journey-e2e.test.ts` | Complete inspect → generate → CLI & MCP execution |
| **GATE-04** | Authenticated loopback client lifecycle | `tests/acceptance/external-generated-project.test.ts` | `PASS` | `tests/acceptance/external-generated-project.test.ts` | Installed tarball CLI generated a standalone project; constructor auth, async HTTP, cursor pagination and secret redaction exercised through real processes |
| **GATE-05** | Destructive operation fail-closed | `tests/security/security-and-sandbox.test.ts`, `tests/acceptance/external-generated-project.test.ts` | `PASS` | `src/runtime/policy-enforcer.ts` | Denied in non-TTY without `--allow-destructive`/`--allow-operations`; explicitly scoped grants verified externally |
| **GATE-06** | Container sandbox fail-closed | `tests/security/adversarial.test.ts` | `PASS` | `src/sandbox/runner.ts` | Refuses silent fallback when Docker/Podman is absent |
| **GATE-07** | Archive traversal & symlink rejection | `tests/security/adversarial.test.ts` | `PASS` | `src/source/archive-extractor.ts` | Bounded size, traversal check, symlinks rejected |
| **GATE-08** | URL credentials & secret redaction | `tests/security/adversarial.test.ts` | `PASS` | `src/runtime/errors.ts` | Strips Bearer tokens, basic auth URLs, query tokens |
| **GATE-09** | Safe regeneration & drift detection | `tests/manifest/regeneration.test.ts` | `PASS` | `src/generators/inventory.ts` | `.sdk-anything-inventory.json`, `--check`, user-edit protection |
| **GATE-10** | Unowned user files preserved | `tests/manifest/regeneration.test.ts` | `PASS` | `src/generators/inventory.ts` | Regeneration retains custom unowned user files |
| **GATE-11** | Full compatibility lab coverage | `tests/compatibility/compatibility-lab.test.ts` | `PASS` | `src/compatibility/runner.ts` | 6 diverse fixture shapes pass declared invariants |
| **GATE-12** | CLI collision disambiguation & `invoke` | `tests/generators/cli-generator.test.ts` | `PASS` | `src/generators/cli/generator.ts` | All discovered operations exposed; collision-safe names; canonical `invoke <opId>` escape hatch |
| **GATE-13** | Stdin streaming payload support | `tests/generators/cli-generator.test.ts` | `PASS` | `src/generators/cli/generator.ts` | CLI parses piped JSON from stdin |
| **GATE-14** | MCP instructions & collision safety | `tests/generators/mcp-generator.test.ts` | `PASS` | `src/generators/mcp/generator.ts` | All operations exposed as tools; collision-safe names; env-based fail-closed policy |
| **GATE-15** | Consumer skill doc/tool consistency | `tests/generators/consumer-skill.test.ts`, `tests/acceptance/external-generated-project.test.ts` | `PASS` | `src/generators/consumer-skill/generator.ts` | SKILL.md tables match actual CLI help and MCP `listTools` output |
| **GATE-16** | AI privacy disclosure & proposal bounds | `tests/ai/ai-proposal.test.ts` | `PASS` | `src/ai/client.ts` | Prominently discloses transmitted metadata, non-elevation |
| **GATE-17** | Deterministic byte-stable generation | `tests/performance/benchmarks.test.ts` | `PASS` | `src/manifest/serializer.ts` | Repeated runs generate byte-identical output |
| **GATE-18** | AbortSignal cancellation & timeouts | `tests/performance/benchmarks.test.ts` | `PASS` | `src/runtime/invoker.ts` | Timeout caps and AbortSignal cancellation |
| **GATE-19** | Package distribution & doctor check | `tests/distribution/package-install.test.ts` | `PASS` | `src/cli/doctor.ts` | Tarball whitelist, installed binary execution, `doctor` health check |
| **GATE-20** | Installed tarball → standalone generated project | `tests/acceptance/external-generated-project.test.ts` | `PASS` | Generated temp project outside the repo | `npm pack` → install tarball → generate with `--vendor-sdk` → `npm install` + `tsc` in `cli/` and `mcp/` → execute `node dist/*.js` as separate processes |
| **GATE-21** | Real MCP stdio transport parity | `tests/acceptance/external-generated-project.test.ts` | `PASS` | `@modelcontextprotocol/sdk` `StdioClientTransport` | `listTools` and `callTool` against the compiled generated server; read, cursor, invalid input, auth, policy denial and opt-in |
| **GATE-22** | Bounded npm dependency retrieval | `tests/source/dependency-fetcher.test.ts` | `PASS` | `src/source/dependency-fetcher.ts` | Script-free tarball extraction, semver/dist-tag resolution, transitive deps, non-fatal warnings |
| **GATE-23** | Aggregate-package re-export discovery | `inspect npm:@turf/turf --json` (manual evidence) | `PASS` | `/tmp/turf-inspect.json` (2026-10-19) | 56 callable functions discovered after dependency materialisation; 128 remaining symbols surfaced as actionable warnings |

---

## 3. Compatibility Lab Scorecard

Automated run across the 6 registered compatibility fixtures:

| Fixture ID | Architecture Shape | Discovered Ops | Unresolved | Status | Notes |
|---|---|:---:|:---:|:---:|---|
| `turf-pure` | Pure functional | 2 | 0 | `PASS` | Distance calculation & GeoJSON point creation |
| `client-sdk` | Authenticated class client | 3 | 0 | `PASS` | Loopback HTTP client with auth, pagination, write & destructive operations |
| `analyzer-types` | Complex types & overloads | 6 | 4 | `PASS` | Enums, partials, records, overloads, and circular refs |
| `barrel-sdk` | Barrel re-exports & defaults | 5 | 0 | `PASS` | Multi-module re-exports and default helper export |
| `factory-sdk` | Factory-based client | 2 | 0 | `PASS` | Factory returning a client object; methods (`calculate`, `fetchStatus`) become atomic operations |
| `empty-malformed-sdk` | Malformed package | 0 | 0 | `PASS` | Gracefully rejects missing entry points |
| **Total** | **6 / 6 Fixtures Passed** | **18** | **4** | **100%** | **All declared invariants satisfied** |

---

## 4. Known Limitations & Honest Boundaries

- **Container isolation was not executed live.** Docker and Podman are absent on the verification host. The product correctly fails closed with an actionable error, but only static and trusted-local execution paths were exercised.
- **Remote CI was not observed.** The Node 20/22/24 matrix was executed locally with nvm and all three versions passed 121/121 tests. The updated workflow was not pushed, so no remote CI run is claimed.
- **npm dependency retrieval is bounded and best-effort.** Aggregate packages are materialised with a depth/package/size budget and no lifecycle scripts. Unsupported types still surface as warnings (for `@turf/turf`: 56 callable functions discovered, 128 actionable unresolved-symbol warnings). Registry integrity is delegated to HTTPS transport; tarball `integrity` hashes are not separately re-verified.
- **Generated projects install from the registry.** The acceptance harness verified `npm install` + `tsc` in a clean temp project. Offline installation is not guaranteed; the repository's own test run used a warmed npm cache.
- **AI features are mock-verified.** The optional AI layer was tested against a mock OpenAI-compatible endpoint. No live third-party model provider was called.
- **Platform coverage is Linux-only in this evidence run.** Windows and macOS execution were not exercised locally, though generated projects avoid POSIX-only shell syntax.
- **No composite workflows by design.** Only atomic operations are generated; consumers orchestrate multi-step workflows.

---

## 5. Release Boundary Commitments

In accordance with product instructions:
- **No package has been published to npm.**
- **No git tags have been pushed to remotes.**
- **No pull request has been merged to default branch (`main`).**
- **Recommended Candidate Tag:** `v0.1.0` (commit candidate on `feat/product-completion`).
