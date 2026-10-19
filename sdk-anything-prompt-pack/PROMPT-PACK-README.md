# SDK-Anything Autonomous Implementation Prompt Pack

This pack is designed for DeepSeek Harness to implement SDK-Anything in phases, using the approved architecture, the available Superpowers skills, continuous testing, and phase-level commits.

## What is included

- `prompts/00-ORCHESTRATOR.md` — the master prompt to paste into a fresh DeepSeek Harness project session.
- `prompts/01-COMMON-RULES.md` — persistent implementation, security, test, Git, and reporting rules.
- `prompts/02-STATE-TEMPLATE.md` — template for the orchestrator's durable progress file.
- `prompts/phases/PHASE-00-...md` through `PHASE-10-...md` — ordered phase prompts. The orchestrator loads and executes these one at a time.
- `spec/SDK-Anything-Design-Revised.md` — the approved product and architecture spec that all work must follow.

## How to run

1. Open the actual SDK-Anything repository/workspace in DeepSeek Harness. If no repository exists, create/open a dedicated empty directory. Do not run the pack inside an unrelated repo.
2. Copy the contents of this pack into the root of that SDK-Anything workspace so `prompts/`, `spec/`, `START-HERE.md`, and `PROMPT-PACK-README.md` are visible to Harness. The pack README is intentionally named `PROMPT-PACK-README.md` so it cannot overwrite the product's future `README.md`.
3. Keep `spec/SDK-Anything-Design-Revised.md` intact. It is included in the pack.
4. Paste the complete contents of `prompts/00-ORCHESTRATOR.md` as the first instruction.
5. Let the orchestrator work. It will create `docs/superpowers/plans/2026-10-18-sdk-anything-implementation-plan.md`, `SDK_ANYTHING_AUTONOMOUS_STATE.md`, a phase log, and commits as it proceeds.
6. If the session is interrupted, resume by pasting the “Resume” instruction at the bottom of the orchestrator prompt. Do not restart from Phase 00 unless state recovery says to.

## Repository and remote behavior

The pack authorizes autonomous local implementation, testing, commits, and pushes to the repository's existing, already-configured remote **only when the destination is unambiguous and the current branch is an appropriate working branch**. It does not authorize creating a new public repository, changing visibility, force-pushing, bypassing branch protections, deleting branches, or publishing packages/releases. If no safe remote/branch target exists, keep commits locally, continue work, and report the blocker at the next checkpoint; ask only if the block truly prevents further progress.

## Important operating principle

“Autonomous” means the agent makes ordinary engineering decisions and keeps moving without asking for permission after every phase. It does **not** mean ignoring tests, hiding uncertainty, weakening security, or performing irreversible publication steps. Each phase must end in a verified state and a concise report.

## Prompt pack maintenance

If a spec change is approved later, update the spec copy, phase prompts that depend on it, and this README. Never silently drift from the approved spec.
