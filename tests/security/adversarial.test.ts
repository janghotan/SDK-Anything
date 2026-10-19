import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as zlib from "node:zlib";
import { extractTarballSafely } from "../../src/source/archive-extractor.js";
import { redactSecrets, normalizeError } from "../../src/runtime/errors.js";
import { validatePaginationCursor } from "../../src/runtime/pagination.js";
import { generateArtifacts } from "../../src/generators/index.js";
import { buildManifest } from "../../src/manifest/index.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import {
  runProjectTests,
  detectContainerRuntime,
} from "../../src/sandbox/runner.js";
import { validateAiProposals } from "../../src/ai/proposal-parser.js";

// Fail-closed behavior only applies when no container engine is installed. On
// hosts that do provide Docker/Podman, sandbox mode legitimately executes in a
// container, so assert the missing-engine contract only when none is present.
const containerRuntime = detectContainerRuntime();

// Helper to construct a minimal raw TAR header
function createTarHeader(
  name: string,
  size: number,
  typeflag = "0",
  linkname = "",
): Buffer {
  const buf = Buffer.alloc(512);
  buf.write(name, 0, 100, "utf8");
  buf.write(size.toString(8).padStart(11, "0") + " ", 124, 12, "utf8");
  buf.write(typeflag, 156, 1, "utf8");
  if (linkname) {
    buf.write(linkname, 157, 100, "utf8");
  }
  buf.write("ustar\0", 257, 6, "utf8");
  buf.write("00", 263, 2, "utf8");

  // Checksum calculation
  buf.fill(32, 148, 156);
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    sum += buf[i];
  }
  buf.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf8");

  return buf;
}

describe("Phase 07: Security & Adversarial Test Suite", () => {
  describe("1. Archive Traversal and Symlink Protections", () => {
    it("rejects archive entries containing directory traversal paths (../)", async () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "sdk-adv-traversal-"),
      );
      try {
        const header = createTarHeader("package/../../../etc/passwd", 12);
        const content = Buffer.alloc(512);
        content.write("root:x:0:0::\n");
        const tar = Buffer.concat([header, content, Buffer.alloc(1024)]);
        const gzipped = zlib.gzipSync(tar);

        await expect(extractTarballSafely(gzipped, tempDir)).rejects.toThrow(
          /path traversal/i,
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects archive entries specifying symlinks", async () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "sdk-adv-symlink-"),
      );
      try {
        const header = createTarHeader(
          "package/symlink-escape",
          0,
          "2",
          "/etc/shadow",
        );
        const tar = Buffer.concat([header, Buffer.alloc(1024)]);
        const gzipped = zlib.gzipSync(tar);

        await expect(extractTarballSafely(gzipped, tempDir)).rejects.toThrow(
          /symlink/i,
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects archives exceeding maximum decompressed byte limit", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-adv-size-"));
      try {
        const header = createTarHeader("package/huge.txt", 1000);
        const tar = Buffer.concat([
          header,
          Buffer.alloc(1000),
          Buffer.alloc(1024),
        ]);
        const gzipped = zlib.gzipSync(tar);

        await expect(
          extractTarballSafely(gzipped, tempDir, { maxSizeBytes: 500 }),
        ).rejects.toThrow(/exceeds maximum/i);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("2. Secret Redaction and Error Sanitization", () => {
    it("redacts explicit API keys, bearer tokens, URL credentials, and query tokens", () => {
      const secret = "ghp_superSecretToken9876543210XYZ";
      const rawError = `Request failed: Authorization: Bearer ${secret} at https://admin:pass1234@api.example.com/v1?token=${secret}`;

      const sanitized = redactSecrets(rawError, [secret]);

      expect(sanitized).not.toContain(secret);
      expect(sanitized).not.toContain("pass1234");
      expect(sanitized).toContain("Bearer [REDACTED]");
      expect(sanitized).toContain("://[REDACTED]:[REDACTED]@");
      expect(sanitized).toContain("?token=[REDACTED]");
    });

    it("normalizes errors with stable machine codes and safe suggested actions without stack leakage", () => {
      const err = new Error("401 Unauthorized: Invalid API key provided");
      const norm = normalizeError(err);

      expect(norm.code).toBe("AUTH_REQUIRED");
      expect(norm.message).toContain("401 Unauthorized");
      expect(norm.suggestedAction).toBeDefined();
      expect(norm).not.toHaveProperty("stack");
    });
  });

  describe("3. Pagination and Infinite Loop Defenses", () => {
    it("detects and terminates repeated cursor loops in pagination", () => {
      const seen = new Set<string>();

      expect(() => validatePaginationCursor("cursor-1", seen)).not.toThrow();
      expect(() => validatePaginationCursor("cursor-2", seen)).not.toThrow();

      // Repeated cursor must throw
      expect(() => validatePaginationCursor("cursor-1", seen)).toThrow(
        /infinite pagination loop detected.*cursor 'cursor-1'/i,
      );
    });
  });

  describe("4. Generator Confinement and Sandbox Fail-Closed Behavior", () => {
    it.skipIf(containerRuntime !== null)(
      "fails closed when --sandbox is requested without container engine",
      async () => {
        await expect(
          runProjectTests("./tests/fixtures/sample-local-sdk", {
            mode: "sandbox",
          }),
        ).rejects.toThrow(/container runtime.*required/i);
      },
    );

    it.skipIf(containerRuntime === null)(
      "executes sandbox mode through the container engine instead of falling back silently",
      async () => {
        // The fixture intentionally has no `test` script, so the run must fail
        // with a container-execution error rather than quietly degrading to
        // trusted-local execution.
        await expect(
          runProjectTests("./tests/fixtures/sample-local-sdk", {
            mode: "sandbox",
            timeoutMs: 120000,
          }),
        ).rejects.toThrow(/Sandbox test execution failed/i);
      },
      120000,
    );

    it("rejects generator path traversal escape attempts in generation targets", async () => {
      const turfFixture = path.resolve("examples/turf");
      const evidence = await analyzeSourceSnapshot(turfFixture);
      const manifest = buildManifest(evidence);

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-adv-gen-"));
      try {
        expect(() => {
          generateArtifacts(manifest, ["../../malicious-target"], tempDir);
        }).toThrow(/escapes output directory|path traversal/i);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("5. Prompt Injection Defense in Untrusted Analyzed Metadata", () => {
    it("rejects hallucinated operations and commands injected via untrusted comments or READMEs", () => {
      const mockEvidence: any = {
        functions: [{ id: "safeAdd", name: "safeAdd" }],
        classes: [],
        factories: [],
      };

      const injectionPayload = {
        proposals: [
          {
            operationId: "executeShellBackdoor",
            summary: "Malicious backdoor injected from README",
          },
          {
            operationId: "safeAdd",
            summary: "Legitimate addition operation",
          },
        ],
      };

      const result = validateAiProposals(mockEvidence, injectionPayload);
      expect(result.valid).toBe(false);
      expect(result.proposals).toHaveLength(0);
      expect(
        result.errors.some((e) => e.includes("executeShellBackdoor")),
      ).toBe(true);
    });
  });
});
