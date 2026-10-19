# SDK-Anything — Product Completion Roadmap & Baseline Audit

- **Date:** 2026-10-19
- **Baseline Git Branch:** `chore/sdk-anything-v0.1-finish`
- **Baseline Commit:** `eb5461a`
- **Active Working Branch:** `feat/product-completion`
- **Node Version:** `v24.22.0`
- **Pnpm Version:** `12.14.0`

---

## 1. Baseline Reality Audit

We performed a cold inspection and verified all repository commands and paths:

1. **Git State:**
   - Commit `eb5461a` confirmed present in git history.
   - Working tree was clean on `chore/sdk-anything-v0.1-finish`.
   - Created dedicated feature branch `feat/product-completion`.

2. **Quality Gates:**
   - `pnpm run typecheck`: Exit 0 (clean).
   - `pnpm run lint`: Exit 0 (73 warnings, 0 errors).
   - `pnpm test`: Exit 0 (67/67 passing tests across 13 test files).
   - `pnpm run build`: Exit 0 (`tsc -p tsconfig.build.json` succeeded).
   - `npm pack --dry-run`: Exit 0 (182 files, 363.2 kB tarball).

3. **User Journey Execution in External Temporary Directory:**
   - Executing `sdk-anything inspect` on local source works.
   - Executing `sdk-anything generate` generates project files.
   - **Fatal Gap 1 (Path resolution):** Running `sdk-anything validate` from outside the repository root fails with `Capability manifest schema not found at /tmp/.../schema/capability-manifest.schema.json` because `src/manifest/validator.ts` resolved the schema path against `process.cwd()` instead of `import.meta.url`.
   - **Fatal Gap 2 (TypeScript Compilation of Generated Artifacts):** Generated `cli/cli.ts` and `mcp/server.ts` produce TypeScript errors under strict mode (`TS7006: Parameter 'err' implicitly has an 'any' type`, `Parameter 'request' implicitly has an 'any' type`) and generated `tsconfig.json` lacks `"types": ["node"]`, causing errors finding `process`, `console`, `Buffer`, and `setTimeout`.
   - **Fatal Gap 3 (Test Script in Generated Projects):** Generated `package.json` files in `cli/` and `mcp/` lack a `"test"` script, causing `sdk-anything test <generatedDir>` to skip testing or fail to run.
   - **Gap 4 (CLI option stubs):** In `src/cli/index.ts`, `generate --ai` option is parsed into `cmdOptions.ai` but never passed to generator or AI proposal service.
   - **Gap 5 (Local SDK resolution):** Standalone independence test relied on in-process module injection rather than running the generated project CLI as an external process.

---

## 2. User Journey Map & Gap Analysis

```
[Target SDK (npm / local / github)]
       │
       ▼
1. `sdk-anything inspect <source> [--write-overrides]`
   - Works well.
   - Missing: structured exit codes, JSON schema provenance on overrides.
       │
       ▼
2. `sdk-anything.overrides.json` review & edits
   - Works well.
   - Missing: JSON pointer in override validation errors.
       │
       ▼
3. `sdk-anything generate <source> --output <dir>`
   - Writes artifacts.
   - Missing: atomic write staging, `--check` drift detection, `--ai` connection.
       │
       ▼
4. Generated Project Build & Install
   - Fails if compiled with strict TypeScript without node types.
   - Needs: `"types": ["node"]` in generated `tsconfig.json` and explicit typing on `.catch(err => ...)` and request handlers.
       │
       ▼
5. `sdk-anything validate <project>`
   - Fails outside repository due to relative schema resolution in `validator.ts`.
   - Needs: `import.meta.url`-based schema path resolution.
       │
       ▼
6. `sdk-anything test <project>`
   - Needs a generated test script in `cli/package.json` and `mcp/package.json` so test execution actually runs.
   - Accurately refuses sandbox fallback when Docker/Podman is absent.
       │
       ▼
7. Real CLI / MCP Invocation & Consumer Agent Skill
   - Pure operations work.
   - Stateful authenticated client needs real process execution test.
```

---

## 3. Product-Level Failure Clusters

1. **Root-Path Coupling:**
   - Manifest validator assumes `process.cwd()` contains `schema/`.
2. **Generated Code Strict Type Safety:**
   - Implicit `any` parameters in generated error handlers and MCP request handlers.
   - Missing `@types/node` declaration references in generated `tsconfig.json`.
3. **Empty Test Harness in Generated Deliverables:**
   - Generated `cli/package.json` and `mcp/package.json` lack `test` scripts.
4. **Drift & Regeneration Safety:**
   - Generation currently overwrites files without check mode or drift detection.
5. **CLI / MCP Parity & Process Execution:**
   - Tests previously tested generated code in-memory; need process-level execution of generated binaries.

---

## 4. Prioritized Dependency-Ordered Roadmap

- **Phase 00: Baseline Reality, Product Map and Dependency-Ordered Roadmap** *(Current)*
  - Reproduce failures with automated acceptance tests (`tests/acceptance/core-user-journey.test.ts`).
  - Document baseline and gaps.
- **Phase 01: Real Public User Journeys End-to-End**
  - Fix path resolution in `src/manifest/validator.ts`.
  - Fix generated TypeScript code strict typing and generated `tsconfig.json`.
  - Add test scripts to generated projects.
  - Implement full external process invocation harness for Turf and client SDK.
- **Phase 02: Analyzer Compatibility and Diagnostics**
  - Robust export resolution, overloads, complex utility types, and structured diagnostic codes.
  - Pathful JSON-pointer error messages for invalid overrides.
- **Phase 03: Manifest Completeness and Safe Regeneration**
  - Manifest stability, canonical digests, ownership manifest, `generate --check` drift detection, atomic writing with rollback.
- **Phase 04: Generated CLI, MCP and Consumer Skill as Working Deliverables**
  - Coherent CLI UX, official MCP SDK stdio/in-memory parity, complete `SKILL.md` with composition examples.
- **Phase 05: SDK Compatibility Lab**
  - Automated compatibility runner with multi-SDK fixture catalog and transparent scorecard.
- **Phase 06: AI-Assisted Analysis as Optional, Evidence-Bounded Augmentation**
  - Connect `--ai` flag to AI client, prompt injection defenses, privacy disclosure, strict schema validation.
- **Phase 07: Security and Sandbox Hardening**
  - Adversarial inputs, path traversal defense, secret redaction, honest sandbox boundaries.
- **Phase 08: Installation and Plugin/Integration Experience**
  - Relocatable bundles, npm pack verification, MCP client configs, doctor/verify commands.
- **Phase 09: Documentation, Discovery, Demo and Contributor Experience**
  - Comprehensive README, architecture docs, runnable CI demos, contributor guides.
- **Phase 10: Performance, Reproducibility and Reliability**
  - Benchmarks, timeouts, bounded pagination/recursion, resource cleanup.
- **Phase 11: Release-Readiness Verification**
  - Multi-version CI verification, release evidence report, release candidate sign-off.
- **Phase 12: Continuous Gap Elimination and Final Product Acceptance**
  - Exhaustive review of edge cases, clean installation test, final completion report.
