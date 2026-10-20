# SDK-Anything v0.1 Security Model

![Security diagram: inspection never imports target code or runs lifecycle scripts; pure and read effects are allowed by default, while write, destructive, and unknown effects require explicit authorization; runtime protections include env secret references, redaction, pagination caps, and fail-closed container behavior.](../assets/diagrams/security-en.svg)

## 1. Trust Boundaries

SDK-Anything treats third-party SDK packages, source code, documentation, and external AI model outputs as untrusted inputs.

| Input Source | Trust Level | Mitigations |
|---|---|---|
| npm Tarballs & Archives | Untrusted | In-memory decompression; path traversal rejection (`../`, leading `/`); symlink rejection; file count & byte size caps; no lifecycle scripts executed |
| GitHub Repositories | Untrusted | Only public HTTPS `github.com` URLs supported; no arbitrary build scripts executed |
| SDK Source Code & JSDoc | Untrusted | Never imported or executed during static inspection; analyzed via TS Compiler AST |
| README & Code Comments | Untrusted (Hostile Injection) | Excluded from system prompt execution; system prompt explicitly forbids following directives in documentation |
| AI Model Proposals | Untrusted | Strictly constrained to JSON Schema; proposed operation IDs must match discovered symbols; cannot create new schemas or alter policies |

## 2. Secrets and Credentials

1. **Reference-Only Model:**
   - Manifests, generated MCP servers, generated CLIs, tests, and logs store only environment variable references (e.g. `env:GITHUB_TOKEN` or `env:API_KEY`).
   - Secret values are resolved only at runtime from `process.env`.
   - Manifest validation rejects any manifest containing raw secret values in client options.

2. **Secret Redaction:**
   - All runtime errors and log outputs are passed through `redactSecrets`.
   - Known credentials and patterns matching `Bearer ...` or `apiKey=...` are redacted with `[REDACTED]`.

## 3. Effect Classification and Default Policy

Every discovered operation is classified into one of five effect levels:

- **`pure`:** Deterministic calculations without side effects (e.g. `distance`, `area`, `format`). Enabled by default.
- **`read`:** Read-only queries against external systems (e.g. `get`, `list`, `search`). Enabled by default.
- **`write`:** State-modifying operations (e.g. `create`, `update`, `set`). **Disabled by default**.
- **`destructive`:** Deletion or removal of resources (e.g. `delete`, `drop`, `purge`). **Disabled by default**. Requires interactive confirmation in CLI.
- **`unknown`:** Operations with ambiguous side effects. **Disabled by default**.

Runtime checks enforced by the shared runtime block any disabled operation before calling the SDK.

## 4. Verification Tiers & Sandbox Isolation

1. **Static Verification (Default):**
   - Validates manifest schemas, checks generated TypeScript compilation, and verifies adapter parity.
   - Runs deterministically without requiring Docker or Podman.
   - Never executes target package code.

2. **Container Sandbox (`--sandbox`):**
   - Intended for testing untrusted third-party package code.
   - Requires a supported container runtime (`docker` or `podman`).
   - Runs with `--network none`, read-only source volume, and no host credentials.
   - **Fail-Closed Guarantee:** If `--sandbox` is requested and no container runtime is available, SDK-Anything fails immediately with an actionable error. It **never silently falls back** to host execution.

3. **Trusted Local Mode (`--trusted-local`):**
   - Convenience mode for testing code the user owns and trusts.
   - Runs in a child process with a sanitized environment allowlist.
   - **Explicit Disclaimer:** This mode is labelled as trusted-code execution and is **never represented as a security sandbox**.
