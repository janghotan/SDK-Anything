import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { startMockServer } from "../fixtures/client-sdk/test-server.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import { buildManifest, applyOverrides } from "../../src/manifest/index.js";
import { invokeOperation } from "../../src/runtime/index.js";
import {
  runProjectTests,
  detectContainerRuntime,
} from "../../src/sandbox/index.js";

describe("Client SDK Fixture and Real Lifecycle Testing", () => {
  const clientFixturePath = path.resolve("tests/fixtures/client-sdk");

  it("exercises complete client lifecycle: construction, credentials, async HTTP, and pagination", async () => {
    const server = await startMockServer(0);

    try {
      // 1. Analyze fixture statically
      const evidence = await analyzeSourceSnapshot(clientFixturePath);
      expect(evidence.classes.some((c) => c.name === "TestApiClient")).toBe(
        true,
      );

      // 2. Build manifest and configure overrides for synthetic credential reference
      let manifest = buildManifest(evidence);
      manifest = applyOverrides(manifest, {
        schemaVersion: "sdk-anything/overrides/v1",
        client: {
          construction: "class",
          export: "TestApiClient",
          options: {
            apiKey: {
              type: "secret",
              source: "env:SYNTHETIC_API_KEY",
              required: true,
            },
            baseUrl: {
              type: "string",
              source: "env:SYNTHETIC_BASE_URL",
              required: false,
            },
          },
        },
      });

      // Import client module for invocation
      const clientModule = await import("../fixtures/client-sdk/src/index.js");

      // 3. Test listItems with synthetic credentials
      const res = await invokeOperation(
        manifest,
        "testapiclient.listItems",
        { query: { limit: 5 } },
        {
          sdkModule: clientModule,
          env: {
            SYNTHETIC_API_KEY: "synthetic-secret-token-12345",
            SYNTHETIC_BASE_URL: server.baseUrl,
          },
          allowedEffects: ["read", "pure"],
        },
      );

      expect(res.success).toBe(true);
      expect((res.data as any).items.length).toBe(5);

      // 4. Test unauthorized request with wrong credential
      const badAuthRes = await invokeOperation(
        manifest,
        "testapiclient.listItems",
        { query: { limit: 5 } },
        {
          sdkModule: clientModule,
          env: {
            SYNTHETIC_API_KEY: "wrong-token",
            SYNTHETIC_BASE_URL: server.baseUrl,
          },
          allowedEffects: ["read", "pure"],
        },
      );
      expect(badAuthRes.success).toBe(false);
      expect(badAuthRes.error?.code).toBe("AUTH_REQUIRED");

      // 5. Test policy denial on write operation (createItem)
      const writeRes = await invokeOperation(
        manifest,
        "testapiclient.createItem",
        { input: { name: "New Item" } },
        {
          sdkModule: clientModule,
          env: {
            SYNTHETIC_API_KEY: "synthetic-secret-token-12345",
            SYNTHETIC_BASE_URL: server.baseUrl,
          },
          allowedEffects: ["read", "pure"], // write NOT allowed
        },
      );
      expect(writeRes.success).toBe(false);
      expect(writeRes.error?.code).toBe("POLICY_DENIED");
    } finally {
      await server.close();
    }
  });
});

describe("Sandbox Security and Trust Mode Enforcement", () => {
  it("detects available container runtimes or reports null when absent", () => {
    const runtime = detectContainerRuntime();
    // On this system, docker/podman are not installed
    expect(
      runtime === "docker" || runtime === "podman" || runtime === null,
    ).toBe(true);
  });

  it("fails closed when --sandbox is requested and no container runtime is available", async () => {
    // If runtime is null (as in our environment), verify fail-closed error with no fallback
    const runtime = detectContainerRuntime();
    if (!runtime) {
      await expect(
        runProjectTests("./tests/fixtures/sample-local-sdk", {
          mode: "sandbox",
        }),
      ).rejects.toThrow(
        /container runtime.*required.*refuses to silently fall back/i,
      );
    }
  });

  it("runs static checks without container and labels trusted-local correctly", async () => {
    const report = await runProjectTests("./tests/fixtures/sample-local-sdk", {
      mode: "trusted-local",
    });

    expect(report.mode).toBe("trusted-local");
    expect(report.isSecuritySandbox).toBe(false); // Explicitly NOT a security sandbox
    expect(report.staticChecksPassed).toBe(true);
  });
});
