# Phase 02 — Source Resolution

**Goal:** Normalize npm, local directory, and public GitHub inputs into a versioned/digested source snapshot without running target code.

**Required skills:** `test-driven-development`, `systematic-debugging`, `verification-before-completion`.

## Commands

Implement the spec's UX for:

- `sdk-anything inspect npm:<package>`
- `sdk-anything inspect <local-directory>`
- `sdk-anything inspect https://github.com/<owner>/<repo>`

Use a single source locator union/type and one resolver per source kind. Return a normalized result including source kind, identity, resolved version/revision when available, local snapshot path, content digest, and warnings.

## Safety and behavior

- npm inspection must retrieve package metadata/archive without executing package code or lifecycle scripts. Prefer registry metadata and archive download/extraction techniques that do not run `prepare`, `postinstall`, or package scripts. Do not run `npm install` against the target package during inspect.
- Public GitHub resolver may download an archive or use Git read-only operations. Never run the repo's scripts/build. Private repository input is a local checkout, not a token-based GitHub integration.
- Reject URL schemes other than explicitly supported HTTPS for GitHub; validate owner/repo syntax; prevent SSRF and local path escape in any download/redirect handling.
- Extract archives with path traversal/symlink protections; enforce archive size/file count limits; handle redirects deliberately.
- Snapshot only required source files under a dedicated temp/cache directory; include source digest and version/revision in all reports.
- Keep authentication values out of logs. Inspection does not require AI.

## TDD tasks

Create fixtures/mocks for valid npm metadata/archive, not-found package, invalid URL, malformed archive, path traversal archive entry, oversized archive, local directory, missing manifest, public GitHub snapshot, and network failure. Assert no package scripts are run.

## Acceptance criteria

- All three input kinds normalize to the same source result model.
- Unsafe archive paths/links and unsupported URLs fail safely.
- No target package execution or lifecycle scripts.
- Helpful diagnostics include source locator and corrective guidance.
- Commit only after focused and aggregate checks pass; update state/log and push safely.
