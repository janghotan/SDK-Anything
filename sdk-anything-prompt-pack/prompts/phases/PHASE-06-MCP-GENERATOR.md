# Phase 06 — MCP Server Generator

**Goal:** Generate inspectable TypeScript MCP server source from the validated manifest and shared runtime contract.

**Required skills:** `test-driven-development`, `code-review-and-quality`, `verification-before-completion`.

## Scope

- Verify current official MCP TypeScript SDK package names, APIs, transport requirements, and stable version from official docs/package metadata at implementation time. Pin a compatible version and add an architectural decision record; don't assume an older API example is current.
- Generate one tool per enabled atomic operation. Do not expose unresolved or disabled operations.
- Derive tool name, description, and input schema from the manifest. Validate MCP-facing input using the same schema/policy/invocation service as CLI.
- Support a documented local transport suitable for the generated command, using the appropriate current official SDK API. Keep transport choice explicit and configurable where necessary.
- Generated source must be readable and editable, include manifest and generator versions, and avoid `eval`/arbitrary dynamic path invocation.
- MCP output errors are structured, safe, and redact secrets.

## TDD tasks

Use a test manifest fixture. Assert tool list matches enabled operations, schemas/descriptions map correctly, unknown/write/destructive operations are hidden or denied according to policy, invocation delegates to shared runtime, and generated project compiles. Test deterministic output.

## Acceptance criteria

- Generated MCP server launches from generated project according to docs.
- A representative Turf operation can be called through an MCP test client or official SDK test harness.
- MCP/CLI policy logic is not duplicated.
- Build/test passes with version-pinned dependencies.
