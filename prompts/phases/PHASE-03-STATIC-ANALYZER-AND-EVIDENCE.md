# Phase 03 — TypeScript/JavaScript Analyzer and Evidence Inventory

**Goal:** Produce a deterministic inventory of public exports, type/signature facts, documentation, class/factory client patterns, and source provenance.

**Required skills:** `test-driven-development`, `codebase-design`, `systematic-debugging`.

## Scope

- Use TypeScript Compiler API for TypeScript and declaration analysis; support JavaScript with available `.d.ts`/JSDoc where possible.
- Do not import or execute target package code. Analyze a program/project configured so dependency resolution and declarations can be read without executing modules.
- Represent evidence distinctly from AI proposals.
- Record exports, module path, call kind (top-level function/class/factory/instance method where evidenced), parameter and return type summaries, optional/required status, overloads, JSDoc excerpts/references, source file/ranges, confidence/known limitations.
- Resolve supported common types to JSON Schema; keep unsupported/generic/circular/ambiguous shapes unresolved rather than degrading silently to `{type: "object"}`.
- Include a curated analyzer fixture set: aliases, enums, optional fields, unions, literal unions, generics, `Omit`/`Partial`, overloads, `any`, `Record<string, unknown>`, circular refs, async functions, class clients, factories, and incomplete JavaScript/JSDoc.

## TDD tasks

1. Pin representative source fixture and expected evidence inventory.
2. Implement export/signature extraction and stable symbol identifiers.
3. Implement conservative JSON-schema lowering for explicitly supported types.
4. Implement unresolved diagnostics for unsupported or ambiguous types.
5. Implement class/factory and instance-method evidence without guessing lifecycle details.
6. Verify deterministic output and provenance source references.

## Acceptance criteria

- Repeated analysis on identical source produces byte-stable canonical evidence (ignoring non-semantic timestamps; ideally don't include them).
- No execution/import of target modules during analysis.
- Unsupported patterns surface precise unresolved status plus symbol/source location.
- Evidence is a hard input for manifest/AI stages, not mutable model output.
