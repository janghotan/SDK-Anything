# Phase 01 — Make the Core User Journey Real, Complete and Boringly Reliable

## Goal
Make the primary public workflow function as a continuous product journey, not a set of independently passing commands:
`source → inspect → understand unresolved items → configure overrides → manifest → generate outputs → build/install → invoke actual operations → validate/test → update safely`.

## Implement
1. Trace CLI arguments, defaults, exit codes, stdout/stderr and filesystem effects for each command. Ensure help and `--json` output are coherent, stable and machine consumable.
2. Remove broken or stub-like paths found in Phase 00. Any command shown in help/docs must work or return a precise `UNSUPPORTED`/actionable error.
3. Ensure inspector output clearly separates discovered operations, enabled operations, unresolved exports/types, rejected operations and omissions with reason codes.
4. Ensure override suggestions can be generated, edited, validated and rerun without source edits. Invalid IDs/types fail with file path and JSON pointer/key.
5. Ensure generation writes a complete project atomically or reports partial writes with a recoverable plan. Prevent path traversal, symlink escapes and accidental overwrite of user files.
6. Ensure generated project includes clear `README`, config, source, runtime and skill content as promised; no host-repository paths or workspace-only dependencies.
7. Ensure `validate` checks the manifest/generated project independently and reports useful actionable diagnostics.
8. Ensure testing/execution modes explicitly declare what was and wasn't executed, and what environment was used.
9. Make error cases first-class: package missing, invalid source, empty export surface, type lowering failure, bad override, missing secret, invalid input, transport startup failure, SDK runtime throw, timeout, denied effects, unsupported pagination, invalid generated path.
10. Create one reusable, non-flaky end-to-end harness for source → generation → generated package build → actual CLI invocations → MCP tool call → policy/error checks.

## Tests required
- Fresh temporary workspace outside repository.
- Both pure-function and authenticated client fixtures.
- Positive and negative CLI exit-code/stdout/stderr checks.
- Generated output path includes no references into SDK-Anything checkout.
- `npm pack`/package install test for SDK-Anything's own CLI.
- Real MCP client invokes generated tool and gets schema-correct response.
- No network call is needed unless the tested operation is explicitly the fixture's loopback server.

## Exit criteria
An unfamiliar developer can follow the quickstart from a clean checkout, generate usable outputs, invoke a safe operation and diagnose one failure without reading generator source. If it cannot yet do so, fix it and repeat.
