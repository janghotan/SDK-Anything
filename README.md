# SDK-Anything

> Turn TypeScript/JavaScript SDKs into inspectable, testable, agent-friendly MCP tools and CLIs.

SDK-Anything is an open-source developer tool that analyzes TypeScript/JavaScript SDKs and generates clean, inspectable, typed interfaces for AI agents and developers.

From a single SDK analysis and one versioned capability manifest (`sdk-anything/manifest/v1`), it generates:
- **Model Context Protocol (MCP) Server:** Stdio server using the official `@modelcontextprotocol/sdk`.
- **Command-Line Interface (CLI):** Machine-readable JSON and human-readable CLI powered by Commander.js.
- **Consumer Skill (`SKILL.md`):** Usage guidance teaching AI agents how to discover, configure, and compose atomic operations.

---

## Quick Start

### Installation & Build

\`\`\`bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Link CLI locally
pnpm link --global
\`\`\`

### 1. Inspect an SDK

Inspect an npm package, a local directory, or a public GitHub repository without executing any target code or lifecycle scripts:

\`\`\`bash
# Inspect an npm package
sdk-anything inspect npm:@turf/turf

# Inspect a local SDK directory
sdk-anything inspect ./path/to/my-sdk

# Output structured JSON evidence
sdk-anything inspect npm:@turf/turf --json
\`\`\`

### 2. Generate Human Overrides (Optional)

If an SDK has ambiguous constructor parameters, complex types, or needs custom credential references:

\`\`\`bash
sdk-anything inspect ./path/to/my-sdk --write-overrides
\`\`\`

This generates a starter `sdk-anything.overrides.json` where you can review effect classifications, map credential references like `env:API_KEY`, or resolve schemas.

### 3. Generate MCP and CLI Outputs

\`\`\`bash
# Generate both MCP server and CLI
sdk-anything generate npm:@turf/turf --targets mcp,cli --output ./generated/turf-tools

# Optional: enable AI assistance for enhanced descriptions
sdk-anything generate npm:@turf/turf --targets mcp,cli --ai --output ./generated/turf-tools
\`\`\`

### 4. Statically Validate

\`\`\`bash
sdk-anything validate ./generated/turf-tools
\`\`\`

### 5. Run Verification Tests

\`\`\`bash
# Run tests for user-owned code in a sanitized local process
sdk-anything test ./generated/turf-tools --trusted-local

# Run tests in an isolated Docker/Podman container (fails closed if container runtime is missing)
sdk-anything test ./generated/turf-tools --sandbox
\`\`\`

---

## Supported Inputs

- **npm packages:** `npm:<package>` or `npm:<package>@<version>`. Safely downloads and extracts tarballs without running `prepare` or `postinstall` lifecycle scripts.
- **Local directories:** `./path/to/sdk`. Statically inspects source and declaration files without importing target modules into the generator process.
- **Public GitHub repositories:** `https://github.com/<owner>/<repo>`. Downloads repository source archives over HTTPS without executing arbitrary build steps.

---

## Core Product Invariants

1. **Deterministic Static Analysis:** Functions, signatures, parameters, and types are extracted deterministically via the TypeScript Compiler API. AI never invents executable types or call signatures.
2. **One Source of Truth:** MCP tools, CLI commands, policy enforcement, and documentation derive from a single canonical manifest (`capability-manifest.json`).
3. **Inspectable Output:** Generates readable, compiling TypeScript source. No dynamic proxies, hidden runtime dependencies, or `eval`.
4. **Safe by Default:**
   - Static inspection never executes target code.
   - Pure and verified read operations are enabled by default.
   - Write, destructive, and unknown effects are **disabled by default** and enforced by the shared runtime.
5. **Secret Reference Model:** Credentials are only ever stored as environment variable references (e.g. `env:GITHUB_TOKEN`). Secret values never enter manifests, generated source, test fixtures, AI prompts, or logs.
6. **Atomic Operations Only:** Generated operations represent atomic SDK calls. Multi-step executable workflows are composed by the consuming agent at runtime.
7. **Strict Sandbox Tiers:**
   - Static validation requires no container runtime.
   - Untrusted-code execution requires a container sandbox (`--sandbox`) and **fails closed** without silent fallback.
   - `--trusted-local` is labelled as trusted-code execution and is never represented as a security sandbox.

---

## Capability Manifest Schema (`sdk-anything/manifest/v1`)

The manifest is validated against `schema/capability-manifest.schema.json` using Ajv 2020:

\`\`\`json
{
  "schemaVersion": "sdk-anything/manifest/v1",
  "generatorVersion": "0.1.0",
  "source": {
    "kind": "npm",
    "package": "@turf/turf",
    "version": "7.2.0",
    "digest": "sha256:..."
  },
  "operations": [
    {
      "id": "distance",
      "name": "distance",
      "summary": "Calculate distance between two points",
      "description": "Calculates the distance between two points in degrees, radians, miles, or kilometers.",
      "invoke": {
        "kind": "top-level-function",
        "functionName": "distance"
      },
      "inputSchema": {
        "type": "object",
        "properties": {
          "from": { "type": "array" },
          "to": { "type": "array" },
          "options": { "type": "object" }
        },
        "required": ["from", "to"]
      },
      "effect": "pure",
      "enabledByDefault": true,
      "result": { "mode": "direct" },
      "provenance": { "sourceFile": "src/index.ts", "confidence": "high" }
    }
  ],
  "unresolved": []
}
\`\`\`

---

## Project Structure

\`\`\`text
sdk-anything/
├── README.md
├── LICENSE (Apache-2.0)
├── package.json
├── tsconfig.json
├── schema/
│   └── capability-manifest.schema.json
├── skills/
│   └── sdk-anything/
│       └── SKILL.md
├── src/
│   ├── cli/             # CLI commands, argument parsing, config
│   ├── source/          # Safe npm, local, and GitHub resolvers
│   ├── analyzer/        # TypeScript Compiler API static analysis
│   ├── manifest/        # Manifest v1 schema, validation, canonical serializer, overrides
│   ├── runtime/         # Shared invocation runtime, client lifecycle, policy enforcer, pagination
│   ├── generators/      # MCP server, CLI, and consumer skill generators
│   ├── ai/              # Optional OpenAI-compatible proposal adapter & disclosure
│   └── sandbox/         # Static verification, container sandbox runner, trusted local runner
├── tests/
│   ├── cli/             # CLI bootstrap tests
│   ├── source/          # Resolver and path traversal security tests
│   ├── analyzer/        # Static analysis & type lowering tests
│   ├── manifest/        # Manifest building, validation, canonical serialization tests
│   ├── runtime/         # Invocation runtime, policy enforcement, secret redaction tests
│   ├── generators/      # MCP and CLI generator parity tests
│   ├── ai/              # AI proposal parser and mock endpoint tests
│   ├── security/        # Client-SDK fixture and sandbox fail-close tests
│   ├── e2e/             # Turf end-to-end golden test
│   └── fixtures/        # Test fixtures (sample SDKs, client SDK with loopback server)
├── examples/
│   ├── turf/            # Pure function golden example
│   └── client-sdk/      # Stateful network client fixture example
└── docs/
    ├── architecture.md  # Detailed pipeline and module specifications
    └── security.md      # Security model, trust boundaries, effect policy
\`\`\`

---

## Testing & Quality Gates

Run the automated test suite:

\`\`\`bash
# Run all unit, integration, and E2E tests
pnpm test

# Run TypeScript type checking
pnpm run typecheck

# Run linter
pnpm run lint

# Build the project
pnpm run build
\`\`\`

---

## Limitations (v0.1)

- **Language scope:** TypeScript and JavaScript SDKs only.
- **Workflow model:** Atomic operations only. Multi-step executable composites are deferred to future versions.
- **Client lifecycle:** Supports standard class and factory constructor patterns; unusual dynamic metamethods or metaprogramming require overrides.
- **Sandboxed execution:** Container isolation requires local Docker or Podman. When absent, `--sandbox` fails closed to protect against untrusted code execution.

---

## License

Apache-2.0
