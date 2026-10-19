import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import {
  buildManifest,
  validateManifest,
  serializeCanonicalManifest,
  computeManifestDigest,
} from "../../src/manifest/index.js";
import {
  applyOverrides,
  generateStarterOverrides,
} from "../../src/manifest/overrides.js";
import type {
  CapabilityManifest,
  SdkAnythingOverrides,
} from "../../src/manifest/types.js";

describe("Capability Manifest Builder and Validator", () => {
  const fixturePath = path.resolve("tests/fixtures/analyzer-types");

  it("builds a valid manifest from evidence inventory", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);
    const manifest = buildManifest(evidence);

    expect(manifest.schemaVersion).toBe("sdk-anything/manifest/v1");
    expect(manifest.generatorVersion).toBe("0.1.0");
    expect(manifest.operations.length).toBeGreaterThan(0);

    const validation = validateManifest(manifest);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("classifies effects conservatively and disables write/destructive/unknown operations by default", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);
    const manifest = buildManifest(evidence);

    // Pure function: calculateDistance
    const distOp = manifest.operations.find(
      (o) => o.id === "calculateDistance",
    );
    expect(distOp).toBeDefined();
    expect(distOp?.effect).toBe("pure");
    expect(distOp?.enabledByDefault).toBe(true);

    // Read method: listItems
    const listOp = manifest.operations.find(
      (o) => o.id === "restclient.listItems",
    );
    expect(listOp).toBeDefined();
    expect(listOp?.effect).toBe("read");
    expect(listOp?.enabledByDefault).toBe(true);

    // Destructive method: deleteItem
    const deleteOp = manifest.operations.find(
      (o) => o.id === "restclient.deleteItem",
    );
    expect(deleteOp).toBeDefined();
    expect(deleteOp?.effect).toBe("destructive");
    expect(deleteOp?.enabledByDefault).toBe(false);
  });

  it("discovers operations from factory-produced client objects", async () => {
    const factoryPath = path.resolve("tests/fixtures/factory-sdk");
    const evidence = await analyzeSourceSnapshot(factoryPath);
    const manifest = buildManifest(evidence);

    expect(manifest.client?.construction).toBe("factory");
    expect(manifest.client?.export).toBe("createServiceClient");
    expect(
      manifest.operations.some(
        (o) => o.id === "createserviceclient.fetchStatus",
      ),
    ).toBe(true);
    const calculate = manifest.operations.find(
      (o) => o.id === "createserviceclient.calculate",
    );
    expect(calculate?.effect).toBe("pure");
    expect(calculate?.enabledByDefault).toBe(true);
    expect(manifest.unresolved).toHaveLength(0);
    expect(validateManifest(manifest).valid).toBe(true);
  });

  it("rejects manifest if write/destructive operation is enabledByDefault without override approval", () => {
    const invalidManifest: CapabilityManifest = {
      schemaVersion: "sdk-anything/manifest/v1",
      generatorVersion: "0.1.0",
      source: {
        kind: "local",
        package: "test-pkg",
        version: "1.0.0",
        digest:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      operations: [
        {
          id: "test.delete",
          name: "delete",
          summary: "Delete",
          description: "Delete resource",
          invoke: { kind: "top-level-function", functionName: "deleteItem" },
          inputSchema: { type: "object", properties: {} },
          effect: "destructive",
          enabledByDefault: true, // ILLEGAL: write/destructive must be disabled by default
          result: { mode: "direct" },
          provenance: { sourceFile: "index.ts", confidence: "high" },
        },
      ],
      unresolved: [],
    };

    const validation = validateManifest(invalidManifest);
    expect(validation.valid).toBe(false);
    expect(
      validation.errors.some(
        (e) => e.includes("destructive") && e.includes("enabledByDefault"),
      ),
    ).toBe(true);
  });

  it("rejects manifest containing secret values instead of env references", () => {
    const manifestWithRawSecret: any = {
      schemaVersion: "sdk-anything/manifest/v1",
      generatorVersion: "0.1.0",
      source: {
        kind: "local",
        package: "test-pkg",
        version: "1.0.0",
        digest:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      client: {
        module: "test-pkg",
        export: "Client",
        construction: "class",
        options: {
          token: {
            type: "secret",
            source: "my-raw-secret-value-12345", // NOT an env: reference!
            required: true,
          },
        },
      },
      operations: [],
      unresolved: [],
    };

    const validation = validateManifest(manifestWithRawSecret);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => /secret.*env:/i.test(e))).toBe(true);
  });

  it("produces byte-stable canonical JSON serialization and consistent digests", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);
    const manifest = buildManifest(evidence);

    const json1 = serializeCanonicalManifest(manifest);
    const json2 = serializeCanonicalManifest(manifest);
    expect(json1).toBe(json2);

    const digest1 = computeManifestDigest(manifest);
    const digest2 = computeManifestDigest(manifest);
    expect(digest1).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(digest1).toBe(digest2);
  });
});

describe("Human Overrides Workflow", () => {
  const fixturePath = path.resolve("tests/fixtures/analyzer-types");

  it("generates a starter sdk-anything.overrides.json with unresolved symbols and client options", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);
    const manifest = buildManifest(evidence);
    const starter = generateStarterOverrides(manifest);

    expect(starter.schemaVersion).toBe("sdk-anything/overrides/v1");
    expect(starter.operations).toBeDefined();
    // Destructive operation is present as disabled
    expect(starter.operations).toHaveProperty("restclient.deleteItem");
  });

  it("applies reviewed overrides and records provenance without altering source", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);
    const manifest = buildManifest(evidence);

    const overrides: SdkAnythingOverrides = {
      schemaVersion: "sdk-anything/overrides/v1",
      client: {
        construction: "class",
        export: "RestClient",
        options: {
          apiKey: {
            type: "secret",
            source: "env:REST_CLIENT_API_KEY",
            required: true,
          },
        },
      },
      operations: {
        "restclient.deleteItem": {
          effect: "destructive",
          enabledByDefault: true, // explicit user opt-in in override
        },
      },
    };

    const updated = applyOverrides(manifest, overrides);
    expect(updated.client?.options.apiKey.source).toBe(
      "env:REST_CLIENT_API_KEY",
    );

    const deleteOp = updated.operations.find(
      (o) => o.id === "restclient.deleteItem",
    );
    expect(deleteOp?.enabledByDefault).toBe(true);
    expect(deleteOp?.provenance.overridesApplied).toContain("enabledByDefault");

    // Validates clean
    const val = validateManifest(updated);
    expect(val.valid).toBe(true);
  });

  it("rejects overrides targeting non-existent operation IDs", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);
    const manifest = buildManifest(evidence);

    const badOverrides: SdkAnythingOverrides = {
      schemaVersion: "sdk-anything/overrides/v1",
      operations: {
        "nonexistent.op": {
          enabledByDefault: true,
        },
      },
    };

    expect(() => applyOverrides(manifest, badOverrides)).toThrow(
      /unknown operation.*nonexistent\.op/i,
    );
  });
});
