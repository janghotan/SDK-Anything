# Contributing to SDK-Anything

Thank you for your interest in making software libraries agent-native! This document guides you through developing, testing, and contributing to SDK-Anything.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `>= 20.0.0` (LTS recommended)
- **pnpm**: `>= 9.0.0`
- **Git**

```bash
# 1. Clone repository
git clone https://github.com/janghotan/SDK-Anything.git
cd SDK-Anything

# 2. Install dependencies
pnpm install

# 3. Build project
pnpm run build

# 4. Run test suite
pnpm test
```

---

## 🧪 Testing and Quality Gates

Before submitting changes, ensure all quality gates pass:

```bash
# Typecheck
pnpm run typecheck

# Lint
pnpm run lint

# Full test suite
pnpm test

# Production build
pnpm run build

# Package tarball integrity verification
npm pack --dry-run
```

---

## 🧭 Architecture Map

```text
src/
├── source/          # Safe npm, local, and GitHub resolvers (offline, zero-exec)
├── analyzer/        # TypeScript Compiler API AST scanner and type lowering
├── manifest/        # Capability Manifest v1 schema, validator, builder, overrides
├── generators/      # MCP server, CLI, consumer SKILL.md, and inventory generators
├── runtime/         # Shared invocation harness, policy enforcer, secret redaction
├── ai/              # Optional AI proposal adapter, prompt injection defense, disclosure
├── sandbox/         # Static checks, trusted-local runner, container isolation
├── compatibility/   # Fixture catalog and automated compatibility runner
└── cli/             # CLI commands (inspect, generate, validate, test, doctor)
```

---

## 📦 Adding a Fixture to the Compatibility Lab

To test a new SDK pattern:

1. **Create the fixture:**
   Place a minimal TypeScript/JavaScript SDK package in `tests/fixtures/<your-fixture-name>/` containing `package.json` and `src/index.ts`.
2. **Register in catalog:**
   Add a new entry to `FIXTURE_CATALOG` in `src/compatibility/catalog.ts`:
   ```ts
   {
     id: "my-sdk-pattern",
     name: "My SDK Pattern",
     relativePath: "tests/fixtures/my-sdk-pattern",
     shape: "pure-function", // or "authenticated-client", etc.
     expectedOperationsCount: 2,
     expectSuccess: true,
     notes: "Demonstrates specific TypeScript export pattern",
   }
   ```
3. **Verify:**
   Run the compatibility lab:
   ```bash
   pnpm vitest run tests/compatibility/compatibility-lab.test.ts
   ```

---

## 📝 Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): ...` for new features or capabilities
- `fix(scope): ...` for bug fixes
- `docs(scope): ...` for documentation changes
- `test(scope): ...` for test additions or updates
- `chore(scope): ...` for tooling, packaging, or maintenance

---

## 🔒 Responsible Security Disclosure

If you discover a security vulnerability (such as a path traversal flaw, credential leakage, or sandbox escape), please report it responsibly by contacting the maintainers directly or opening a confidential security advisory on GitHub. Do not publish zero-day exploits in public issues.
