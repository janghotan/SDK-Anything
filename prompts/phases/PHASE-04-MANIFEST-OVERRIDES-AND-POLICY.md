# Phase 04 — Manifest Schema, Overrides, and Policy Model

**Goal:** Define and validate `sdk-anything/manifest/v1`, with stable serialization, evidence links, client descriptors, operation schemas, pagination, effect classes, and human-editable overrides.

**Required skills:** `test-driven-development`, `codebase-design`, `code-review-and-quality`.

## Scope

- Publish `schema/capability-manifest.schema.json` and typed TypeScript model definitions. Avoid maintaining unrelated schemas as competing sources of truth.
- Use Ajv or an equivalent schema validator. Verify compatibility with the JSON Schema dialect the project selects.
- Manifest must include generator version, source identity/version/revision/digest, client lifecycle, credential references, operation IDs/invocation descriptors, input/output schemas, effect class, enabled policy, result/pagination mode and caps, provenance, unresolved concerns, and override provenance.
- Credential descriptor records a source reference (e.g. `env:EXAMPLE_TOKEN`) never the secret value. Secret fields cannot be ordinary model-supplied inputs by default.
- Overrides file `sdk-anything.overrides.json` must be schema-validated and scoped to known operations/source IDs. It can refine schemas, client class/factory/export, receiver path, environment variable name, result/pagination descriptor, and an explicitly reviewed effect class.
- Canonical serialization must use deterministic operation/key ordering and omit volatile timestamps from canonical digest.
- Effects: `pure`, `read`, `write`, `destructive`, `unknown`. Write/destructive/unknown are disabled by default; AI descriptions never reduce effect risk by themselves.
- No composite capabilities.

## TDD tasks

Test invalid manifests, bad references, wrong schema versions, unknown operations in overrides, attempts to include secret values, stable digest, effect-default policy, invalid receiver paths, pagination caps, and unresolved operation disabling.

## Acceptance criteria

- One canonical manifest schema and stable TypeScript types.
- Override edits are human-readable and validated; generated source isn't edited invisibly.
- AI suggestions can only refer to known evidence/operations.
- Security policy is explicit in manifest semantics and covered by tests.
