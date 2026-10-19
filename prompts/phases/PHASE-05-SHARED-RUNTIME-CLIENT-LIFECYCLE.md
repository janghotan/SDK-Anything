# Phase 05 — Shared Runtime, Client Lifecycle, and Policy Enforcement

**Goal:** Build the single invocation layer consumed by both generated adapters, including client construction, input validation, secrets, result normalization, limits, and policy checks.

**Required skills:** `test-driven-development`, `systematic-debugging`, `codebase-design`, `verification-before-completion`.

## Scope

- Define a narrow generated-runtime contract. MCP and CLI adapters must delegate execution to it, not duplicate semantics.
- Support evidenced construction modes: none/module-level, class constructor, and factory. Ambiguous patterns require overrides and stay unavailable until resolved.
- Resolve credential values at runtime from environment/config references; never persist or print them. Use an allowlisted environment/config path and test redaction.
- Validate inputs against manifest schema before SDK calls.
- Normalize expected errors into stable classes: invalid input, policy denied, auth/unauthorized, not found, rate limited, timeout, SDK/network error, unsupported operation, and unexpected runtime error. Do not expose stack traces/secrets by default.
- Enforce operation policies in the runtime. Read/pure only when verified; write/destructive/unknown disabled unless configuration enables them. Destructive CLI call gets interactive confirmation in an interactive terminal; non-interactive use requires explicit configured opt-in.
- Add request timeouts and bounded output serialization. Enforce page count and byte size caps; do not silently drain unbounded iterators.

## TDD tasks

Create a deterministic fake client and loopback HTTP fixture. Test class and factory instantiation, required/missing environment credentials, no secret leak in errors, validation before invocation, disabled write/destructive/unknown operations, timeouts, paginated cap enforcement, error normalization, and stable JSON serialization.

## Acceptance criteria

- Invocation contract can be used by both adapters without adapter-specific operation behavior.
- Failed policy check proves the underlying SDK method was not called.
- Credentials are resolved only at runtime and are absent from generated artifacts/logs/errors.
- Bounded result behavior is testable and explicit.
