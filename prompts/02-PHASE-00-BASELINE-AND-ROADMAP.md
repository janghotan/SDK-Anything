# Phase 00 — Baseline Reality, Product Map and Dependency-Ordered Roadmap

## Goal
Establish exactly what currently exists and turn product ambitions into a specific, prioritized implementation plan. This phase must lead directly into implementation; do not stop at an audit report.

## Work
1. Inspect current git branch/status/history/remotes. Confirm whether finish commit `eb5461a` and branch `chore/sdk-anything-v0.1-finish` exist in current checkout/history; don't assume.
2. Inventory source modules, public CLI commands, manifest schema, generated templates, examples, skills, tests, docs, CI and package contents.
3. Execute available formatter, typecheck, lint, tests, build, package dry-run and quickstart. Capture exact command, runtime/package-manager version and outcomes.
4. Run the current actual user path in a clean temporary working directory outside the repository. Test at minimum:
   - inspect Turf and resolve one pure function end to end;
   - inspect the authenticated loopback client fixture, apply/verify overrides where needed;
   - generate CLI/MCP/skill, compile them, invoke safe operations, and inspect error/redaction behavior;
   - connect to generated MCP using an official client transport and invoke a tool;
   - validate and test commands with positive and negative cases.
5. Produce a user-journey map from initial source input to installed/used tool, marking every dead-end, simulated path, misleading label and missing step.
6. Identify the highest-value target user journey and product-level failure clusters. Write acceptance tests or executable scripts for the top critical missing journeys before implementing fixes.
7. Build a dependency-aware plan with phases, changed modules, acceptance tests, risk, exit criteria and estimated order (not fake hour precision).
8. Add `docs/implementation/product-completion-roadmap.md` or update the existing appropriate plan, while keeping internal prompt pack/state out of public docs unless this repository already deliberately versions them.
9. Update `STATE.md` and `IMPLEMENTATION-JOURNAL.md` in the external working pack; if working from the repository, create a repo-local internal state only if appropriate, and don't accidentally publish this private pack.
10. Move into Phase 01 immediately.

## Exit criteria
- Baseline facts confirmed by actual repository and command evidence.
- Current public user journey tested from outside repo.
- At least one concrete behavioral gap recorded with a failing reproduction or acceptance test.
- Prioritized plan with clear product outcomes exists.
- Phase 01 starts during the same run; no audit-only stopping point.
