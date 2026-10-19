# Phase 11 — Release-Candidate Gate With Actual Product Evidence

## Goal
Prove that a clean user can install and use the product, and that generated artifacts behave correctly—not simply that the monorepo builds.

## Execute
1. Start from a clean working tree and record exact commit, branch, OS, Node, pnpm/npm, TypeScript version and container runtime availability.
2. Run formatting, strict typecheck, lint, all unit/integration tests, full compatibility lab, production build and npm pack dry-run.
3. Install the produced package/tarball into a fresh temporary consumer project with no workspace links; run `sdk-anything --help`, inspect fixture, generate artifacts, build generated project and invoke CLI.
4. Execute the authenticated loopback SDK end-to-end: constructor options, synthetic API key via env reference, request, pagination cap, API error and redaction. Verify no secret in manifest/reports.
5. Generate and invoke through actual MCP client protocol; verify advertised schemas, result shape, tool error handling and resource shutdown.
6. Exercise override workflow on unresolved exports/types and prove a newly enabled operation is usable, properly classified and traceable to reviewed override.
7. Execute effect-policy matrix in CLI and MCP: pure/read path works, write/destructive/unknown denied by default, noninteractive path fails closed, explicit policy has intended behavior.
8. Execute static verify, container sandbox when available, trusted-local explicitly labeled and missing-container requested-sandbox fail-closed case.
9. Verify clean package has no tests/fixtures/internal prompt pack/secrets, no required file omitted, no accidental host path and valid license metadata.
10. Verify CI workflow on supported Node versions. Inspect real CI status rather than infer from local run.
11. Run documented README commands exactly. Fix documentation mismatches.
12. Review diff and dependencies for abandoned code, TODO stubs, `skip`/`only` tests, catch-and-ignore errors, unreachable public commands, unverified compatibility claims and security regression.
13. Write `docs/implementation/release-evidence.md` with evidence matrix, exact commands/outcomes, environment, generated project paths (sanitized), representative outputs, known limits and go/no-go verdict.
14. Prepare a candidate tag/version suggestion only. Do not publish npm package, push a release tag, create a GitHub release or merge branches without explicit authorization.

## Evidence table schema
For every gate include: ID, behavior, command/script, environment, result, link/path to evidence, and unresolved limitation. Include expected failures as PASS only when the failure is the intended safe behavior and the output is asserted.

## Exit criteria
All locally executable mandatory gates pass. Any non-local gate is documented as BLOCKED with proof of safe fail-closed behavior and must not be mislabeled PASS. No unresolved P0/P1 issue remains.
