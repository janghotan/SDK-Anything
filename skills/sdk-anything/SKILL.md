# SDK-Anything Generator Skill

Use this Skill to orchestrate the generation of inspectable, testable MCP servers, CLIs, and consumer skills from TypeScript/JavaScript SDKs.

## Workflow

1. **Inspect SDK:**
   Run deterministic inspection on the target package or directory:
   \`\`\`bash
   sdk-anything inspect npm:<package> --json
   sdk-anything inspect ./path/to/sdk --json
   sdk-anything inspect https://github.com/<owner>/<repo> --json
   \`\`\`

2. **Review Evidence and Unresolved Symbols:**
   Examine the discovered functions, classes, and unresolved symbols in the output.
   - If client constructors, factories, or complex types require human refinement, generate a starter overrides file:
     \`\`\`bash
     sdk-anything inspect <source> --write-overrides
     \`\`\`
   - Review and edit \`sdk-anything.overrides.json\` to set credential environment variable references (e.g. \`env:API_KEY\`) or review effect levels.

3. **Generate Artifacts:**
   Run the generator:
   \`\`\`bash
   sdk-anything generate <source> --targets mcp,cli --output ./generated/<name>
   \`\`\`
   If optional AI assistance is desired and configured via \`OPENAI_API_KEY\`:
   \`\`\`bash
   sdk-anything generate <source> --targets mcp,cli --ai --output ./generated/<name>
   \`\`\`

4. **Statically Validate:**
   Validate the generated manifest and adapters:
   \`\`\`bash
   sdk-anything validate ./generated/<name>
   \`\`\`

5. **Test (Opt-in Execution):**
   - Untrusted remote code requires a container sandbox:
     \`\`\`bash
     sdk-anything test ./generated/<name> --sandbox
     \`\`\`
   - User-owned local trusted code can run in a sanitized local process:
     \`\`\`bash
     sdk-anything test ./generated/<name> --trusted-local
     \`\`\`

## Invariants and Safety Policy

- **No arbitrary code execution:** Static inspection and validation never execute target package code or lifecycle scripts.
- **Atomic operations only:** v0.1 generates atomic operations. Do not construct multi-step executable composite tools.
- **Secrets:** Represent all credentials as references like \`env:TOKEN\`. Never output or persist raw secret values.
- **Effects:** Pure and read operations are enabled by default; write, destructive, and unknown effects are disabled by default.
