# Phase Index

Run phases in order. `00-ORCHESTRATOR.md` is the master; it loads common rules and this phase prompt list.

| Phase | Prompt | Deliverable |
|---|---|---|
| 00 | `PHASE-00-PLAN-AND-REPO-AUDIT.md` | Safe repo baseline, detailed plan, state and journal |
| 01 | `PHASE-01-BOOTSTRAP-CLI-AND-QUALITY-GATES.md` | TypeScript project, CLI shell, working test/typecheck/lint/build gates |
| 02 | `PHASE-02-SOURCE-RESOLUTION.md` | Safe npm/local/GitHub source resolver |
| 03 | `PHASE-03-STATIC-ANALYZER-AND-EVIDENCE.md` | Deterministic TypeScript/JavaScript evidence inventory |
| 04 | `PHASE-04-MANIFEST-OVERRIDES-AND-POLICY.md` | Manifest v1 schema, overrides, stable serialization and effect policy |
| 05 | `PHASE-05-SHARED-RUNTIME-CLIENT-LIFECYCLE.md` | Shared invocation, client setup, auth references, caps, errors and policy |
| 06 | `PHASE-06-MCP-GENERATOR.md` | Generated, compiling MCP server |
| 07 | `PHASE-07-CLI-GENERATOR.md` | Generated CLI and MCP/CLI parity |
| 08 | `PHASE-08-AI-ASSISTANCE-AND-SKILL.md` | Optional AI proposal adapter plus generator Skill |
| 09 | `PHASE-09-CLIENT-FIXTURE-SANDBOX-SECURITY.md` | Client SDK fixture, test modes and security tests |
| 10 | `PHASE-10-TURF-E2E-DOCS-PACKAGING-FINAL-REVIEW.md` | End-to-end proof, docs, packaging and final verification |
