# Phase 02 — Analyzer Compatibility, Export Coverage and Actionable Diagnostics

## Goal
Make source analysis useful on varied real TS/JS SDK shapes. Do not chase a fantasy of perfectly resolving every TypeScript type; instead detect capabilities correctly, explain uncertainty, and give users a repair path.

## Implement
1. Inventory current behavior for named/default exports, barrels, `export *`, re-export chains, package `exports`, declaration files, JS/JSDoc, namespace exports, overloaded functions, methods, static methods, constructors, factory functions and aggregate packages.
2. Add representative fixture packages covering:
   - simple pure functions and overloads;
   - barrel/default/nested re-exports;
   - generic functions with inferable and unresolvable type parameters;
   - common utility types (`Partial`, `Required`, `Pick`, `Omit`, `Record`, `Readonly`, `Exclude`, `Extract`, `Parameters`, `ReturnType`) where safe and practical;
   - optional properties, nullable unions, literal unions, enums, tuples, index signatures, recursive types, discriminated unions;
   - `any`, `unknown`, `never`, `void`, `Promise<T>`, callback/function values, symbols and unsupported constructs;
   - package subpath exports and ESM/CJS differences;
   - class-based client SDK with constructor options, factory, auth, pagination, async requests and errors.
3. Preserve source provenance on every operation and diagnostic: file path/line where available, export path, type evidence and inference method.
4. Build structured diagnostic codes and stable severities. Include what was found, why it is unresolved/rejected, what is affected, whether generation can continue, and precise remediation.
5. Model uncertainty explicitly. A type that cannot safely be represented must not be silently broadened into an unconstrained schema and enabled as if certain.
6. Support predictable type lowering and JSON Schema 2020-12 output; validate every produced schema. Handle reference reuse and recursive types without infinite recursion.
7. Tighten runtime input validation against emitted JSON Schemas. Ensure lowered schema and generated TS input type don't disagree.
8. Add file-based overrides with schema version, operation identity/evidence, input schema, output hints if supported, constructor/factory selection, effect classification, auth/config mapping and rationale. Avoid hand-editing target source.
9. Make override promotion visible: distinguish statically discovered operations from human-reviewed enabled operations. Validate operation IDs and type definitions; don't allow arbitrary executable source injection via override files.
10. Generate a safe override starter file and actionable inspect output. If interactive prompts exist, keep a noninteractive file-based alternative.
11. Test analysis determinism across repeated runs and supported Node/OS environments as practical.

## End-to-end acceptance
For a complex fixture, inspect must report every public export as supported, unresolved or explicitly excluded—no silent disappearance. A user can resolve at least one unresolved operation via override, regenerate, and call it successfully using a generated CLI/MCP artifact. The analyzer never executes package code during inspection.

## Exit criteria
- Compatibility fixtures, failure diagnostics and override promotion tests pass.
- No known fixture loses exports silently.
- Unsupported features are accurately reported rather than falsely claimed as supported.
