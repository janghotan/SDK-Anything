# SDK-Anything v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SDK-Anything v0.1 to convert TypeScript/JavaScript SDKs into inspectable, testable, agent-friendly atomic MCP servers, CLIs, and consumer `SKILL.md` files from a single versioned capability manifest.

**Architecture:** A deterministic pipeline resolves SDK sources (npm, local dir, public GitHub), statically inspects exports and types using the TypeScript compiler API into an Evidence Inventory, applies optional AI proposals and reviewable human overrides, validates a canonical `sdk-anything/manifest/v1`, and generates inspectable TypeScript MCP and CLI adapters sharing a single runtime enforcement harness.

**Tech Stack:** Node.js (>=20 LTS, running on v24), TypeScript 5.7+, pnpm, Commander.js, Ajv (2020), `@modelcontextprotocol/sdk` (latest stable), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-sdk-anything-design-revised.md`

## Global Constraints

- TypeScript and JavaScript SDKs only; no python/java/etc. analyzers in v0.1.
- No execution of target SDK code during inspection or static analysis; no running lifecycle scripts (`prepare`, `postinstall`).
- A single versioned capability manifest (`sdk-anything/manifest/v1`) is the single source of truth for MCP and CLI adapters.
- Atomic operations only in v0.1; no generated executable multi-step composites.
- All secrets are represented exclusively by references (e.g. `env:VAR_NAME`), never secret values in manifests, generated code, AI prompts, or logs.
- Pure and verified read operations enabled by default; write, destructive, and unknown effects disabled by default and enforced by the shared runtime.
- Static verification requires no container; untrusted execution requires explicit OS/container sandbox (`--sandbox`) and fails closed without silent fallback if unavailable.
- `--trusted-local` is labelled as user-owned trusted-code execution and is not represented as a security sandbox.
- `@turf/turf` is the pure-function golden example; a separate synthetic client-SDK fixture validates class/factory construction, credential references, async HTTP, bounded pagination, and error normalization.
- AI assistance is optional and strictly proposes descriptions, selection, and docs interpretation against discovered symbols; deterministic workflows run without AI credentials.

## Review Focus

1. **Malicious/untrusted input:** Path traversal archives (`../`), symlink escapes, SSRF/hostile URLs in source locators, and prompt injection in target README/JSDoc must be sanitized or ignored; tests verify rejection.
2. **Incomplete/complex types:** Generics, circular references, unsupported unions, or missing types must be recorded as `unresolved` with actionable diagnostics rather than silently coerced to `{ type: "object" }`.
3. **Client construction and secret config:** Class constructors and factory functions must be evidenced or supplied via overrides; credentials must never leak into generated code, error traces, or tool inputs.
4. **Unbounded pagination and errors:** Paginated operations must enforce strict item count and byte caps; unbounded streams or iterators stay unresolved; errors normalize into safe categories without leaking auth tokens.
5. **Generated MCP/CLI policy drift:** MCP tools and CLI commands must share identical operation sets and runtime policy checks; write/destructive/unknown operations must be denied if not explicitly enabled.

---

### Task 1: Bootstrap Repository, Toolchain, and Quality Gates (Phase 01)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `.gitignore`, `src/index.ts`, `src/cli/index.ts`, `src/cli/config.ts`, `tests/cli/bootstrap.test.ts`
- Modify: none
- Test: `tests/cli/bootstrap.test.ts`

**Interfaces:**
- Consumes: none
- Produces: CLI entry point `sdk-anything` with `--help`, `--version`, and baseline configuration loader `resolveConfig()`.

- [ ] **Step 1: Write failing test for CLI bootstrap and config resolution**

```typescript
// tests/cli/bootstrap.test.ts
import { describe, it, expect } from 'vitest';
import { runCli } from '../helpers/run-cli.js';
import { resolveConfig } from '../../src/cli/config.js';

describe('CLI bootstrap', () => {
  it('outputs help text and exits with code 0', async () => {
    const res = await runCli(['--help']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('sdk-anything');
    expect(res.stdout).toContain('inspect');
    expect(res.stdout).toContain('generate');
  });

  it('outputs version and exits with code 0', async () => {
    const res = await runCli(['--version']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('exits with non-zero on unknown command', async () => {
    const res = await runCli(['nonexistent-command']);
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).toContain('error');
  });

  it('resolves configuration with defaults and overrides', () => {
    const cfg = resolveConfig({ output: './custom-output' });
    expect(cfg.output).toBe('./custom-output');
    expect(cfg.ai).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/bootstrap.test.ts`
Expected: FAIL (missing files or dependencies).

- [ ] **Step 3: Implement project configuration, dependencies, and CLI entry**

Configure `package.json` with Commander.js, Ajv, TypeScript 5.7+, Vitest; implement `src/cli/config.ts` and `src/cli/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/bootstrap.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck and lint**

Run: `pnpm run typecheck && pnpm run lint`
Expected: PASS

- [ ] **Step 6: Commit Phase 01**

```bash
git add package.json tsconfig.json vitest.config.ts src/ tests/ .gitignore
git commit -m "feat(cli): bootstrap TypeScript project, CLI shell, and quality gates"
```

---

### Task 2: Safe Source Resolution (npm, Local Directory, Public GitHub) (Phase 02)

**Files:**
- Create: `src/source/types.ts`, `src/source/locator.ts`, `src/source/npm-resolver.ts`, `src/source/local-resolver.ts`, `src/source/github-resolver.ts`, `src/source/index.ts`, `tests/source/source-resolver.test.ts`, `tests/fixtures/archives/...`
- Modify: `src/cli/index.ts`
- Test: `tests/source/source-resolver.test.ts`

**Interfaces:**
- Consumes: CLI options, filesystem utilities
- Produces: `resolveSource(locator: string, options?: ResolveOptions): Promise<SourceSnapshot>` where `SourceSnapshot` contains `kind: 'npm' | 'local' | 'github'`, `identifier: string`, `version: string`, `snapshotPath: string`, `digest: string`, and `warnings: string[]`.

- [ ] **Step 1: Write failing tests for source resolution**

```typescript
// tests/source/source-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSource, parseSourceLocator } from '../../src/source/index.js';

describe('Source Resolver', () => {
  it('parses valid source locators', () => {
    expect(parseSourceLocator('npm:@turf/turf')).toEqual({ kind: 'npm', target: '@turf/turf' });
    expect(parseSourceLocator('./local/path')).toEqual({ kind: 'local', target: './local/path' });
    expect(parseSourceLocator('https://github.com/Turfjs/turf')).toEqual({ kind: 'github', target: 'Turfjs/turf' });
  });

  it('rejects unsupported protocols and invalid GitHub URLs', async () => {
    await expect(resolveSource('ftp://example.com/repo')).rejects.toThrow(/unsupported/i);
    await expect(resolveSource('https://evil.com/repo')).rejects.toThrow(/only public github/i);
  });

  it('normalizes local directory without running scripts', async () => {
    const snapshot = await resolveSource('./tests/fixtures/client-sdk');
    expect(snapshot.kind).toBe('local');
    expect(snapshot.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('rejects path traversal and unsafe archive entries in npm tarball extraction', async () => {
    await expect(extractTarballSafely('tests/fixtures/malicious-traversal.tar.gz', '/tmp/dest'))
      .rejects.toThrow(/traversal/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/source/source-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement locator parser, archive extractor with traversal check, npm resolver, local directory resolver, and github snapshot resolver**

Implement safe tarball extraction (reject paths with `..`, absolute paths, symlink escapes), SHA-256 tree hashing, npm registry fetcher (downloading `.tgz` without running npm install or lifecycle scripts), and GitHub archive downloader.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/source/source-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 02**

```bash
git add src/source/ tests/source/ tests/fixtures/
git commit -m "feat(source): implement safe npm, local, and github source resolution"
```

---

### Task 3: Deterministic Static TypeScript Analyzer and Evidence Inventory (Phase 03)

**Files:**
- Create: `src/analyzer/types.ts`, `src/analyzer/ts-program.ts`, `src/analyzer/export-scanner.ts`, `src/analyzer/type-lowering.ts`, `src/analyzer/evidence-inventory.ts`, `src/analyzer/index.ts`, `tests/analyzer/analyzer.test.ts`, `tests/fixtures/analyzer-types/...`
- Modify: `src/cli/index.ts`
- Test: `tests/analyzer/analyzer.test.ts`

**Interfaces:**
- Consumes: `SourceSnapshot` from `src/source`
- Produces: `EvidenceInventory` containing `source`, `exports`, `classes`, `factories`, `functions`, `typeSchemas`, `unresolved`, and `documentation`.

- [ ] **Step 1: Write failing tests for static analysis and type lowering**

```typescript
// tests/analyzer/analyzer.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeSourceSnapshot } from '../../src/analyzer/index.js';

describe('TypeScript Analyzer', () => {
  it('extracts top-level pure functions and type schemas deterministically', async () => {
    const inv = await analyzeSourceSnapshot('./tests/fixtures/pure-functions');
    expect(inv.functions.some(f => f.name === 'distance')).toBe(true);
    const distFn = inv.functions.find(f => f.name === 'distance')!;
    expect(distFn.inputSchema.type).toBe('object');
    expect(distFn.inputSchema.properties).toHaveProperty('from');
    expect(distFn.inputSchema.properties).toHaveProperty('to');
  });

  it('marks unsupported complex or circular types as unresolved', async () => {
    const inv = await analyzeSourceSnapshot('./tests/fixtures/circular-and-generics');
    expect(inv.unresolved.some(u => u.symbolName === 'CircularNode')).toBe(true);
  });

  it('detects class constructor and instance methods without executing code', async () => {
    const inv = await analyzeSourceSnapshot('./tests/fixtures/client-sdk');
    expect(inv.classes.some(c => c.name === 'TestClient')).toBe(true);
    const client = inv.classes.find(c => c.name === 'TestClient')!;
    expect(client.methods.some(m => m.name === 'listItems')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/analyzer/analyzer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement TypeScript Compiler API host, export scanner, conservative type-to-JSON-Schema converter, and Evidence Inventory builder**

Configure TS Compiler with `noEmit: true`, inspect declaration files (`.d.ts`) and TS source, detect functions/classes/methods, convert primitives, objects, arrays, enums, literal unions to JSON Schema Draft 2020-12, flag unresolved symbols with reason and source location.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/analyzer/analyzer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 03**

```bash
git add src/analyzer/ tests/analyzer/ tests/fixtures/
git commit -m "feat(analyzer): implement static TypeScript analyzer and evidence inventory"
```

---

### Task 4: Manifest Schema, Overrides Engine, and Policy Model (Phase 04)

**Files:**
- Create: `schema/capability-manifest.schema.json`, `src/manifest/types.ts`, `src/manifest/builder.ts`, `src/manifest/validator.ts`, `src/manifest/serializer.ts`, `src/manifest/overrides.ts`, `src/manifest/index.ts`, `tests/manifest/manifest.test.ts`, `tests/manifest/overrides.test.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/manifest/manifest.test.ts`

**Interfaces:**
- Consumes: `EvidenceInventory` from `src/analyzer`, optional `sdk-anything.overrides.json`
- Produces: `CapabilityManifest` validated against `schema/capability-manifest.schema.json`, stable canonical JSON serialization, and starter overrides generator.

- [ ] **Step 1: Write failing tests for manifest building, validation, and overrides**

```typescript
// tests/manifest/manifest.test.ts
import { describe, it, expect } from 'vitest';
import { buildManifest, validateManifest, serializeCanonicalManifest } from '../../src/manifest/index.js';
import { applyOverrides, generateStarterOverrides } from '../../src/manifest/overrides.js';

describe('Manifest and Overrides', () => {
  it('validates a correct manifest against capability-manifest.schema.json', () => {
    const manifest = buildManifest(sampleEvidence);
    const res = validateManifest(manifest);
    expect(res.valid).toBe(true);
  });

  it('applies overrides to resolve ambiguous types and configure client credentials', () => {
    const overrides = {
      schemaVersion: 'sdk-anything/overrides/v1',
      client: {
        construction: 'class',
        options: { token: { type: 'secret', source: 'env:TEST_TOKEN', required: true } }
      },
      operations: {
        'items.list': { effect: 'read', enabledByDefault: true }
      }
    };
    const updated = applyOverrides(manifest, overrides);
    expect(updated.client?.options.token.source).toBe('env:TEST_TOKEN');
    expect(updated.operations.find(o => o.id === 'items.list')?.enabledByDefault).toBe(true);
  });

  it('rejects manifests containing raw secret values or invalid schemas', () => {
    const bad = { ...manifest, client: { options: { token: 'raw-secret-123' } } };
    expect(validateManifest(bad as any).valid).toBe(false);
  });

  it('produces byte-identical canonical JSON output across runs', () => {
    const s1 = serializeCanonicalManifest(manifest);
    const s2 = serializeCanonicalManifest(manifest);
    expect(s1).toBe(s2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/manifest/manifest.test.ts`
Expected: FAIL

- [ ] **Step 3: Define JSON Schema, TypeScript types, manifest builder, Ajv validator, canonical serializer, and overrides engine**

Write `schema/capability-manifest.schema.json` with strict schema validation; implement deterministic key/operation sorting, effect classification defaults (`pure`/`read` vs `write`/`destructive`/`unknown`), and override validation against known operation IDs.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/manifest/manifest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 04**

```bash
git add schema/ src/manifest/ tests/manifest/
git commit -m "feat(manifest): define v1 schema, validation, canonical serialization, and overrides"
```

---

### Task 5: Shared Invocation Runtime, Client Lifecycle, and Runtime Policy (Phase 05)

**Files:**
- Create: `src/runtime/types.ts`, `src/runtime/client-lifecycle.ts`, `src/runtime/policy-enforcer.ts`, `src/runtime/invoker.ts`, `src/runtime/errors.ts`, `src/runtime/pagination.ts`, `src/runtime/index.ts`, `tests/runtime/runtime.test.ts`
- Modify: none
- Test: `tests/runtime/runtime.test.ts`

**Interfaces:**
- Consumes: `CapabilityManifest`, SDK package modules
- Produces: `invokeOperation(manifest: CapabilityManifest, operationId: string, input: unknown, context: InvocationContext): Promise<InvocationResult>`.

- [ ] **Step 1: Write failing tests for shared invocation, policy enforcement, caps, and error normalization**

```typescript
// tests/runtime/runtime.test.ts
import { describe, it, expect } from 'vitest';
import { invokeOperation } from '../../src/runtime/index.js';

describe('Shared Runtime Invoker', () => {
  it('blocks disabled write operations by policy before calling SDK', async () => {
    const spy = vi.fn();
    await expect(invokeOperation(testManifest, 'records.delete', { id: '1' }, { allowedEffects: ['read', 'pure'] }))
      .rejects.toThrow(/policy denied/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('resolves credentials from environment references without leaking secrets in errors', async () => {
    process.env.TEST_SECRET = 'super-secret';
    try {
      const res = await invokeOperation(clientManifest, 'items.get', { id: '1' }, { env: process.env });
      expect(res.data).toBeDefined();
    } catch (err: any) {
      expect(err.message).not.toContain('super-secret');
    }
  });

  it('enforces maximum item and byte pagination limits', async () => {
    const res = await invokeOperation(paginatedManifest, 'items.list', {}, { maxItems: 10, maxBytes: 1024 });
    expect(res.data.items.length).toBeLessThanOrEqual(10);
    expect(res.truncated).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/runtime.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement client lifecycle manager, runtime policy enforcer, secret resolver, pagination limiter, and error normalizer**

Support client construction (`none`, `class`, `factory`), resolve credential references (`env:VAR_NAME`), validate input schemas before invocation, enforce effect policies, bound pagination results, and normalize errors into standard codes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/runtime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 05**

```bash
git add src/runtime/ tests/runtime/
git commit -m "feat(runtime): implement shared invocation runtime, client lifecycle, and policy enforcement"
```

---

### Task 6: Inspectable MCP Server Code Generator (Phase 06)

**Files:**
- Create: `src/generators/mcp/generator.ts`, `src/generators/mcp/templates.ts`, `src/generators/mcp/index.ts`, `tests/generators/mcp-generator.test.ts`
- Modify: `src/generators/index.ts`, `src/cli/index.ts`
- Test: `tests/generators/mcp-generator.test.ts`

**Interfaces:**
- Consumes: Validated `CapabilityManifest`
- Produces: Generated project files: `mcp/server.ts`, `mcp/package.json`, `mcp/tsconfig.json`, `mcp/runtime.ts`.

- [ ] **Step 1: Write failing tests for MCP server code generation and tool parity**

```typescript
// tests/generators/mcp-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateMcpServer } from '../../src/generators/mcp/index.js';

describe('MCP Generator', () => {
  it('generates compiling TypeScript MCP server exposing enabled atomic operations', async () => {
    const files = await generateMcpServer(sampleManifest);
    expect(files).toHaveProperty('server.ts');
    expect(files['server.ts']).toContain('@modelcontextprotocol/sdk');
    expect(files['server.ts']).toContain('distance');
    // Ensure write operations not enabled by default are not exposed
    expect(files['server.ts']).not.toContain('records_delete');
  });

  it('delegates tool execution to shared runtime harness without eval', async () => {
    const files = await generateMcpServer(sampleManifest);
    expect(files['server.ts']).not.toContain('eval(');
    expect(files['server.ts']).toContain('invokeOperation(');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/generators/mcp-generator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement MCP server code generator using official `@modelcontextprotocol/sdk` conventions**

Generate inspectable, type-safe TypeScript files for stdio transport MCP server, mapping each enabled atomic operation to an MCP tool with schema, description, and shared runtime call.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/generators/mcp-generator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 06**

```bash
git add src/generators/mcp/ tests/generators/mcp-generator.test.ts
git commit -m "feat(mcp): implement inspectable MCP server code generator"
```

---

### Task 7: CLI Code Generator and Consumer SKILL.md (Phase 07)

**Files:**
- Create: `src/generators/cli/generator.ts`, `src/generators/cli/templates.ts`, `src/generators/cli/index.ts`, `src/generators/consumer-skill/generator.ts`, `src/generators/consumer-skill/index.ts`, `tests/generators/cli-generator.test.ts`, `tests/generators/consumer-skill.test.ts`
- Modify: `src/generators/index.ts`, `src/cli/index.ts`
- Test: `tests/generators/cli-generator.test.ts`, `tests/generators/consumer-skill.test.ts`

**Interfaces:**
- Consumes: Validated `CapabilityManifest`
- Produces: Generated project files: `cli/index.ts`, `cli/package.json`, `cli/tsconfig.json`, `SKILL.md`.

- [ ] **Step 1: Write failing tests for CLI generation, parity, and consumer SKILL.md**

```typescript
// tests/generators/cli-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateCliProject } from '../../src/generators/cli/index.js';
import { generateConsumerSkill } from '../../src/generators/consumer-skill/index.js';

describe('CLI Generator and Consumer Skill', () => {
  it('generates CLI with deterministic commands matching MCP tool set', async () => {
    const files = await generateCliProject(sampleManifest);
    expect(files['index.ts']).toContain('.command(\'distance\')');
    expect(files['index.ts']).toContain('--json');
  });

  it('generates SKILL.md detailing capabilities, parameters, and composition guidance', async () => {
    const skillContent = generateConsumerSkill(sampleManifest);
    expect(skillContent).toContain('# ');
    expect(skillContent).toContain('distance');
    expect(skillContent).toContain('atomic tools');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/generators/cli-generator.test.ts tests/generators/consumer-skill.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CLI code generator and consumer `SKILL.md` generator**

Generate Commander CLI with `--json`, confirmation prompt for interactive destructive operations, environment secret resolution, and consumer `SKILL.md` describing how host agents should discover, configure, and combine generated tools.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/generators/cli-generator.test.ts tests/generators/consumer-skill.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 07**

```bash
git add src/generators/cli/ src/generators/consumer-skill/ tests/generators/
git commit -m "feat(cli-gen): implement CLI generator, adapter parity, and consumer SKILL.md"
```

---

### Task 8: Optional AI Proposal Layer and Generator Skill (Phase 08)

**Files:**
- Create: `src/ai/types.ts`, `src/ai/client.ts`, `src/ai/proposal-parser.ts`, `src/ai/privacy-disclosure.ts`, `src/ai/index.ts`, `skills/sdk-anything/SKILL.md`, `tests/ai/ai-proposal.test.ts`
- Modify: `src/cli/index.ts`, `src/manifest/builder.ts`
- Test: `tests/ai/ai-proposal.test.ts`

**Interfaces:**
- Consumes: `EvidenceInventory`, user OpenAI-compatible endpoint configuration
- Produces: `AIProposals` proposing operation descriptions, groupings, and suggested operation selections; generator orchestration skill in `skills/sdk-anything/SKILL.md`.

- [ ] **Step 1: Write failing tests for AI proposal parser, privacy disclosure, and fallback**

```typescript
// tests/ai/ai-proposal.test.ts
import { describe, it, expect } from 'vitest';
import { requestAiProposals, validateAiProposals } from '../../src/ai/index.js';

describe('AI Proposal Layer', () => {
  it('discloses source materials before first AI call', async () => {
    const disclosed = checkAndRecordDisclosure({ promptConsent: false });
    expect(disclosed).toBeDefined();
  });

  it('validates structured AI proposals and rejects unknown operation references', () => {
    const valid = validateAiProposals(sampleEvidence, {
      proposals: [{ operationId: 'known_op', description: 'Clear summary' }]
    });
    expect(valid.valid).toBe(true);

    const invalid = validateAiProposals(sampleEvidence, {
      proposals: [{ operationId: 'invented_fake_op', description: 'Hallucinated' }]
    });
    expect(invalid.valid).toBe(false);
  });

  it('falls back cleanly to deterministic behavior when AI endpoint fails', async () => {
    const result = await requestAiProposals(sampleEvidence, { endpoint: 'http://127.0.0.1:1/nonexistent' });
    expect(result.fallback).toBe(true);
    expect(result.warnings).toContain('AI service unavailable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/ai/ai-proposal.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement OpenAI-compatible client, structured proposal validator, privacy disclosure prompt/record, and generator `skills/sdk-anything/SKILL.md`**

Use Node native `fetch`, validate JSON response against discovered evidence, reject attempts to create multi-step composites or alter input types, and write the generator orchestration skill.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/ai/ai-proposal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 08**

```bash
git add src/ai/ skills/ tests/ai/
git commit -m "feat(ai): implement optional AI proposal layer and generator orchestration skill"
```

---

### Task 9: Client-SDK Fixture, Sandbox Execution, and Security Hardening (Phase 09)

**Files:**
- Create: `tests/fixtures/client-sdk/package.json`, `tests/fixtures/client-sdk/src/index.ts`, `tests/fixtures/client-sdk/test-server.ts`, `src/sandbox/types.ts`, `src/sandbox/runner.ts`, `src/sandbox/index.ts`, `tests/security/security-and-sandbox.test.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/security/security-and-sandbox.test.ts`

**Interfaces:**
- Consumes: Generated project directories, test configuration (`--sandbox` / `--trusted-local`)
- Produces: Execution test report distinguishing static checks, trusted local execution, and sandboxed execution.

- [ ] **Step 1: Write failing tests for client SDK fixture, sandbox fail-close, and security boundaries**

```typescript
// tests/security/security-and-sandbox.test.ts
import { describe, it, expect } from 'vitest';
import { runSandboxTests } from '../../src/sandbox/index.js';
import { startMockServer } from '../fixtures/client-sdk/test-server.js';

describe('Client SDK Fixture and Sandbox Security', () => {
  it('executes client fixture operations against loopback test server with auth reference', async () => {
    const server = await startMockServer(0);
    try {
      // test client construction, auth token resolution, async request, bounded pagination
    } finally {
      await server.close();
    }
  });

  it('fails closed when --sandbox is requested but container runtime is missing', async () => {
    await expect(runSandboxTests('./generated/project', { mode: 'sandbox' }))
      .rejects.toThrow(/container runtime \(docker or podman\) is required/i);
  });

  it('labels --trusted-local explicitly as trusted-code execution and never as a sandbox', async () => {
    const report = await runSandboxTests('./generated/project', { mode: 'trusted-local' });
    expect(report.mode).toBe('trusted-local');
    expect(report.isSecuritySandbox).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/security/security-and-sandbox.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement client SDK fixture with loopback HTTP server, sandbox runner with fail-closed container detection, and trusted-local child process runner**

Implement the full client-SDK fixture covering constructor options, `env:API_KEY` credential lookup, async HTTP calls, cursor pagination with item/byte caps, and normalized error responses; implement sandbox detection and fail-closed diagnostics.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/security/security-and-sandbox.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Phase 09**

```bash
git add tests/fixtures/client-sdk/ src/sandbox/ tests/security/
git commit -m "feat(security): implement client-SDK fixture and sandboxed execution engine"
```

---

### Task 10: Turf Golden E2E Example, Documentation, and Readiness Review (Phase 10)

**Files:**
- Create: `examples/turf/...`, `README.md`, `LICENSE`, `docs/architecture.md`, `docs/security.md`, `tests/e2e/turf-e2e.test.ts`
- Modify: `package.json`, `docs/implementation/phase-log.md`, `SDK_ANYTHING_AUTONOMOUS_STATE.md`
- Test: `tests/e2e/turf-e2e.test.ts`

**Interfaces:**
- Consumes: Complete CLI pipeline
- Produces: Verified end-to-end `@turf/turf` generated output, client-SDK generated output, comprehensive documentation, and final readiness review.

- [ ] **Step 1: Write failing end-to-end test for Turf generation and invocation**

```typescript
// tests/e2e/turf-e2e.test.ts
import { describe, it, expect } from 'vitest';
import { runCli } from '../helpers/run-cli.js';

describe('Turf End-to-End Golden Test', () => {
  it('inspects npm:@turf/turf deterministically without executing code', async () => {
    const res = await runCli(['inspect', 'npm:@turf/turf', '--json']);
    expect(res.exitCode).toBe(0);
    const data = JSON.parse(res.stdout);
    expect(data.operations.length).toBeGreaterThan(0);
  });

  it('generates working MCP server and CLI for Turf', async () => {
    const res = await runCli(['generate', 'npm:@turf/turf', '--targets', 'mcp,cli', '--output', './generated/turf-tools']);
    expect(res.exitCode).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/e2e/turf-e2e.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Turf golden example, write documentation, package verification, and release-readiness review**

Build complete Turf golden example; write `README.md`, `LICENSE` (Apache-2.0 as indicated in design), `docs/architecture.md`, `docs/security.md`; verify all 14 acceptance criteria in Section 14.

- [ ] **Step 4: Run full test suite and quality gates**

Run: `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build`
Expected: ALL PASS

- [ ] **Step 5: Commit Phase 10**

```bash
git add README.md LICENSE docs/ examples/ tests/e2e/
git commit -m "docs(release): add Turf golden example, architecture/security docs, and release checklist"
```

---

## Self-Review Checklist & Acceptance Criteria Mapping

| Spec Acceptance Criterion (Section 14) | Mapped Tasks & Tests |
|---|---|
| 1. `inspect npm:@turf/turf` without executing code / no AI key | Task 2, Task 3, Task 10 (`tests/source/source-resolver.test.ts`, `tests/e2e/turf-e2e.test.ts`) |
| 2. `inspect ./path` and public GitHub snapshot without running scripts | Task 2 (`tests/source/source-resolver.test.ts`) |
| 3. `inspect --write-overrides` produces `sdk-anything.overrides.json` | Task 4 (`tests/manifest/overrides.test.ts`) |
| 4. `generate ... --targets mcp,cli` creates manifest, TS code, tests, consumer `SKILL.md` | Task 6, Task 7 (`tests/generators/mcp-generator.test.ts`, `tests/generators/cli-generator.test.ts`) |
| 5. Both adapters share client init, input validation, caps, errors, and policy | Task 5, Task 6, Task 7 (`tests/runtime/runtime.test.ts`) |
| 6. Manifest models functions and class/factory clients with credential references | Task 4, Task 5 (`tests/manifest/manifest.test.ts`) |
| 7. Synthetic client-SDK fixture demonstrates construction, auth refs, async HTTP, pagination, errors | Task 9 (`tests/fixtures/client-sdk/`, `tests/security/security-and-sandbox.test.ts`) |
| 8. AI assistance works with OpenAI-compatible endpoint; clear errors on failure | Task 8 (`tests/ai/ai-proposal.test.ts`) |
| 9. Deterministic inspection, overrides, validation, generation work without AI credentials | Task 3, Task 4, Task 6, Task 7, Task 8 (`tests/ai/ai-proposal.test.ts`) |
| 10. No multi-step composites generated in v0.1 | Task 4, Task 7 (`tests/manifest/manifest.test.ts`, `tests/generators/consumer-skill.test.ts`) |
| 11. Writes/destructive/unknown disabled by default; runtime enforces policy | Task 4, Task 5 (`tests/runtime/runtime.test.ts`) |
| 12. Static verification works without container; sandbox fail-closed; trusted-local labelled | Task 9 (`tests/security/security-and-sandbox.test.ts`) |
| 13. Turf example demonstrates operation through both generated interfaces | Task 10 (`tests/e2e/turf-e2e.test.ts`) |
| 14. Documentation covers limitations, patterns, overrides, security boundaries, generated vs tested | Task 10 (`README.md`, `docs/architecture.md`, `docs/security.md`) |
