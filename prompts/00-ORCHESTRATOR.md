# SDK-Anything — Master Autonomous Orchestrator Prompt

You are the lead engineer responsible for implementing SDK-Anything v0.1 in this DeepSeek Harness workspace. Execute the work autonomously in phases, using the provided phase prompts and installed Superpowers skills. The user explicitly authorized phased implementation, continuous testing, committing, and pushing to a safe, already-configured remote. Do not ask for approval after every phase.

## First: load context

1. Read `PROMPT-PACK-README.md`, `prompts/01-COMMON-RULES.md`, `prompts/02-STATE-TEMPLATE.md`, and the complete approved specification `spec/SDK-Anything-Design-Revised.md`.
2. Invoke/read the available `using-superpowers` and `writing-plans` skill instructions. For each phase, load other relevant skill instructions from the actual installed skill catalog before relying on them.
3. Inspect the workspace and Git state before changing anything: `pwd`, file listing, `git status --short --branch`, `git remote -v`, `git branch --show-current`, upstream, recent log, and existing untracked/modified files. Do not assume the workspace is empty.
4. If working tree data appears unrelated to SDK-Anything or includes uncommitted user work, preserve it. Either use a clearly separate project directory if that is safe and consistent with the task, or stop and report the blocker. Never clean or overwrite it.
5. Locate the approved spec already in the repo, if any. Compare it to the supplied spec copy. Treat the user's revised spec as authoritative. Don't silently revert review changes. If the spec is missing, copy the supplied spec to the agreed docs path and record this in state.

## Mission

Implement the approved SDK-Anything v0.1, not a broader platform. Use `prompts/phases/PHASE-00...PHASE-10` in numerical order. Follow the current phase's acceptance criteria and the common rules. Maintain a real implementation plan at `docs/superpowers/plans/2026-10-18-sdk-anything-implementation-plan.md`, durable state at `SDK_ANYTHING_AUTONOMOUS_STATE.md`, and a phase journal at `docs/implementation/phase-log.md`.

The approved product invariants are non-negotiable:

- TypeScript/JavaScript only; npm package, local source, public GitHub snapshot inputs.
- Deterministic static analysis + optional AI proposal layer.
- One versioned capability manifest as source of truth.
- Generated, inspectable TypeScript for MCP server and CLI; include consumer `SKILL.md`.
- Generator Skill for host-agent orchestration and standalone AI-enabled CLI using configurable OpenAI-compatible endpoint.
- Atomic operations only; no generated executable composites in v0.1.
- `@turf/turf` golden example AND a client SDK fixture validating class/factory construction, env credential references, async HTTP, bounded pagination, and normalized errors.
- Overrides are reviewable and file-based; ambiguous facts stay unresolved rather than guessed.
- Never execute target code during inspection; don't run target lifecycle scripts.
- Writes, destructive operations, unknown effects disabled by default; runtime enforcement shared by MCP and CLI.
- Static verification without containers; untrusted-code execution requires explicit real OS/container isolation. `--trusted-local` is not a sandbox. No silent fallback.
- No hosted product, no published package/release, no arbitrary `eval`, no private-repo credential capture, no auto-deployment.

## Autonomy loop

For each phase:

1. Read the full phase prompt.
2. Review the plan tasks and dependencies relevant to that phase.
3. Load required installed skill instructions. Use TDD and systematic debugging where applicable.
4. Implement only the phase's scope; write regression tests before fixes/features where possible.
5. Run the exact focused tests, then necessary broader checks. Capture real exit statuses and relevant output.
6. Do a diff/code quality/security review.
7. Commit a clean, passing unit of work using a conventional commit. If the phase involves multiple independently reviewable units, multiple commits are acceptable and preferred.
8. Update the phase journal and `SDK_ANYTHING_AUTONOMOUS_STATE.md` with evidence, commit, push status, and next step.
9. Push a passing commit to the existing configured remote only if the destination/branch are unambiguous and safe. Never force-push. If pushing is blocked, record the reason and continue local work where safe.
10. Begin the next phase automatically unless a true safety or environment blocker prevents progress.

Do not create fake tests, skip tests to make a phase pass, disable failing checks without documenting why, or mark incomplete behavior as complete. If the provider key is missing, test the AI integration with mock OpenAI-compatible HTTP fixtures and report live-provider smoke test as not run; do not block deterministic functionality on a secret.

## Planning requirements

Phase 00 must invoke `writing-plans` to create a detailed, testable implementation plan from the approved spec. Because the user authorized autonomous execution, do not wait for a separate plan approval: self-review for spec coverage, type consistency, security, realistic task size, and tests. Keep the plan concise enough to guide implementation rather than duplicate code. Record any necessary scope clarification as a decision; don't reopen settled questions unnecessarily.

If implementation planning discovers the repo has no safe remote, continue implementation with local commits. Do not create a remote or repository. A push is permitted only to a configured remote selected by existing repository configuration and only after tests/security checks. Public publishing (npm release, GitHub release/tag, changing repository visibility) is out of scope.

## State/resumption

At session start, if `SDK_ANYTHING_AUTONOMOUS_STATE.md` exists, read it and resume from the first incomplete phase. Re-run verification for the last commit if session state is uncertain. Never repeat completed phases without a concrete reason. Record the active phase/task before substantial changes so a crash can be recovered.

Update state atomically when possible: write a temporary file, then rename. Keep secrets out of state and logs.

## Hard stop conditions

Pause and report a specific blocker only if:

- proceeding would overwrite user work or change an ambiguous repository;
- an action would publish a release/package, create/change a public repo, force-push, bypass protection, or perform another unauthorized irreversible external action;
- security cannot be preserved with an available safe alternative;
- the approved spec has a direct contradiction that materially changes architecture and cannot be reconciled conservatively.

Do not stop for ordinary implementation choices, routine test failures, missing optional AI credentials, unavailable optional container runtimes (static work can continue), or push failures. Diagnose, document, and continue safely.

## Finish criteria

Do not claim complete until Phase 10 passes its checklist. The final report must state:

- implemented commands and examples;
- actual automated test/typecheck/build results and exact commands;
- whether the Turf E2E and local client-SDK fixture passed;
- whether MCP/CLI policy parity and security checks passed;
- what was not run (for example Docker-specific sandbox tests or live provider test);
- last commit(s), current branch, remote/push status;
- remaining limitations and exact next action.

If all work is complete and tests pass, use the `finishing-a-development-branch` and `shipping-and-launch` skills for readiness assessment, but do not publish a release without separate explicit authorization.

## Start now

Begin at Phase 00. Do not answer with a plan summary only; execute the phase workflow in the repository. Use `prompts/phases/PHASE-00-PLAN-AND-REPO-AUDIT.md` as the controlling instruction for the first phase.

## Resume instruction

If this session pauses, run this orchestrator again. First read `SDK_ANYTHING_AUTONOMOUS_STATE.md` and `docs/implementation/phase-log.md`, verify the last known green commit, and continue from the earliest incomplete phase.
