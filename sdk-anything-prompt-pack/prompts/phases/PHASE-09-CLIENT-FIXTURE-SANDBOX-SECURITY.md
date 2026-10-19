# Phase 09 — Client SDK Fixture, Sandbox, and Security Hardening

**Goal:** Prove client-style SDK behavior and enforce safe inspection and opt-in test execution modes.

**Required skills:** `test-driven-development`, `systematic-debugging`, `code-review-and-quality`, `verification-before-completion`.

## Scope

- Local synthetic client-SDK fixture with a class and/or factory constructor, non-secret options, env credential reference, async HTTP success/auth/not-found/rate-limit/server-error/timeout, and bounded cursor/page responses.
- Use loopback HTTP fixture servers and synthetic credentials. No real accounts, real payments, or external API secrets.
- `sdk-anything test` static checks must not execute target code. They include schema validation, generated TypeScript compilation, import/reference validation, policy parity, and deterministic generation checks.
- `--sandbox` uses a real supported OS/container boundary (v0.1 target Docker or Podman), ephemeral environment, no outbound network by default, no inherited host env/credentials, lifecycle scripts disabled by default, read-only source where possible, and temp writable output only. If sandbox is requested but unavailable, fail with actionable error and no fallback.
- `--trusted-local` explicitly runs user-owned code in a child process with sanitized environment and temporary CWD. Label it as trusted code execution; never call it a sandbox. Node Permission Model/worker threads, if used, are defense in depth only.
- Ensure archive extraction and output path traversal checks, bounded network/download behavior, safe error/logging redaction, source injection handling, and no generated secrets.

## TDD tasks

Test fixture client constructor/auth/async requests, page and byte caps, malformed server payload, server close/timeout, secret absence in output, static tests without container, sandbox missing-runtime behavior, no fallback to trusted local, env allowlist, no outbound network configuration, path traversal fixture, and a hostile docs fixture whose instructions are ignored.

## Acceptance criteria

- Client fixture is used by analyzer, manifest, runtime, and adapter tests.
- Static verification works with no Docker/Podman installed.
- Sandbox behavior is tested when a supported runtime is available; when unavailable, tests verify fail-closed diagnostics.
- Trust modes are visibly separate in output and documentation.
