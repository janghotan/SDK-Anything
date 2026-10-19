# Shared Engineering Contract

## Product statement
SDK-Anything converts SDKs—not just API descriptions—into agent-native capabilities. It inspects TypeScript/JavaScript packages or source, derives a portable manifest, and generates usable MCP and CLI interfaces plus an agent-facing skill. SDK semantics such as client construction, credential references, pagination, errors, asynchronous I/O and operation effects matter.

## Hard constraints
- TypeScript/JavaScript only for this mission. npm package, local directory and public GitHub snapshot are input targets.
- Static inspection must not run target package code or install target dependencies in a way that triggers lifecycle scripts. Don't require network access to analyze local source.
- Use deterministic static analysis first. AI may propose interpretations, never silently replace compiler-derived facts or authorize execution.
- Manifest is the single source of truth for generated artifacts. Use a documented versioned schema and deterministic canonical serialization/digests.
- Generate atomic operations only. Avoid composite task generators for the initial product; agent orchestration is downstream.
- Generated artifacts must be readable, editable, self-contained to the extent promised, and compile/run outside the SDK-Anything repository.
- No embedded credentials. Manifest stores secret references, such as an environment variable name, never secret values. Redact values from logs/errors/output.
- Read/pure operations may be available under policy. Writes, destructive or unknown effects are disabled by default and require explicit policy. Noninteractive execution must fail closed. Explicit opt-in is not equivalent to safety approval.
- Static verification, isolated container execution and trusted-local execution are different modes. Name and document them honestly. If the requested sandbox cannot be provided, fail closed with an actionable message; do not quietly run on host.
- Keep the Turf pure-function example, but never treat it as the only compatibility proof. The authenticated paginated loopback client fixture is required and must actually be invoked by generated MCP/CLI artifacts.
- No architecture rewrite without clear repository evidence and a concrete payoff. Extend existing boundaries where sound.
- Do not copy third-party code, plugin assets, branding, prose or proprietary workflows from CLI-Anything. Learn from its general product pattern: complete harnesses, installable integration, detailed agent guidance, demonstrations and reproducible per-target examples.

## Engineering method
- Use test-driven development for bug fixes and behavior changes: failing test, implementation, focused tests, regression coverage.
- Acceptance test should assert externally observable behavior, not merely private helper output.
- Prefer process-level integration tests on generated projects, in temporary workspaces outside the source repository.
- Use deterministic local fixtures and loopback servers; do not require paid services or live credentials for default CI.
- Test clean installs from the packed artifact, not only workspace imports.
- Every discovered incompatibility gets either a fix, an explicit unsupported diagnostic, or a documented tracked deferral with rationale. Never claim universal compatibility.
- Do not silently swallow unsupported types/exports. Surface source location, reason, confidence/evidence, suggested override and impact on generation.
- Overrides must be validated, versioned/documented, stable, human-readable and never require modification of target SDK source.
- Avoid overbroad `any`, `@ts-ignore`, skipped tests, fake green paths and snapshots standing in for functional behavior.
- Keep runtime behavior and policy semantics aligned across generated CLI and MCP surfaces.
- Use Conventional Commits on a feature branch. Do not rewrite history/force push.

## Quality levels
- Unit: individual algorithms and validators.
- Integration: collaborating subsystems (resolver + analyzer, manifest + generator, runtime + policy).
- End-to-end: CLI against real fixture SDKs creates files that compile and execute from an external workspace; MCP transport uses an MCP client and invokes tools; validate/test commands give truthful results.
- Compatibility: more than one API shape and more than one SDK pattern.
- Security: adversarial inputs, traversal, secrets, unsafe effects, untrusted source comments/README, hostile output and generated code path confinement.
- Distribution: npm tarball install works independent of repository.
- Documentation truth: all quickstarts are run exactly as documented.

## Definition of done for every slice
1. Acceptance criteria stated.
2. Regression test reproduces prior failure and passes.
3. Production code implements the behavior fully, including errors/edge cases.
4. Public CLI or generated artifact path exercised where relevant.
5. Typecheck/lint/format/build and relevant tests pass.
6. Docs, diagnostics and examples are updated.
7. State/journal and evidence are updated.
8. No known critical defect introduced and no misleading claims.
