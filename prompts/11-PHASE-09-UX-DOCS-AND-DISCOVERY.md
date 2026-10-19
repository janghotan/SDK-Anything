# Phase 09 — CLI UX, Documentation, Demos and Open-Source Adoption

## Goal
Make the project understandable and credible to a developer encountering it for the first time. Polish is valuable only after actual functionality works.

## Implement
1. Audit every public command for naming, help, examples, defaults, JSON mode, exit codes and errors. Keep commands consistent and composable in shell/agent workflows.
2. Make output concise for humans but structured for tools. Use stderr for progress, stdout for result/JSON; no decorative banners inside machine-readable output.
3. Ensure diagnostics tell users: what failed, where, why it matters, how to fix it and whether generation can continue.
4. Rewrite README to clearly answer: what it does, why SDKs differ from OpenAPI, supported input scope, safety model, generated outputs, limitations and a short concrete quickstart. Keep bilingual README consistent if bilingual docs are maintained.
5. Document architecture and trust boundaries without overclaiming. Add CLI reference, manifest reference, override guide, unsupported-features page, troubleshooting, AI privacy, sandbox semantics, regeneration and release/install guide.
6. Create realistic demonstrations:
   - quick pure-function conversion using Turf;
   - authenticated stateful SDK showing initialization, environment secret, pagination and redacted errors;
   - unresolved type repaired through override and then invoked;
   - MCP client actually calls the generated tool;
   - destructive operation denied before explicit opt-in.
7. Make demo scripts runnable in CI with deterministic fixtures and capture terminal output/screenshot assets only when genuine and useful. Never fabricate demo output.
8. Add a concise architecture diagram if it explains the manifest-centered pipeline and generated artifacts.
9. Add contribution docs: architecture map, adding fixture, running compatibility tests, coding/test commands, branch/commit conventions and responsible security reporting.
10. Avoid hype claims such as “works with every SDK.” Publish compatibility scorecard and known limits from the automated runner.

## Exit criteria
A new developer can understand the differentiation in under a minute and reproduce at least one real end-to-end demo without unexplained manual setup. Docs and examples are tested against current CLI behavior.
