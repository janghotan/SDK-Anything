# Security Policy

SDK-Anything inspects untrusted SDK source code and generates code that can call
external services. Security reports are taken seriously and handled privately.

## Supported versions

| Version | Supported |
| --- | --- |
| `0.1.x` | Yes |
| `< 0.1.0` | No |

## Reporting a vulnerability

Please **do not open a public issue** for a suspected vulnerability.

Use GitHub's private vulnerability reporting:

**https://github.com/janghotan/SDK-Anything/security/advisories/new**

Include, where possible:

- A description of the issue and its impact
- Reproduction steps or a minimal proof of concept
- Affected version and platform
- Any suggested mitigation

You can expect an acknowledgement within a few business days. Confirmed issues
will be fixed and disclosed in a coordinated release, with credit unless you
prefer to remain anonymous.

## Scope

The security model, trust boundaries, and hardening decisions are documented in:

- [`docs/security.md`](docs/security.md) — trust boundaries, secret handling, sandbox policy
- [`docs/security/threat-model-and-hardening.md`](docs/security/threat-model-and-hardening.md) — threat model and mitigations

Out of scope for this repository: vulnerabilities in third-party SDKs or model
providers that SDK-Anything integrates with. Report those to the respective
upstream project.

## Security design highlights

- SDK source is analyzed statically with the TypeScript compiler and is never
  imported or executed during inspection.
- Archives are extracted in memory with path-traversal, symlink, size, and file
  count limits; package lifecycle scripts are never run.
- Manifests store environment-variable references only, never secret values.
- Destructive operations are denied by default and require explicit,
  operation-scoped opt-in.
- Container isolation requires Docker or Podman and fails closed when neither is
  available; it never silently falls back to unsandboxed execution.
