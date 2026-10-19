import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import { buildManifest, applyOverrides, validateManifest } from "../../src/manifest/index.js";
import { invokeOperation } from "../../src/runtime/index.js";
import type { SdkAnythingOverrides } from "../../src/manifest/types.js";

describe("Phase 02: SDK Compatibility and Edge Cases", () => {
  const analyzerFixture = path.resolve("tests/fixtures/analyzer-types");

  it("handles re-exported and default exports without duplicate collision or loss", async () => {
    const evidence = await analyzeSourceSnapshot(analyzerFixture);
    const manifest = buildManifest(evidence);

    // Verify operations have unique IDs
    const ids = manifest.operations.map((o) => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // Verify default and named exports are cleanly represented
    expect(manifest.operations.some((o) => o.id === "calculateDistance")).toBe(true);
    expect(manifest.operations.some((o) => o.id === "formatCoordinate")).toBe(true);
  });

  it("promotes unresolved symbols to executable operations when human overrides supply schemas", async () => {
    const evidence = await analyzeSourceSnapshot(analyzerFixture);
    const manifest = buildManifest(evidence);

    // 'listenEvents' was unresolved due to callback parameter
    expect(manifest.unresolved.some((u) => u.id === "listenEvents")).toBe(true);
    expect(manifest.operations.some((o) => o.id === "listenEvents")).toBe(false);

    // Provide reviewed override schema for listenEvents
    const overrides: SdkAnythingOverrides = {
      schemaVersion: "sdk-anything/overrides/v1",
      operations: {
        listenEvents: {
          inputSchema: {
            type: "object",
            properties: {
              eventType: { type: "string" },
            },
            required: ["eventType"],
            additionalProperties: false,
          },
          effect: "read",
          enabledByDefault: true,
        },
      },
    };

    const updatedManifest = applyOverrides(manifest, overrides);
    expect(updatedManifest.unresolved.some((u) => u.id === "listenEvents")).toBe(false);
    expect(updatedManifest.operations.some((o) => o.id === "listenEvents")).toBe(true);

    const promotedOp = updatedManifest.operations.find((o) => o.id === "listenEvents");
    expect(promotedOp?.enabledByDefault).toBe(true);
    expect(promotedOp?.effect).toBe("read");
    expect(promotedOp?.provenance.overridesApplied).toContain("inputSchema");

    const validation = validateManifest(updatedManifest);
    expect(validation.valid).toBe(true);
  });

  it("fails with pathful error when override references an invalid operation ID", async () => {
    const evidence = await analyzeSourceSnapshot(analyzerFixture);
    const manifest = buildManifest(evidence);

    const invalidOverrides: SdkAnythingOverrides = {
      schemaVersion: "sdk-anything/overrides/v1",
      operations: {
        "completely.nonexistent.symbol": {
          enabledByDefault: true,
        },
      },
    };

    expect(() => applyOverrides(manifest, invalidOverrides)).toThrow(
      /Unknown operation ID in overrides: 'completely\.nonexistent\.symbol'/i,
    );
  });

  it("handles default export classes and factory functions in client lifecycle", async () => {
    // SDK module exporting a default class
    class DefaultExportClient {
      config: any;
      constructor(config: any) {
        this.config = config;
      }
      async ping() {
        return { pong: true };
      }
    }

    const mockModuleWithDefault = {
      default: DefaultExportClient,
    };

    const clientManifest: any = {
      schemaVersion: "sdk-anything/manifest/v1",
      generatorVersion: "0.1.0",
      source: {
        kind: "local",
        package: "default-client-sdk",
        version: "1.0.0",
        digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      client: {
        module: "default-client-sdk",
        export: "default",
        construction: "class",
        options: {},
      },
      operations: [
        {
          id: "client.ping",
          name: "ping",
          summary: "Ping",
          description: "Ping server",
          invoke: {
            kind: "instance-method",
            receiver: "default",
            method: "ping",
          },
          inputSchema: { type: "object", properties: {} },
          effect: "read",
          enabledByDefault: true,
          result: { mode: "direct" },
          provenance: { sourceFile: "index.ts", confidence: "high" },
        },
      ],
      unresolved: [],
    };

    const res = await invokeOperation(clientManifest, "client.ping", {}, {
      sdkModule: mockModuleWithDefault,
    });

    expect(res.success).toBe(true);
    expect(res.data).toEqual({ pong: true });
  });
});
