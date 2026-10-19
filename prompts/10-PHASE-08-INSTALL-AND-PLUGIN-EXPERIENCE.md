# Phase 08 — Installable Deliverables and Agent Integration Experience

## Goal
Make generated capability bundles frictionless to install in the environments where agents and developers actually work. Keep the scope grounded in integrations the project can support and verify.

## Implement
1. Define a portable generated bundle layout containing manifest, generated CLI, generated MCP server, skill instructions, config examples, provenance/version metadata, validation report and licenses/notices where needed.
2. Ensure bundle is relocatable: no absolute host paths, implicit monorepo dependency, local `file:` link, hidden environment assumptions or package manager lockfile that excludes required files.
3. Test npm pack/install and execution from an unrelated temp directory. Ensure published SDK-Anything package includes every runtime schema/template/skill resource required at runtime.
4. Generate MCP client configuration examples appropriate to stdio transport and document how to install/connect them. Keep secrets in environment configuration, never inline in committed client config.
5. Provide a standard consumer skill and, where there's clear low-cost demand, installable agent integration metadata for common skill/plugin conventions. Do not claim compatibility with platforms that have not been tested.
6. Provide generated bundle manifest/checksum and a verification command (`verify`, `doctor`, or existing equivalent) that reports source digest, generator version, files, runtime prereqs and policy summary.
7. Add a clear inspect/list/info flow so agent discoverability isn't dependent on reading generated TS. Add JSON output for agent callers.
8. Provide update/reinstall steps and explain what regeneration preserves, overwrites or asks the user to resolve.
9. Add integration packaging tests that inspect the actual artifact layout and validate every referenced file/command exists.
10. Use CLI-Anything only as product-pattern inspiration: repeatable per-target harnesses, extensive agent-specific instruction, integration metadata, verification scripts and practical demos. Do not copy its implementation or imply affiliation.

## Scope discipline
Do not start a hosted registry/web app as a distraction. The first goal is outstanding local-first generated deliverables. If repo evidence shows a registry or UI is essential, log it as an optional follow-up and finish local flows first.

## Exit criteria
A developer can install SDK-Anything from its packed package, generate a bundle, configure an MCP client, use the CLI, and give the skill to an agent using only documented instructions. Exact documented steps are tested from a clean workspace.
