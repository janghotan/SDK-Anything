<p align="center">
  <img src="assets/sdk-anything-banner-en.png" alt="SDK-Anything Banner" width="100%">
</p>

<p align="center">
  <strong>Turn any TypeScript / JavaScript SDK into tested, agent-ready tools.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#core-workflow">Core Workflow</a> •
  <a href="#manifest-specification">Manifest Spec</a> •
  <a href="#security--sandboxing">Security</a> •
  <a href="#connecting-to-agents">Agent Setup</a> •
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20_LTS-339933?logo=node.js&logoColor=white" alt="Node.js Version">
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MCP-1.32+-8A2BE2?logo=anthropic&logoColor=white" alt="Model Context Protocol">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License">
</p>

---

## Overview

**SDK-Anything** bridges the gap between conventional developer SDKs and AI agents. Instead of manually hand-crafting tool definitions or writing fragile API glue, SDK-Anything statically analyzes SDK source code or npm packages and produces a versioned **Capability Manifest** (`sdk-anything/manifest/v1`).

From this single source of truth, it generates:
- 🔌 **An Official MCP Server**: Stdio server built on `@modelcontextprotocol/sdk` exposing typed tools.
- ⌨️ **A Developer CLI**: Production-ready command-line tool with machine-readable `--json` output.
- 🤖 **A Consumer Skill (`SKILL.md`)**: Context-rich operational guidance teaching consuming LLM agents how to discover, parameterize, and chain atomic operations.

> [!IMPORTANT]
> **Static Safety First:** SDK-Anything never imports or executes target package code during inspection. Package installation lifecycle scripts (`prepare`, `postinstall`) are strictly skipped.

---

## Features

- **Deterministic API Extraction:** Uses the TypeScript Compiler API (`noEmit: true`) to resolve function signatures, declaration files, JSDoc comments, and complex TypeScript types into JSON Schema Draft 2020-12.
- **Single Source of Truth:** MCP tools, CLI subcommands, security policy, and agent instructions all derive from one canonical capability manifest.
- **Inspectable TypeScript Output:** Generates clean, standard TypeScript code without hidden dynamic proxies or `eval`.
- **Reference-Only Secret Model:** Credentials are never embedded in generated code, manifests, or prompts. Keys are referenced solely through environment variables (`env:API_KEY`).
- **Conservative Effect Policy:** Pure calculations and verified reads are enabled by default. Write, destructive, and unknown operations are disabled by default and enforced by the shared runtime.
- **Fail-Closed Container Isolation:** Static validation runs with zero dependencies. Testing untrusted code requires an explicit container boundary (`--sandbox` with Docker/Podman) and fails closed without silent fallback.
- **Optional AI Proposal Layer:** OpenAI-compatible endpoint support for generating enhanced human-readable summaries and grouping, with full prompt-injection isolation.

---

## Quick Start

### Prerequisites

- Node.js >= 20.0.0 (tested on v20, v22, v24 LTS)
- [pnpm](https://pnpm.io/) >= 9.0.0

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/sdk-anything.git
cd sdk-anything

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Link CLI globally (optional)
pnpm link --global
```

---

## Core Workflow

```text
Source Locator (npm:pkg, local dir, public GitHub)
       │
       ▼
Deterministic Static Analyzer (TS Compiler AST & TypeChecker)
       │
       ▼
Evidence Inventory (Exports, types, docs, unresolved diagnostics)
       │
       ▼
Human Overrides Engine (Optional sdk-anything.overrides.json)
       │
       ▼
Capability Manifest (sdk-anything/manifest/v1)
       │
 ┌─────┴─────────────────────┐
 ▼                           ▼
Generated MCP Server     Generated CLI & SKILL.md
(Stdio Transport)       (Commander.js & Docs)
       │                           │
 └─────┬─────────────────────┘
       ▼
Shared Runtime Engine (Schema validation, policy enforcement, caps)
```

### 1. Inspect an SDK

Inspect public npm packages, local project checkouts, or public GitHub repositories:

```bash
# Inspect an npm package
sdk-anything inspect npm:@turf/turf

# Inspect a local TypeScript/JavaScript SDK repository
sdk-anything inspect ./path/to/my-sdk

# Output structured JSON evidence
sdk-anything inspect npm:@turf/turf --json
```

### 2. Configure Overrides (Optional)

For SDKs with custom constructor factories, ambiguous unions, or required secret tokens:

```bash
# Generate starter overrides template
sdk-anything inspect ./path/to/my-sdk --write-overrides
```

This generates `sdk-anything.overrides.json`:

```json
{
  "schemaVersion": "sdk-anything/overrides/v1",
  "client": {
    "construction": "class",
    "export": "ApiClient",
    "options": {
      "apiKey": {
        "type": "secret",
        "source": "env:MY_SERVICE_API_KEY",
        "required": true
      }
    }
  },
  "operations": {
    "records.delete": {
      "effect": "destructive",
      "enabledByDefault": false
    }
  }
}
```

### 3. Generate MCP Server, CLI, and Consumer Skill

```bash
# Generate both MCP server and CLI into output directory
sdk-anything generate npm:@turf/turf \
  --targets mcp,cli \
  --output ./generated/turf-tools

# Optional: Enable AI assistance for enhanced documentation
sdk-anything generate npm:@turf/turf \
  --targets mcp,cli \
  --ai \
  --output ./generated/turf-tools
```

### 4. Validate Generated Artifacts

Perform static validation of the manifest schema, TypeScript compilation, and adapter parity:

```bash
sdk-anything validate ./generated/turf-tools
```

### 5. Run Verification Tests

```bash
# Test user-owned trusted code in a sanitized local process
sdk-anything test ./generated/turf-tools --trusted-local

# Test untrusted packages in an isolated container sandbox
sdk-anything test ./generated/turf-tools --sandbox
```

> [!WARNING]
> `--trusted-local` runs code on your host in a sanitized environment, but is **not** an OS security boundary. Untrusted code must always be tested using `--sandbox`.

---

## Manifest Specification

Generated manifest files adhere to `schema/capability-manifest.schema.json`:

```json
{
  "schemaVersion": "sdk-anything/manifest/v1",
  "generatorVersion": "0.1.0",
  "source": {
    "kind": "npm",
    "package": "@turf/turf",
    "version": "7.2.0",
    "digest": "sha256:0123456789abcdef..."
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
        "required": ["from", "to"],
        "additionalProperties": false
      },
      "effect": "pure",
      "enabledByDefault": true,
      "result": { "mode": "direct" },
      "provenance": {
        "sourceFile": "src/index.ts",
        "confidence": "high"
      }
    }
  ],
  "unresolved": []
}
```

---

## Security & Sandboxing

### Effect Classification

Every operation is categorized into an explicit effect tier:

| Effect | Default Status | Description |
|---|---|---|
| `pure` | **Enabled** | Stateless calculation (e.g. geometric computation, parsing) |
| `read` | **Enabled** | Query with external fetch without state alteration (e.g. `list`, `get`) |
| `write` | **Disabled** | Modifies state on remote or local systems (e.g. `create`, `update`) |
| `destructive` | **Disabled** | Deletes or purges data (e.g. `delete`, `drop`). Requires confirmation in CLI |
| `unknown` | **Disabled** | Ambiguous or unverified side effects |

### Secret Reference Guarantee

- No secret tokens or passwords are ever persisted in manifests or generated source.
- Credentials use `env:VARIABLE_NAME` references.
- Runtime error logs automatically redact keys matching authorization headers or known secrets (`Bearer [REDACTED]`).

### Bounded Pagination

To prevent agent memory exhaustion, paginated calls enforce strict limits:
- Maximum item cap per call (default: 100 items).
- Maximum serialized response payload limit (default: 1 MB).

---

## Connecting to Agents

### Claude Desktop Configuration

Add the generated MCP server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "turf-tools": {
      "command": "node",
      "args": ["/absolute/path/to/generated/turf-tools/mcp/dist/server.js"],
      "env": {
        "API_KEY": "your-token-if-required"
      }
    }
  }
}
```

### Cursor / Windsurf Configuration

Add a command transport entry to your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "my-sdk": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/generated/my-sdk/mcp/server.ts"]
    }
  }
}
```

### Consuming via Agent Skill

Each generated project includes a tailored `SKILL.md` detailing:
- Available atomic tools and required parameters.
- Step-by-step instructions for chaining tools in LLM reasoning loops.
- Error handling and pagination semantics.

---

## Repository Structure

```text
sdk-anything/
├── schema/
│   └── capability-manifest.schema.json  # Manifest v1 JSON Schema
├── skills/
│   └── sdk-anything/SKILL.md            # Orchestration skill for host agents
├── src/
│   ├── cli/                             # CLI commands, config, entry points
│   ├── source/                          # Safe npm, local, and GitHub resolvers
│   ├── analyzer/                        # TS Compiler API AST & type lowering
│   ├── manifest/                        # Manifest builder, validator, serializer
│   ├── runtime/                         # Shared runtime, policy enforcer, secrets
│   ├── generators/                      # MCP, CLI, and consumer skill generators
│   ├── ai/                              # Optional AI proposal client & disclosure
│   └── sandbox/                         # Static checks & container execution
├── tests/                               # 11 comprehensive Vitest test suites
├── examples/
│   ├── turf/                            # Pure-function golden example
│   └── client-sdk/                      # Stateful network client fixture
└── docs/
    ├── architecture.md                  # Comprehensive architectural specification
    └── security.md                      # Detailed security & isolation model
```

---

## Quality & Test Matrix

Run the automated verification suite:

```bash
# Run 59 automated unit, integration, and E2E tests
pnpm test

# Verify strict TypeScript typechecking
pnpm run typecheck

# Check code style and lint rules
pnpm run lint

# Build production artifacts
pnpm run build
```
