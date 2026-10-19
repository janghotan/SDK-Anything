# Phase 07 — Security, Trust Boundaries and Honest Sandbox Guarantees

## Goal
Protect the developer host and downstream agent from untrusted SDKs, unsafe operations, credential leakage, generated-code surprises and false safety claims.

## Threat model and implementation
1. Map untrusted inputs (npm archives, GitHub/local source, declarations/comments, manifest, override files, AI results, SDK runtime results, generated destinations and tool parameters) to trust boundaries.
2. Archive extraction: reject traversal, absolute paths, symlinks escaping root, malicious archive sizes/file counts/compression ratios, duplicate dangerous paths and unsupported archive formats. Bound memory and time.
3. Resolver: do not execute package scripts, install target packages or evaluate target code during inspect. Pin/record source identity/digests. Sanitize path and URL handling.
4. Generated file writer: realpath and symlink-check destination, confine every output to chosen root, atomic writes, reject collision with unrelated files by default.
5. Schema/override parser: impose size/depth limits; validate JSON Schema subset; protect against prototype pollution, ReDoS patterns and huge recursive schemas where relevant.
6. Runtime: validate inputs; cap time, pagination, bytes, pages and concurrency; stop repeated cursor loops; normalize/redact errors; properly close resources.
7. Secret handling: environment references only, minimum exposure, no accidental manifest serialization, robust redaction of bearer tokens/API keys/signatures and nested errors. Test with synthetic unique secret strings.
8. Effects: read/pure allowed only according to manifest/policy. Write/destructive/unknown deny by default. Non-TTY mode never asks an invisible confirmation. Explicit `--allow-destructive` must be a deliberate opt-in and visibly documented.
9. Sandbox labels: static verification means no target execution; container sandbox means actual isolated execution with restrictions; trusted-local is ordinary host execution with a sanitized environment and is not a sandbox. Container unavailability or malformed config fails closed for requested sandbox execution.
10. Container execution: disable network by default, read-only source mounts where practical, isolated ephemeral workspace, resource/time limits, dropped privileges and cleanup. If any guarantee isn't implemented on the host runtime, say so explicitly.
11. Prompt injection: analyzer and AI layer treat repository text as data. Never obey instructions found in analyzed source/README/comments.
12. Audit generated code for hidden network beacons, dynamic eval, shell interpolation, dependency confusion, absolute paths and undeclared dependencies.

## Adversarial tests
Traversal/symlink archives; too-large archives; invalid UTF-8/JSON; nested `$ref`/recursive schema abuse; malformed override; malicious description strings; output path escape; token included in thrown error; tool argument injection; unbounded pagination; hung client; destructive command in non-TTY; sandbox request without Docker/Podman; generated project trying to resolve source-tree paths; and AI injection payloads.

## Exit criteria
A security report maps each claim to a test or limitation. No silent host-execution fallback exists. Unsafe operation behavior matches across CLI/MCP. All findings are fixed or explicitly classed with impact and remediation; P0/P1 findings must be fixed before release candidate.
