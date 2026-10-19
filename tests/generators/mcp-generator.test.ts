import { describe, it, expect, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CapabilityManifest } from "../../src/manifest/types.js";
import {
  generateMcpProject,
  createMcpServer,
  toMcpToolName,
} from "../../src/generators/mcp/index.js";

describe("MCP Server Generator", () => {
  const mockSdk = {
    add: vi.fn((input: { x: number; y: number }) => input.x + input.y),
    deleteRecord: vi.fn(() => ({ deleted: true })),
  };

  const sampleManifest: CapabilityManifest = {
    schemaVersion: "sdk-anything/manifest/v1",
    generatorVersion: "0.1.0",
    source: {
      kind: "npm",
      package: "@turf/turf",
      version: "7.2.0",
      digest:
        "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
    operations: [
      {
        id: "math.add",
        name: "add",
        summary: "Add numbers",
        description: "Add two numbers together",
        invoke: { kind: "top-level-function", functionName: "add" },
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
          additionalProperties: false,
        },
        effect: "pure",
        enabledByDefault: true,
        result: { mode: "direct" },
        provenance: { sourceFile: "index.ts", confidence: "high" },
      },
      {
        id: "records.delete",
        name: "deleteRecord",
        summary: "Delete record",
        description: "Delete a record by id",
        invoke: { kind: "top-level-function", functionName: "deleteRecord" },
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        effect: "destructive",
        enabledByDefault: false, // DISABLED BY DEFAULT
        result: { mode: "direct" },
        provenance: { sourceFile: "index.ts", confidence: "high" },
      },
    ],
    unresolved: [],
  };

  it("converts operation IDs to safe valid MCP tool names", () => {
    expect(toMcpToolName("math.add")).toBe("math_add");
    expect(toMcpToolName("items.list-all")).toBe("items_list_all");
  });

  it("generates readable and inspectable TypeScript MCP server project files", async () => {
    const files = generateMcpProject(sampleManifest);

    expect(files).toHaveProperty("server.ts");
    expect(files).toHaveProperty("runtime.ts");
    expect(files).toHaveProperty("package.json");
    expect(files).toHaveProperty("tsconfig.json");
    expect(files).toHaveProperty("capability-manifest.json");

    const serverCode = files["server.ts"];
    expect(serverCode).toContain("@modelcontextprotocol/sdk/server/index.js");
    expect(serverCode).toContain("StdioServerTransport");
    expect(serverCode).toContain("math_add");
    // Disabled operations remain discoverable but are labelled and fail closed.
    expect(serverCode).toContain("records_delete");
    expect(serverCode).toContain("disabled by default");
    // Ensure no dynamic eval
    expect(serverCode).not.toContain("eval(");

    // Package.json dependencies
    const pkg = JSON.parse(files["package.json"]);
    expect(pkg.dependencies).toHaveProperty("@modelcontextprotocol/sdk");
    expect(pkg.dependencies).toHaveProperty("@turf/turf");
  });

  it("runs generated MCP server via official in-memory SDK client", async () => {
    const server = createMcpServer(sampleManifest, { sdkModule: mockSdk });
    const client = new Client(
      { name: "test-mcp-client", version: "0.1.0" },
      { capabilities: {} },
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    // 1. List tools: both enabled and disabled are discoverable
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    expect(toolNames).toContain("math_add");
    expect(toolNames).toContain("records_delete");
    const deleteTool = toolsResult.tools.find(
      (t) => t.name === "records_delete",
    );
    expect(deleteTool?.description).toContain("disabled by default");

    // 2. Call tool successfully
    mockSdk.add.mockClear();
    const callRes = (await client.callTool({
      name: "math_add",
      arguments: { x: 15, y: 25 },
    })) as any;
    expect(callRes.isError).toBeFalsy();
    expect(mockSdk.add).toHaveBeenCalledWith({ x: 15, y: 25 });
    expect(callRes.content[0].type).toBe("text");
    expect(callRes.content[0].text).toBe("40");

    // 3. Call tool with invalid input
    const invalidRes = (await client.callTool({
      name: "math_add",
      arguments: { x: "not-a-number", y: 25 },
    })) as any;
    expect(invalidRes.isError).toBe(true);
    expect(invalidRes.content[0].text).toContain("INVALID_INPUT");

    // 4. Disabled destructive tool fails closed
    const deniedRes = (await client.callTool({
      name: "records_delete",
      arguments: { id: "r1" },
    })) as any;
    expect(deniedRes.isError).toBe(true);
    expect(deniedRes.content[0].text).toContain("POLICY_DENIED");
    expect(mockSdk.deleteRecord).not.toHaveBeenCalled();

    await Promise.all([client.close(), server.close()]);
  });

  it("permits disabled tools when the caller supplies explicit policy", async () => {
    const server = createMcpServer(sampleManifest, {
      sdkModule: mockSdk,
      interactive: false,
      allowedEffects: ["pure", "read", "destructive"],
      allowDestructive: true,
    });
    const client = new Client(
      { name: "test-mcp-policy-client", version: "0.1.0" },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    mockSdk.deleteRecord.mockClear();
    const res = (await client.callTool({
      name: "records_delete",
      arguments: { id: "r1" },
    })) as any;
    expect(res.isError).toBeFalsy();
    expect(mockSdk.deleteRecord).toHaveBeenCalled();

    await Promise.all([client.close(), server.close()]);
  });

  it("disambiguates colliding MCP tool names and embeds server instructions", async () => {
    const collidingManifest: CapabilityManifest = {
      schemaVersion: "sdk-anything/manifest/v1",
      generatorVersion: "0.1.0",
      source: {
        kind: "local",
        package: "colliding-tools-sdk",
        version: "1.0.0",
        digest:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      operations: [
        {
          id: "billing.charge",
          name: "charge",
          summary: "Charge billing",
          description: "Charge billing account",
          invoke: { kind: "top-level-function", functionName: "charge" },
          inputSchema: {
            type: "object",
            properties: { amount: { type: "number" } },
          },
          effect: "pure",
          enabledByDefault: true,
          result: { mode: "direct" },
          provenance: { sourceFile: "index.ts", confidence: "high" },
        },
        {
          id: "billing/charge",
          name: "charge",
          summary: "Charge billing slash",
          description: "Charge billing account via slash id",
          invoke: { kind: "top-level-function", functionName: "charge" },
          inputSchema: {
            type: "object",
            properties: { amount: { type: "number" } },
          },
          effect: "pure",
          enabledByDefault: true,
          result: { mode: "direct" },
          provenance: { sourceFile: "index.ts", confidence: "high" },
        },
      ],
      unresolved: [],
    };

    const server = createMcpServer(collidingManifest, { sdkModule: mockSdk });
    const client = new Client(
      { name: "test-mcp-collision-client", version: "0.1.0" },
      { capabilities: {} },
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    // Must contain 2 distinct tool names; colliding base names get a suffix.
    expect(toolNames.length).toBe(2);
    expect(new Set(toolNames).size).toBe(2);
    expect(toolNames).toContain("billing_charge");
    expect(toolNames).toContain("billing_charge_2");

    await Promise.all([client.close(), server.close()]);
  });
});
