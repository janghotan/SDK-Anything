# Phase 04 — Generated CLI, MCP Server and Agent Skill Must Work as a Product

## Goal
Treat each output as a product that an agent or developer can actually install, discover and use. Runtime behavior, initialization, errors and policy must match across outputs.

## Generated CLI
- Build coherent top-level help, operation listing, detailed info, JSON input/output, stable exit codes, stdin payload support where useful, validation before invocation, timeouts, redacted errors, clear missing-credential diagnostics and policy controls.
- Ensure command naming collisions are resolved deterministically and visible. Preserve an operation-ID escape hatch for collisions/ambiguous names.
- Keep stdout machine-readable when JSON mode is active; send progress/diagnostics to stderr.
- Support client constructor/factory and required configuration. Validate required values early without printing secrets.
- Test operation execution via the built CLI from a clean directory and using a real child process.

## Generated MCP server
- Use official MCP SDK APIs and protocol-correct transport. Define server identity/instructions, tool names/descriptions/input schemas, list behavior and invocation errors.
- Ensure startup failures are actionable, logs don't corrupt stdio protocol, and secrets are redacted.
- Test via the official MCP client and in-memory transport, plus stdio process smoke where possible. A test that only imports the server module is insufficient.
- Tool descriptions must convey operation intent, key constraints, side effects, required auth references and failure semantics without hallucinating capabilities.

## Generated consumer skill
- Create a practical `SKILL.md` with clear triggers, prerequisites, setup, command discovery, operation-selection strategy, schema usage, output reading, recovery guidance, safety warnings and several realistic atomic-operation examples.
- Do not tell the agent to guess parameters. Instruct it to call list/info/help/validate paths, inspect schemas, use only listed capabilities and stop on authorization/policy denials.
- Include composition guidance for the consumer agent without generating composite code: show safe examples that orchestrate atomic tools only when justified by SDK semantics.
- Ensure every command referenced in the skill exists in the generated deliverable and is verified by an automated doc/command consistency test where feasible.

## Runtime parity
- Share or template the same policy, validation, lifecycle, pagination caps, timeout, output-size and error-redaction semantics across CLI and MCP.
- Explicitly represent pure/read/write/destructive/unknown effects. Default deny write/destructive/unknown unless explicit policy; noninteractive destructive must fail closed.
- Validate outputs if the manifest declares an output schema. Bound response sizes and pagination loops; guard against infinite pages and repeated cursors.
- Correctly dispose clients and transport resources. Avoid leaking sockets/timers after command exit.
- Normalize errors with stable machine codes and useful human messages without leaking tokens, sensitive headers, body secrets or stack contents by default.

## E2E proof
For Turf and the authenticated loopback SDK: independently build generated CLI project, invoke a safe operation, invoke an authenticated operation with a synthetic env secret, verify pagination bounds, cause an SDK error and verify redaction, reject unsafe operation without override, and call a tool through a real MCP client. All generated artifacts must run outside the generator checkout and from the packed/installable output, not import `src/`.

## Exit criteria
The CLI, MCP server and skill are accurate, usable and demonstrably coherent. No generated interface is treated as complete because text files merely exist.
