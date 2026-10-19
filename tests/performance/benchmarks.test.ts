import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { resolveSource } from "../../src/source/index.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import { buildManifest } from "../../src/manifest/index.js";
import {
  serializeCanonicalManifest,
  computeManifestDigest,
} from "../../src/manifest/serializer.js";
import { generateArtifacts } from "../../src/generators/index.js";
import { invokeOperation } from "../../src/runtime/invoker.js";

describe("Phase 10: Performance, Determinism and Operational Reliability", () => {
  const turfFixture = path.resolve("examples/turf");
  const analyzerFixture = path.resolve("tests/fixtures/analyzer-types");

  it("completes static inspection, manifest build, and generation within generous performance budgets", async () => {
    // 1. Static inspection budget (< 15 seconds)
    const t0 = Date.now();
    const snapshot = await resolveSource(turfFixture);
    const evidence = await analyzeSourceSnapshot(snapshot);
    const inspectDuration = Date.now() - t0;
    expect(inspectDuration).toBeLessThan(15000);

    // 2. Manifest build budget (< 500ms)
    const t1 = Date.now();
    const manifest = buildManifest(evidence);
    const manifestDuration = Date.now() - t1;
    expect(manifestDuration).toBeLessThan(500);

    // 3. Artifact generation budget (< 1500ms)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-perf-budget-"));
    try {
      const t2 = Date.now();
      const files = generateArtifacts(manifest, ["mcp", "cli"], tempDir);
      const genDuration = Date.now() - t2;
      expect(genDuration).toBeLessThan(1500);
      expect(files.length).toBeGreaterThanOrEqual(10);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("guarantees 100% deterministic byte-identical serialization across repeated runs", async () => {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const snapshot = await resolveSource(analyzerFixture);
      const evidence = await analyzeSourceSnapshot(snapshot);
      const manifest = buildManifest(evidence);
      const serialized = serializeCanonicalManifest(manifest);
      const digest = computeManifestDigest(manifest);
      runs.push({ serialized, digest });
    }

    expect(runs[0].serialized).toBe(runs[1].serialized);
    expect(runs[1].serialized).toBe(runs[2].serialized);
    expect(runs[0].digest).toBe(runs[1].digest);
    expect(runs[1].digest).toBe(runs[2].digest);
  });

  it("enforces operation timeouts and handles cancellation via AbortSignal", async () => {
    const slowModule = {
      slowFn: async () =>
        new Promise((resolve) => setTimeout(() => resolve("done"), 2000)),
    };

    const slowManifest: any = {
      schemaVersion: "sdk-anything/manifest/v1",
      generatorVersion: "0.1.0",
      source: {
        kind: "local",
        package: "slow-sdk",
        version: "1.0.0",
        digest:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      operations: [
        {
          id: "slowFn",
          name: "slowFn",
          summary: "Slow",
          description: "Slow operation",
          invoke: { kind: "top-level-function", functionName: "slowFn" },
          inputSchema: { type: "object", properties: {} },
          effect: "pure",
          enabledByDefault: true,
          result: { mode: "direct" },
          provenance: { sourceFile: "index.ts", confidence: "high" },
        },
      ],
      unresolved: [],
    };

    // 1. Timeout test: timeoutMs: 50ms on a 2000ms operation
    const timeoutRes = await invokeOperation(
      slowManifest,
      "slowFn",
      {},
      {
        sdkModule: slowModule,
        timeoutMs: 50,
      },
    );
    expect(timeoutRes.success).toBe(false);
    expect(timeoutRes.error?.code).toBe("TIMEOUT");
    expect(timeoutRes.error?.message).toMatch(/timed out after 50ms/i);

    // 2. AbortSignal cancellation test
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const abortRes = await invokeOperation(
      slowManifest,
      "slowFn",
      {},
      {
        sdkModule: slowModule,
        timeoutMs: 5000,
        signal: controller.signal,
      },
    );
    expect(abortRes.success).toBe(false);
    expect(abortRes.error?.message).toMatch(/cancelled/i);
  });

  it("supports concurrent generation across multiple target directories without collision", async () => {
    const tempDirA = fs.mkdtempSync(
      path.join(os.tmpdir(), "sdk-concurrent-a-"),
    );
    const tempDirB = fs.mkdtempSync(
      path.join(os.tmpdir(), "sdk-concurrent-b-"),
    );

    try {
      const [snapshotA, snapshotB] = await Promise.all([
        resolveSource(turfFixture),
        resolveSource(analyzerFixture),
      ]);

      const [evidenceA, evidenceB] = await Promise.all([
        analyzeSourceSnapshot(snapshotA),
        analyzeSourceSnapshot(snapshotB),
      ]);

      const manifestA = buildManifest(evidenceA);
      const manifestB = buildManifest(evidenceB);

      const [filesA, filesB] = await Promise.all([
        Promise.resolve(generateArtifacts(manifestA, ["mcp", "cli"], tempDirA)),
        Promise.resolve(generateArtifacts(manifestB, ["mcp", "cli"], tempDirB)),
      ]);

      expect(filesA.every((f) => f.startsWith(tempDirA))).toBe(true);
      expect(filesB.every((f) => f.startsWith(tempDirB))).toBe(true);
    } finally {
      fs.rmSync(tempDirA, { recursive: true, force: true });
      fs.rmSync(tempDirB, { recursive: true, force: true });
    }
  });
});
