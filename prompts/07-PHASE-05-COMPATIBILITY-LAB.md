# Phase 05 — Build a Real SDK Compatibility Lab

## Goal
Replace “we tried two examples” with a repeatable and expandable compatibility lab that explains which SDK patterns work and what the user can expect.

## Implement
1. Create a fixture catalog with metadata: package shape, source format, exports, client initialization, auth, async behavior, pagination, effect class, expected supported operations and intentionally unsupported cases.
2. Include (at minimum):
   - Turf or another pure-function library as a golden baseline;
   - authenticated client SDK with constructor/factory options, loopback HTTP, bearer auth, pagination and error responses;
   - barrel/re-export-heavy package;
   - package with complex/generic types plus override resolution;
   - ESM package and at least one CJS or mixed-format fixture if supported;
   - class-based SDK and factory-based SDK;
   - package with write/destructive/unknown operations;
   - an empty or malformed source package to test errors.
3. For each fixture, store expected discovery report, unresolved/unsupported diagnostics, canonical manifest constraints and runnable journey commands. Avoid brittle snapshots for huge unstable output; assert key invariants.
4. Create a compatibility runner that resolves/analyzes, validates manifest, generates all outputs, builds generated projects outside repo, invokes CLI safe paths, connects MCP client, checks skill command references and collects structured evidence.
5. Define scorecard dimensions: export coverage, safely lowered input schema coverage, operations enabled without override, operations recoverable by override, generated build result, CLI invocation result, MCP invocation result, policy parity, determinism and diagnostic quality.
6. Report scores transparently; don't inflate metrics by counting an unsafe/unresolved operation as supported. List denominators and exclusions.
7. Add fixture contribution guidance and a minimal new-fixture template so future contributors can add compatibility evidence without understanding every core module.
8. Where public npm dependencies are used, pin or lock versions and use integrity metadata. Default CI should favor deterministic checked-in fixtures. Optional live package compatibility jobs may be separate/nonblocking and clearly labeled.

## Exit criteria
A single command runs the compatibility lab and produces a report useful to maintainers and users. At least the required fixture matrix passes its declared expected behavior, including expected unsupported cases. Failures tell the maintainer which fixture and user path broke.
