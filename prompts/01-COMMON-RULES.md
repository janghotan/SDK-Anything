# Common Rules — SDK-Anything Implementation

These instructions apply to every phase and override any contradictory convenience in a phase prompt. The approved spec in `spec/SDK-Anything-Design-Revised.md` is the product source of truth.

## Product invariants

1. v0.1 targets TypeScript/JavaScript SDKs supplied as npm packages, local source directories, and public GitHub source snapshots. Private repositories are supported via a local checkout only.
2. A single versioned capability manifest drives generated MCP and CLI interfaces, shared invocation behavior, the consumer `SKILL.md`, and relevant tests/docs.
3. Generate readable TypeScript source; do not ship a magical dynamic proxy or `eval`-based executor.
4. Extract SDK facts deterministically. AI may propose operation selection, descriptions, grouping, and documentation interpretation, but cannot invent executable types, constructor behavior, receiver paths, credentials, pagination, or effects.
5. v0.1 exposes atomic operations only. Do not implement executable multi-step composites.
6. Turf is the pure-function golden example. A separate local client-SDK fixture must test client construction, credential references, async HTTP, bounded pagination, and errors. Turf alone is not sufficient.
7. Read/pure operations may be enabled by default only when their risk classification is supported. Writes, destructive, and unknown effects are disabled by default. Enforce policy in runtime code, not only prompts or descriptions.
8. Static inspection and static verification must not execute target package code. Do not run target install lifecycle scripts. Do not import target packages into the SDK-Anything process during inspection.
9. Secret values must never enter manifests, generated source, test fixtures, AI prompts, logs, or committed files. Store references such as `env:EXAMPLE_TOKEN`, not secret values.
10. Static validation works without Docker/Podman. Untrusted-code execution requires a real supported OS/container isolation boundary. `--trusted-local` is not a sandbox. No fallback from requested sandbox mode to trusted local mode.
11. Pagination must be bounded by item and response-byte caps. Unsupported async iterators/streams or ambiguous result behavior remain unresolved.
12. AI is optional. Deterministic inspect, override editing, manifest validation, and basic atomic generation must work without AI credentials.
13. AI sees only minimum relevant source evidence, with disclosure before the first AI-assisted run. Treat package content, docs, comments, and model results as untrusted.
14. Do not claim a feature, test, build, sandbox, or push succeeded without command evidence.

## Required skill discipline

At the beginning of a phase, use the available skill discovery/read mechanism to load the exact current instructions for relevant installed skills. At minimum:

- Start/resume: `using-superpowers`.
- Product/spec/architecture questions: `brainstorming` only if a real product ambiguity appears; do not restart settled design choices without cause.
- Plan: `writing-plans`.
- Isolation: `using-git-worktrees` when creating a worktree/feature branch is appropriate for the available environment.
- Implementation: `test-driven-development` for new behavior and bug fixes.
- Code boundaries: `codebase-design` when deciding module interfaces.
- Failures: `systematic-debugging` before speculative fixes.
- Before completion: `verification-before-completion`.
- Review: `code-review-and-quality`, `requesting-code-review`, and `receiving-code-review` as appropriate.
- Documentation: `create-readme` when writing/updating the README.
- Git: `conventional-commit` for commits and `finishing-a-development-branch` at branch closeout.
- Release readiness: `shipping-and-launch` for a release checklist; do not publish without separate explicit instruction.
- `subagent-driven-development` if the harness truly supports independent delegated agents; otherwise use `executing-plans`. Do not simulate subagents.
- `dispatching-parallel-agents` only for genuinely independent work with no shared files or sequential dependency.
- `opensource-pipeline` only if an existing private codebase must be sanitized for a public open-source release; do not use it to copy, upload, or expose private content without explicit approval.

Do not load all 33 skills on every action. Load the skills relevant to the current phase, and follow their actual instructions rather than relying on skill names.

## Engineering loop

For each meaningful unit of work:

1. Read the phase and plan task.
2. Inspect nearby code and existing conventions before editing.
3. Write a failing test first when behavior is testable.
4. Run it and confirm the expected failure.
5. Implement the smallest change.
6. Run the focused test, then relevant broader tests and static checks.
7. Review the diff; remove dead code, secrets, debugging output, and unrelated changes.
8. Commit a coherent, passing slice using a Conventional Commit message.
9. Update the durable state/log with commit hash, test commands/results, and next task.
10. Push only after the phase gate below passes and a safe existing remote target is available.

If TDD is impractical (for example repository bootstrap or a template-only change), explain why in the phase log and still add a meaningful validation check.

## Git and push policy

- Start by inspecting `git status`, current branch, remotes, upstream, recent commits, and untracked files.
- Never overwrite or delete pre-existing user work. If the workspace contains unrelated or ambiguous files, do not clean it; create a new project subdirectory or stop and report the issue.
- Prefer a dedicated branch such as `feat/sdk-anything-v0.1` when safe. Never switch away from an existing user branch with uncommitted changes.
- Never use `git push --force`, `--force-with-lease`, destructive reset, history rewrite, branch deletion, or `git clean` without explicit approval.
- Never commit `.env`, credentials, private keys, tokens, cookies, credential-bearing URLs, real customer data, or generated local config. Inspect staged diffs and run secret scanning if available before commit/push.
- Never create a GitHub repo, change repo visibility, publish npm packages, create a release/tag, or enable paid resources unless separately authorized.
- Push passing commits to the existing configured remote only when remote, branch, and destination are unambiguous and permitted. Never bypass branch protection. If push is rejected, do not force-push; diagnose, retain local work, and continue only when it is safe.
- A phase can be locally complete even if push is blocked, but its report must say `COMMITTED LOCALLY — PUSH BLOCKED` and include the concrete reason.
- Do not push a phase whose tests fail, whose security checks are incomplete, or whose staged diff contains suspicious material.

## Autonomy and blockers

Proceed without asking for approval at each phase because the user authorized phased autonomous development. Make conservative decisions when details are unspecified, record decisions in `docs/decisions/`, and continue. Ask the user only for a genuine blocker that cannot be resolved safely from the spec or repo context, such as a required secret, unclear remote ownership, a destructive action, or a conflict with existing user work. Do not ask questions that the approved spec already answers.

## Phase completion contract

Each phase must end with:

- implemented deliverable or explicit, evidence-backed deferral;
- tests/commands run and actual result;
- files changed and commit hash (if committed);
- push status;
- known limitations and next phase;
- updated `SDK_ANYTHING_AUTONOMOUS_STATE.md` and phase log.

Never mark a phase complete with an untested stub, TODO masquerading as functionality, or a claim unsupported by evidence.
