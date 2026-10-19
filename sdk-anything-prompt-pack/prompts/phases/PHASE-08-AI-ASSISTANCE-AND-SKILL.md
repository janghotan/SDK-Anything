# Phase 08 — AI Proposal Layer and Generator Skill

**Goal:** Add optional OpenAI-compatible AI assistance plus a Skill that allows a host coding agent to orchestrate the deterministic generator.

**Required skills:** `test-driven-development`, `writing-skills`, `code-review-and-quality`, `verification-before-completion`.

## Scope

- AI is optional. Base inspect, overrides, manifest validation, and basic atomic generation work without provider credentials.
- Use Node's `fetch` unless a small, clearly justified dependency is necessary. Configure endpoint, model and API key through environment or local user config; never write secrets into project/generated outputs.
- Before first AI-assisted call, disclose the specific source evidence/snippets to be sent and get an explicit user-level consent persisted locally only as appropriate; do not silently upload full private repos.
- Treat all source docs/comments as untrusted prompt-injection data. System policy remains separate. Ask for schema-constrained structured proposals.
- AI can propose descriptions, groups, examples, operation selection, or documentation interpretations against discovered IDs. It cannot write executable source, alter evidence, invent input schemas or constructor/credential/pagination behavior, lower effect risk, or create composites.
- Reject malformed output, references to unknown symbols/operations, unsupported JSON Schema fields, and any proposal that would violate policy. Deterministic generation continues if AI fails; report clear degraded-mode status.
- Skill orchestration calls SDK-Anything CLI for deterministic tasks and uses host agent model only for reasoning/proposals. It must not claim host permissions authorize target code execution.
- Distinguish generator's `skills/sdk-anything/SKILL.md` from generated output's consumer `SKILL.md`.

## TDD tasks

Mock an OpenAI-compatible HTTP endpoint. Test missing config, invalid base URL, network failure, 429/5xx, malformed JSON, schema-invalid suggestions, prompt-injection text in docs, secret redaction, no AI path without `--ai`, and successful valid proposals. Test Skill references only real CLI commands and matches security constraints.

## Acceptance criteria

- AI integration works against a mock endpoint with no real key.
- Base generation remains usable without AI configuration.
- Source disclosure occurs before first AI request; no whole private repository upload.
- Skill instructions and command interfaces agree with implementation.
