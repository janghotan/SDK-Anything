# Client SDK Example

This directory demonstrates SDK-Anything generating an MCP server and CLI from a stateful, client-based SDK requiring constructor configuration and environment variable secret references.

## Key Concepts Demonstrated

1. **Client Lifecycle:**
   - Class constructor: `new TestApiClient({ apiKey, baseUrl })`
   - Config options: `apiKey` (secret), `baseUrl` (string)

2. **Secret Representation:**
   - Credentials are stored strictly as environment variable references (e.g. `env:CLIENT_SDK_API_KEY`).
   - Secret values are never committed or printed in manifests, tools, or logs.

3. **Runtime Policy Enforcement:**
   - Pure/Read operations (e.g. `listItems`) are enabled by default.
   - Destructive operations (e.g. `deleteItem`) and write operations (e.g. `createItem`) are disabled by default.

4. **Bounded Pagination:**
   - `listItems` enforces maximum item counts (e.g. 100) and byte caps (1MB) to protect against memory exhaustion.

## Usage

Generate MCP and CLI interfaces from the client fixture:

\`\`\`bash
sdk-anything generate ./tests/fixtures/client-sdk --targets mcp,cli --output ./generated/client-tools
\`\`\`

Review and edit overrides if necessary:
\`\`\`bash
sdk-anything inspect ./tests/fixtures/client-sdk --write-overrides
\`\`\`

Statically validate:
\`\`\`bash
sdk-anything validate ./generated/client-tools
\`\`\`
