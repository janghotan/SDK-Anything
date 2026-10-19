import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { resolveSource } from "../../src/source/index.js";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";
import {
  buildManifest,
  validateManifest,
  applyOverrides,
} from "../../src/manifest/index.js";
import { generateArtifacts } from "../../src/generators/index.js";
import { createMcpServer } from "../../src/generators/mcp/index.js";
import { createGeneratedCli } from "../../src/generators/cli/index.js";
import { invokeOperation } from "../../src/runtime/invoker.js";
import { startMockServer } from "../fixtures/client-sdk/test-server.js";

describe("Phase 01: Core User Journeys End-to-End Harness", () => {
  describe("Pure-Function SDK Journey (Turf)", () => {
    const turfSourceDir = path.resolve("examples/turf");
    let tempDir: string;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-journey-turf-"));
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("runs complete journey: inspect -> manifest -> atomic generation -> CLI & MCP verification", async () => {
      // 1. Inspect
      const snapshot = await resolveSource(turfSourceDir);
      expect(snapshot.kind).toBe("local");
      expect(snapshot.version).toBe("7.2.0");

      const evidence = await analyzeSourceSnapshot(snapshot);
      expect(evidence.functions.some((f) => f.name === "distance")).toBe(true);

      // 2. Build and Validate Manifest
      const manifest = buildManifest(evidence);
      const validation = validateManifest(manifest);
      expect(validation.valid).toBe(true);

      // 3. Atomically Generate Artifacts
      const writtenFiles = generateArtifacts(manifest, ["mcp", "cli"], tempDir);
      expect(writtenFiles.length).toBeGreaterThanOrEqual(10);
      expect(fs.existsSync(path.join(tempDir, "README.md"))).toBe(true);
      expect(
        fs.existsSync(path.join(tempDir, "capability-manifest.json")),
      ).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "SKILL.md"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "cli/cli.ts"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "mcp/server.ts"))).toBe(true);

      // Verify README contains accurate quickstart and safety summary
      const readmeText = fs.readFileSync(
        path.join(tempDir, "README.md"),
        "utf8",
      );
      expect(readmeText).toContain("Generated Agent Capabilities");
      expect(readmeText).toContain("node dist/cli.js --help");
      expect(readmeText).toContain("Safety & Policy Defaults");

      // 4. CLI Execution
      const turfModule = await import("../../examples/turf/src/index.js");
      let cliOutput = "";
      const cli = createGeneratedCli(manifest, {
        sdkModule: turfModule,
        writeOut: (str: string) => {
          cliOutput += str;
        },
        writeErr: () => {},
        exitOverride: true,
      });

      // Info introspection command
      await cli.parseAsync(["node", "cli", "info", "--json"]);
      const infoParsed = JSON.parse(cliOutput);
      expect(infoParsed.package).toBe("@example/turf-sample");
      expect(infoParsed.operationsCount).toBe(2);

      // List introspection command
      cliOutput = "";
      await cli.parseAsync(["node", "cli", "list", "--json"]);
      const listParsed = JSON.parse(cliOutput);
      expect(listParsed.some((op: any) => op.id === "distance")).toBe(true);

      // Distance operation invocation
      cliOutput = "";
      await cli.parseAsync([
        "node",
        "cli",
        "distance",
        "--input",
        JSON.stringify({
          from: [-75.343, 39.984],
          to: [-75.534, 39.123],
          options: { units: "miles" },
        }),
        "--json",
      ]);
      expect(cliOutput.trim()).toBe("60.37");

      // 5. MCP Tool Call via Official Client
      const mcpServer = createMcpServer(manifest, { sdkModule: turfModule });
      const mcpClient = new Client(
        { name: "test-turf-e2e-mcp-client", version: "0.1.0" },
        { capabilities: {} },
      );
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();

      await Promise.all([
        mcpServer.connect(serverTransport),
        mcpClient.connect(clientTransport),
      ]);

      const tools = await mcpClient.listTools();
      expect(tools.tools.some((t) => t.name === "distance")).toBe(true);

      const mcpResult = (await mcpClient.callTool({
        name: "distance",
        arguments: {
          from: [-75.343, 39.984],
          to: [-75.534, 39.123],
          options: { units: "miles" },
        },
      })) as any;

      expect(mcpResult.isError).toBeFalsy();
      expect(mcpResult.content[0].text).toBe("60.37");
      await Promise.all([mcpClient.close(), mcpServer.close()]);
    });
  });

  describe("Authenticated Client SDK Journey (Loopback Client)", () => {
    let tempDir: string;
    let server: Awaited<ReturnType<typeof startMockServer>>;

    beforeAll(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-journey-client-"));
      server = await startMockServer(0);
    });

    afterAll(async () => {
      await server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("exercises overrides, credential mapping, safe pagination, and fail-closed destructive policy", async () => {
      const clientFixture = path.resolve("tests/fixtures/client-sdk");
      const evidence = await analyzeSourceSnapshot(clientFixture);
      let manifest = buildManifest(evidence);

      // Apply overrides to configure client auth
      manifest = applyOverrides(manifest, {
        schemaVersion: "sdk-anything/overrides/v1",
        client: {
          construction: "class",
          export: "TestApiClient",
          options: {
            apiKey: {
              type: "secret",
              source: "env:MOCK_CLIENT_SECRET_KEY",
              required: true,
            },
            baseUrl: {
              type: "string",
              source: "env:MOCK_CLIENT_BASE_URL",
              required: false,
            },
          },
        },
      });

      // Generate project
      generateArtifacts(manifest, ["mcp", "cli"], tempDir);
      const clientModule = await import("../fixtures/client-sdk/src/index.js");

      // 1. Success path: read query with valid credentials
      const readRes = await invokeOperation(
        manifest,
        "testapiclient.listItems",
        { query: { limit: 2 } },
        {
          sdkModule: clientModule,
          env: {
            MOCK_CLIENT_SECRET_KEY: "synthetic-secret-token-42",
            MOCK_CLIENT_BASE_URL: server.baseUrl,
          },
        },
      );
      expect(readRes.success).toBe(true);
      expect((readRes.data as any).items.length).toBe(2);

      // 2. Auth error with secret redaction
      const authErrRes = await invokeOperation(
        manifest,
        "testapiclient.listItems",
        { query: { limit: 2 } },
        {
          sdkModule: clientModule,
          env: {
            MOCK_CLIENT_SECRET_KEY: "wrong-bad-key",
            MOCK_CLIENT_BASE_URL: server.baseUrl,
          },
        },
      );
      expect(authErrRes.success).toBe(false);
      expect(authErrRes.error?.code).toBe("AUTH_REQUIRED");
      expect(JSON.stringify(authErrRes)).not.toContain("wrong-bad-key");

      // 3. Destructive operation policy enforcement: fail-closed in non-interactive environment
      const deleteRes = await invokeOperation(
        manifest,
        "testapiclient.deleteItem",
        { id: "item-1" },
        {
          sdkModule: clientModule,
          interactive: false,
          allowDestructive: false,
          env: {
            MOCK_CLIENT_SECRET_KEY: "synthetic-secret-token-42",
            MOCK_CLIENT_BASE_URL: server.baseUrl,
          },
        },
      );
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error?.code).toBe("POLICY_DENIED");
      expect(deleteRes.error?.message).toContain("destructive");

      // 4. Authorized destructive operation with explicit --allow-destructive
      const authorizedDeleteRes = await invokeOperation(
        manifest,
        "testapiclient.deleteItem",
        { id: "item-1" },
        {
          sdkModule: clientModule,
          interactive: false,
          allowDestructive: true,
          env: {
            MOCK_CLIENT_SECRET_KEY: "synthetic-secret-token-42",
            MOCK_CLIENT_BASE_URL: server.baseUrl,
          },
        },
      );
      expect(authorizedDeleteRes.success).toBe(true);
      expect((authorizedDeleteRes.data as any).deleted).toBe(true);
    });
  });
});
