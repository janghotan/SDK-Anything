# Phase 03 — Portable Capability Manifest and Safe Regeneration

## Goal
Make the versioned manifest a stable, complete, documented interchange format and make regenerate/update safe for real generated projects that may contain user edits.

## Implement
1. Audit manifest semantics: SDK identity/version/source locator/source digest, analysis version, exports/operations, input/output schemas, type/effect evidence, lifecycle requirements, auth secret references, pagination metadata, error hints, provenance, unresolved diagnostics and generator compatibility.
2. Keep secret values out of manifest and logs. Record only the reference name and non-sensitive configuration metadata.
3. Establish canonical serialization and stable IDs; prove equivalent analyses produce byte-for-byte stable manifest/digest. Ensure identity changes when semantically relevant source changes.
4. Strengthen JSON Schema and semantic validation. Detect dangling references, duplicate IDs, invalid effects, unsafe schema constructs, missing client initialization requirements and incompatible version fields.
5. Define compatibility/versioning policy: additive vs breaking schema changes, minimum generator compatibility, migration diagnostics and how unknown fields are handled.
6. Implement a generated-artifact inventory/ownership manifest with path, content digest, generator version, source-manifest digest and user-edit strategy.
7. Add a `generate --check` or equivalent check mode that generates in memory/temp and reports drift without writing. Add preview/diff output for update/regenerate; keep output deterministic.
8. Ensure normal generation never overwrites arbitrary existing files without explicit user intent. Regeneration must preserve unowned files and avoid clobbering hand-edited generated files silently. Use generated markers/ownership inventory and report conflicts.
9. Implement an atomic write strategy with staging, verification and rollback/recovery on write failure.
10. If source/manifest changes remove an operation, show the removal in the diff and avoid leaving stale code runnable. If edits conflict with new generator output, preserve user data and stop/report actionable conflict.
11. Add manifest fixtures and golden tests for canonical formatting/digests, migration, invalid semantics and regeneration diffs.

## Tests required
- Repeated generation from same manifest produces identical file digests.
- `--check` does not change filesystem and exits nonzero only on meaningful drift.
- Repeated source update has a readable diff and no unnecessary churn.
- A user-owned custom file survives regeneration.
- Hand-edited generated file is detected and handled according to documented policy.
- Failure midway through file creation doesn't leave a misleading half-valid generated project.
- Old/unknown manifest versions produce precise diagnostic or migration path.

## Exit criteria
Manifest is suitable as a portable contract; regeneration is safe, previewable and reproducible, not just “write the same directory again.”
