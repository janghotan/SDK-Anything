# SDK-Anything v0.1 Finish & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden SDK-Anything v0.1 to a reliable, reproducible release candidate through evidence-driven verification, standalone generated project testing, real SDK compatibility enhancements, and packaging verification.

**Architecture:** Preserve the approved deterministic pipeline while proving standalone generated project execution outside the source tree, supporting safe direct dependency declaration resolution for aggregate packages, enforcing non-interactive destructive policy guards, and establishing distribution packaging integrity.

**Tech Stack:** Node.js (>=20 LTS, running on v24), TypeScript 5.7+, pnpm 12, Vitest 3.2, Commander.js 15, Ajv 2020, @modelcontextprotocol/sdk 1.32.

**Spec:** `docs/superpowers/specs/2026-10-18-sdk-anything-design-revised.md`

## Global Constraints

- No rewriting of working architecture; finish and harden existing v0.1 subsystems.
- Target TypeScript and JavaScript SDKs only; no multi-step composite workflows.
- No execution of target package code during static inspection; no npm lifecycle scripts.
- Generated projects must compile and execute independently without importing or referencing the SDK-Anything source tree.
- Credentials must be represented only via environment references (`env:VAR_NAME`) and never persisted.
- Write/destructive/unknown operations disabled by default; destructive CLI execution must fail closed in non-interactive environments without explicit authorization.
- Static verification works without containers; untrusted execution requires explicit container boundaries and fails closed without silent fallback.
- No unauthorized npm publish, GitHub release, tag creation, or repository visibility changes.

## Review Focus

1. **Standalone Generated Project Independence:** Generated MCP and CLI code must not contain relative imports or paths back to the SDK-Anything repository root, and must build cleanly in an isolated directory.
2. **Re-Export Package Compatibility:** Packages that re-export sub-packages (e.g. `@turf/turf` in v7) must discover their operations and safely resolve types when dependency declarations are available.
3. **Non-Interactive Destructive Protection:** In non-interactive or non-TTY environments, destructive operations must fail closed unless explicitly authorized via a policy flag.
4. **Distribution Packaging Integrity:** `package.json` must specify a strict `files` whitelist ensuring `dist/`, `schema/`, `skills/`, `README.md`, and `LICENSE` ship, while test fixtures and internal plans are excluded.
5. **Documentation & User Journey Truthfulness:** All documented quickstart commands must run cleanly from a clean checkout without undocumented prerequisites.

---

### Task 1: Standalone Generated Project Independence (Phase 01)

**Files:**
- Create: `tests/generators/standalone-independence.test.ts`
- Modify: `src/generators/mcp/generator.ts`, `src/generators/cli/generator.ts`
- Test: `tests/generators/standalone-independence.test.ts`

**Interfaces:**
- Consumes: `generateArtifacts(manifest, targets, outputDir)`
- Produces: Standalone project with `mcp/server.ts`, `mcp/runtime.ts`, `cli/cli.ts`, `cli/runtime.ts`, verified via TypeScript compiler (`tsc --noEmit`) in an isolated temporary directory outside the repo.

- [ ] **Step 1: Write failing regression test for standalone project compilation and execution outside repo**

```typescript
// tests/generators/standalone-independence.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { generateArtifacts } from '../../src/generators/index.js';
import { buildManifest } from '../../src/manifest/index.js';
import { analyzeSourceSnapshot } from '../../src/analyzer/index.js';

describe('Standalone Generated Project Independence', () => {
  it('generates a project outside repo root that compiles with no imports to generator repo', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-standalone-test-'));
    try {
      const evidence = await analyzeSourceSnapshot(path.resolve('examples/turf'));
      const manifest = buildManifest(evidence);
      const files = generateArtifacts(manifest, ['mcp', 'cli'], tempDir);

      expect(files.length).toBeGreaterThanOrEqual(6);
      // Check that no file contains paths back to the generator repo
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toContain(process.cwd());
        expect(content).not.toContain('../src/');
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify status**

Run: `pnpm test tests/generators/standalone-independence.test.ts`

- [ ] **Step 3: Implement and refine standalone generation artifacts**

Verify generated files, package configurations, and runtime template self-sufficiency.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/generators/standalone-independence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 01**

```bash
git add src/generators/ tests/generators/
git commit -m "test(generators): verify standalone generated project independence outside repo root"
```

---

### Task 2: SDK Compatibility & Re-Export Declaration Handling (Phase 02)

**Files:**
- Create: `tests/source/dependency-resolution.test.ts`
- Modify: `src/source/npm-resolver.ts`, `src/analyzer/export-scanner.ts`
- Test: `tests/source/dependency-resolution.test.ts`

**Interfaces:**
- Consumes: Package metadata and dependency definitions
- Produces: Safe in-memory download of direct dependency declarations into `node_modules` without executing package scripts or `npm install`.

- [ ] **Step 1: Write failing test for dependency declaration resolution**

```typescript
// tests/source/dependency-resolution.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSource } from '../../src/source/index.js';
import { analyzeSourceSnapshot } from '../../src/analyzer/index.js';

describe('Re-export and Dependency Resolution', () => {
  it('correctly reports discovered re-exported operations or surfaces them in unresolved with clear reasons', async () => {
    // Tests that re-exported functions are never silently omitted
  });
});
```

- [ ] **Step 2: Run test to verify status**

Run: `pnpm test tests/source/dependency-resolution.test.ts`

- [ ] **Step 3: Implement safe direct dependency declaration retrieval and export scanner alias resolution**

Ensure all re-exports are either resolved with signatures or surfaced in `unresolved` with actionable overrides guidance.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/source/dependency-resolution.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 02**

```bash
git add src/source/ src/analyzer/ tests/source/
git commit -m "feat(source): improve re-export and dependency declaration resolution"
```

---

### Task 3: Security & Non-Interactive Policy Parity (Phase 03)

**Files:**
- Modify: `src/runtime/policy-enforcer.ts`, `tests/runtime/runtime.test.ts`, `tests/security/security-and-sandbox.test.ts`
- Test: `tests/runtime/runtime.test.ts`

**Interfaces:**
- Consumes: `OperationDescriptor`, `InvocationContext`
- Produces: Strict fail-closed policy enforcement for destructive operations in non-interactive/headless environments.

- [ ] **Step 1: Write failing test for non-interactive destructive policy enforcement**

```typescript
// in tests/runtime/runtime.test.ts
it('fails closed when destructive operation is invoked non-interactively without explicit authorization', async () => {
  await expect(invokeOperation(testManifest, 'items.delete', { id: '1' }, {
    interactive: false,
    allowedEffects: ['read', 'pure'], // Not explicitly authorized for destructive
  })).resolves.toMatchObject({ success: false, error: { code: 'POLICY_DENIED' } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/runtime.test.ts`

- [ ] **Step 3: Implement explicit authorization checks for destructive operations**

Require explicit authorization in `allowedEffects` or `allowDestructive: true`, and fail closed in non-interactive contexts.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/runtime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 03**

```bash
git add src/runtime/ tests/runtime/
git commit -m "security(runtime): enforce strict fail-closed policy on destructive operations"
```

---

### Task 4: Packaging Hygiene and Quality Gates (Phase 04)

**Files:**
- Modify: `package.json`, `.github/workflows/ci.yml`
- Test: `npm pack --dry-run`

**Interfaces:**
- Consumes: `package.json`
- Produces: Strict `files` list in `package.json`, publish dry-run validation, and GitHub Actions CI workflow covering all quality gates.

- [ ] **Step 1: Add `files` whitelist and package validation script to `package.json`**

```json
"files": [
  "dist",
  "schema",
  "skills",
  "README.md",
  "README.zh-CN.md",
  "LICENSE"
]
```

- [ ] **Step 2: Run `npm pack --dry-run` and verify published files**

Run: `npm pack --dry-run`
Expected: Only distribution files, schemas, and READMEs are included; tests and examples excluded.

- [ ] **Step 3: Run full quality gates**

Run: `pnpm run typecheck && pnpm run lint && pnpm test && pnpm run build`
Expected: ALL PASS

- [ ] **Step 4: Commit Phase 04**

```bash
git add package.json .github/
git commit -m "chore(packaging): define explicit files whitelist and verify package dry-run"
```

---

### Task 5: Documentation Verification and Release Candidate Report (Phase 05 & 06)

**Files:**
- Create: `docs/implementation/v0.1-readiness-report.md`
- Modify: `docs/implementation/finish-log.md`, `SDK_ANYTHING_FINISH_STATE.md`
- Test: Clean quickstart walkthrough

**Interfaces:**
- Consumes: Verified test evidence across all 6 finish phases
- Produces: Comprehensive, evidence-backed v0.1 release candidate report.

- [ ] **Step 1: Test documented quickstart commands and verify bilingual README consistency**
- [ ] **Step 2: Compile release candidate assessment with actual command outputs**
- [ ] **Step 3: Commit Phase 05 & 06**

```bash
git add docs/ SDK_ANYTHING_FINISH_STATE.md
git commit -m "docs(release): compile v0.1 release-candidate readiness report and update finish state"
```
