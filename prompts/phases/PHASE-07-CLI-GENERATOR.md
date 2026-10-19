# Phase 07 — CLI Generator and Adapter Parity

**Goal:** Generate readable CLI commands from the exact same manifest/runtime operations as MCP.

**Required skills:** `test-driven-development`, `code-review-and-quality`, `conventional-commit`.

## Scope

- One stable command name per enabled atomic operation, derived from a stable operation ID. Document collision handling and ensure deterministic names.
- Support human-readable output and `--json`; stable exit codes and machine-readable error envelope.
- Validate all input before execution and call the shared runtime contract.
- Enforce the same read/write/destructive/unknown policy as MCP. Interactive destructive confirmation only in a true interactive terminal; never treat absent stdin as confirmation.
- Avoid placing secret values in command-line arguments/help output where possible; resolve secrets via env/config references.
- Make generated CLI's help show operation description, parameters, requirements, effects, and limitations.

## TDD tasks

Assert command registration parity with manifest, deterministic naming, JSON output, invalid input exits non-zero, policy denied before SDK invocation, non-interactive destructive operations are denied without explicit configuration, error redaction, and generated project compiles.

## Acceptance criteria

- Generated CLI works via Node with documented examples.
- At least one Turf operation runs correctly through CLI.
- Tests prove MCP and CLI expose same enabled operation set and enforce identical policies.
