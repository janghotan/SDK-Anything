# Phase 10 — Turf E2E, Docs, Packaging, and Final Review

**Goal:** Demonstrate the complete product, document its actual limits, verify installability, and complete release-readiness checks without publishing a package or release.

**Required skills:** `create-readme`, `code-review-and-quality`, `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`, `shipping-and-launch`; use `conventional-commit` for any final fixes.

## Scope

- Complete Turf golden example with manifest, generated MCP, generated CLI, consumer `SKILL.md`, representative expected output, and deterministic tests.
- Complete local client-SDK example using the fixture from Phase 09.
- README with quick start, install, supported inputs, generated outputs, examples, AI config/privacy disclosure, overrides, policy model, verification modes, sandbox prerequisites, limitations, troubleshooting, and contributor instructions.
- Architecture/security docs: data flow, trust boundaries, AI inputs, secret handling, effect classification, sandbox claims, dependency/version pinning, and error model.
- Generated project install/build/test smoke test in a temporary clean directory using the documented instructions, without executing untrusted lifecycle scripts.
- Review package contents for accidental secrets, local files, absolute paths, user names, internal hostnames, or development tokens. Run available secret scanning.
- Verify the repo LICENSE decision, package name/metadata, README commands, and CI workflow; do not publish npm package, create GitHub release/tag, change remote repo visibility, or enable external service without separate authorization.
- Load `shipping-and-launch` to generate a release-readiness checklist and explicitly label what is and is not being shipped.

## Final test matrix

Run and record actual results for:

1. formatter/linter;
2. TypeScript typecheck;
3. all unit tests;
4. golden tests and deterministic generation;
5. static security/negative tests;
6. generated MCP server compile + at least one operation invocation through test harness;
7. generated CLI build + at least one Turf operation;
8. client-SDK fixture end-to-end for client construction, auth reference, async HTTP, pagination bounds, normalized/redacted errors;
9. no-AI flow;
10. mocked OpenAI-compatible provider flow;
11. static verification with sandbox runtime unavailable;
12. Docker/Podman sandbox tests if runtime is available (otherwise record not run and test the fail-closed path);
13. clean generated-output install/build/test smoke test.

## Acceptance criteria

- Every spec acceptance criterion has a test or an explicit, justified deferral.
- No unsupported SDK patterns are claimed as supported.
- No AI output becomes executable without validation/review policy.
- All generated outputs are manifest-derived and parity-tested.
- README claims match actual behavior and test evidence.
- Full review finds no known blocker/security issue; any issue is fixed or clearly recorded.
- Final commits are conventional and push status is accurate.
- Release-ready report is produced, but no release/package is published without separate authorization.
