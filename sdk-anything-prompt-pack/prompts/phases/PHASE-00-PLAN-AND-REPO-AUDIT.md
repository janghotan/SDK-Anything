# Phase 00 — Plan and Repository Audit

**Goal:** Establish a safe, traceable implementation workspace and a self-reviewed implementation plan from the approved spec.

**Required skills:** `using-superpowers`, `writing-plans`, `using-git-worktrees` if creating an isolated branch/worktree, `codebase-design`.

## Steps

1. Read the approved spec and common rules fully. Inspect repository files, Git status, branch, remotes, upstream, commit history, and package/tool versions. Capture pre-existing uncommitted work. Do not clean, reset, overwrite, or assume empty state.
2. If there is no SDK-Anything repo and the directory is empty/dedicated, scaffold here. If this is an unrelated workspace, use a separate clear subdirectory only if that is safe; otherwise report a blocker.
3. Resolve the canonical repository spec path. Keep the prompt-pack spec as reference, copy the approved spec into `docs/superpowers/specs/2026-10-18-sdk-anything-design-revised.md` only if not already present, and document any duplicate to avoid future drift.
4. Create `SDK_ANYTHING_AUTONOMOUS_STATE.md` from the state template and `docs/implementation/phase-log.md` with the current baseline and repo facts. Record branch/remote availability without recording credentials.
5. Use the `writing-plans` skill to write `docs/superpowers/plans/2026-10-18-sdk-anything-implementation-plan.md`. The plan must define exact modules, interfaces, tests, phase dependencies, commands, security tests, and phase commits. Don't turn it into code or include features outside v0.1.
6. Self-review the plan against the complete specification and map every acceptance criterion in Section 14 to specific tasks/tests; fix any gaps. Include five review-focus failure classes and pin them to specific test tasks: malicious/untrusted input; incomplete/complex types; client construction/secret config; unbounded pagination/errors; generated MCP/CLI policy drift.
7. Initialize Git only if appropriate. If branch is unprotected and current changes are safe, use a dedicated working branch where sensible. Do not create a remote or publish a repository.
8. Commit only newly created plan/state/docs if safe and passing any markdown/lint checks. Use conventional commit. Push only if a safe configured remote/branch exists.

## Acceptance criteria

- Approved spec in repository is clearly identified.
- Plan is concrete and self-reviewed.
- Existing user work is preserved.
- Branch, remotes, and push status documented.
- State and phase journal exist and can resume the workflow.
- No product implementation code is written in this phase.
