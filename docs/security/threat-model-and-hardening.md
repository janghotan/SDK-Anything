# SDK-Anything Security Architecture & Threat Model

- **Status:** Phase 07 Verified
- **Date:** 2026-10-19
- **Scope:** Host security, trust boundaries, credential safety, and sandbox honesty.

---

## 1. Threat Model & Trust Boundaries

SDK-Anything is designed under the assumption that analyzed SDKs, npm packages, GitHub snapshots, documentation, and user input can be untrusted or adversarial.

| Input Vector | Risk / Attack Scenario | Security Guarantee |
|---|---|---|
| **Archive extraction (npm / GitHub)** | Zip bombs, path traversal (`../`), symlink escapes | Bounded uncompressed bytes (50MB cap), 10k file limit, strict traversal rejection, symlinks forbidden. |
| **Source inspection** | Malicious lifecycle scripts (`postinstall`), dynamic code execution | Static analysis only via TypeScript Compiler API; never runs `npm install`, lifecycle scripts, or evaluations during inspection. |
| **SDK documentation / README** | Prompt injection attacks attempting to hijack AI models or downstream agents | Analyzed text treated as data, not instructions. Strict system prompt separation; AI proposals strictly validated against discovered AST symbols. |
| **Output generation** | Overwriting arbitrary host files or escaping output directory | Target path sanitization, traversal rejection, atomic staging directory, user-modified conflict detection (`.sdk-anything-inventory.json`). |
| **Runtime credentials** | Accidental leakage of tokens in manifests, logs, or error messages | Secrets stored strictly as environment references (`env:VARIABLE_NAME`), never serialized. Redaction in error messages (Bearer tokens, URL credentials, query params). |
| **Runtime operation execution** | Unauthorized state modification or destructive data loss | Default deny for write/destructive/unknown operations. Non-interactive environments fail closed on destructive operations unless `--allow-destructive` is explicit. |
| **Sandbox testing mode** | False sense of security (claiming isolation when running on host) | Honest labeling: `static` (no target code execution), `trusted-local` (sanitized child process, NOT a sandbox), `sandbox` (Docker/Podman container with `--network none`). Fails closed if container engine is absent. |

---

## 2. Hardened Runtime Policies

1. **Destructive Operation Fail-Closed:**
   - In non-interactive environments (e.g. CI, autonomous agent loops), destructive operations (`effect: "destructive"`) are blocked with `POLICY_DENIED` unless `--allow-destructive` is passed.
   - In interactive environments, interactive confirmation is required.
2. **Infinite Pagination & Loop Guards:**
   - `validatePaginationCursor` tracks seen cursors and throws if a repeated cursor is observed, preventing infinite pagination loops.
   - Max items and max byte caps are enforced by `boundResult`.
3. **Secret Redaction:**
   - Explicit secrets passed in invocation context are stripped.
   - Bearer tokens (`Bearer [REDACTED]`), URL auth (`://[REDACTED]:[REDACTED]@`), and URL query parameters (`?token=[REDACTED]`) are automatically redacted from error messages.
   - Stack traces are excluded from public error envelopes by default.

---

## 3. Verification & Evidence Matrix

| Claim | Verified By | Result |
|---|---|---|
| Path traversal in archives rejected | `tests/security/adversarial.test.ts` | PASS |
| Symlinks in archives rejected | `tests/security/adversarial.test.ts` | PASS |
| Archive decompression size capped | `tests/security/adversarial.test.ts` | PASS |
| URL and query token secret redaction | `tests/security/adversarial.test.ts` | PASS |
| Secret redaction in SDK lifecycle throws | `tests/security/security-and-sandbox.test.ts` | PASS |
| Infinite pagination cursor loops blocked | `tests/security/adversarial.test.ts` | PASS |
| Generator path traversal escape blocked | `tests/security/adversarial.test.ts` | PASS |
| Container sandbox requested without Docker fails closed | `tests/security/adversarial.test.ts` | PASS |
| AI prompt injection rejected by schema validator | `tests/security/adversarial.test.ts` | PASS |
| Destructive operation fails closed non-interactively | `tests/security/security-and-sandbox.test.ts` | PASS |
