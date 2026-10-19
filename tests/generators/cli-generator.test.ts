import { describe, it, expect, vi } from "vitest";
import type { CapabilityManifest } from "../../src/manifest/types.js";
import {
  generateCliProject,
  createGeneratedCli,
  toCliCommandName,
} from "../../src/generators/cli/index.js";

describe("CLI Generator and MCP/CLI Parity", () => {
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

  it("converts operation IDs to stable CLI command names", () => {
    expect(toCliCommandName("math.add")).toBe("math-add");
    expect(toCliCommandName("records.delete")).toBe("records-delete");
  });

  it("generates inspectable TypeScript CLI project files", () => {
    const files = generateCliProject(sampleManifest);

    expect(files).toHaveProperty("cli.ts");
    expect(files).toHaveProperty("runtime.ts");
    expect(files).toHaveProperty("package.json");
    expect(files).toHaveProperty("tsconfig.json");
    expect(files).toHaveProperty("capability-manifest.json");

    const cliCode = files["cli.ts"];
    expect(cliCode).toContain("commander");
    expect(cliCode).toContain("math-add");
    expect(cliCode).not.toContain("records-delete"); // disabled by default
    expect(cliCode).toContain("--json");
  });

  it("supports introspection commands info and list", async () => {
    let stdout = "";
    const cli = createGeneratedCli(sampleManifest, {
      sdkModule: mockSdk,
      writeOut: (str: string) => {
        stdout += str;
      },
      writeErr: () => {},
      exitOverride: true,
    });

    await cli.parseAsync(["node", "cli", "info", "--json"]);
    const info = JSON.parse(stdout);
    expect(info.package).toBe("@turf/turf");
    expect(info.operationsCount).toBe(2);

    stdout = "";
    await cli.parseAsync(["node", "cli", "list", "--json"]);
    const list = JSON.parse(stdout);
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((o: any) => o.id === "math.add")).toBe(true);
  });

  it("executes generated CLI command with valid input and outputs JSON", async () => {
    let stdout = "";
    let stderr = "";
    const cli = createGeneratedCli(sampleManifest, {
      sdkModule: mockSdk,
      writeOut: (str: string) => {
        stdout += str;
      },
      writeErr: (str: string) => {
        stderr += str;
      },
      exitOverride: true,
    });

    mockSdk.add.mockClear();
    await cli.parseAsync([
      "node",
      "cli",
      "math-add",
      "--input",
      JSON.stringify({ x: 10, y: 20 }),
      "--json",
    ]);

    expect(mockSdk.add).toHaveBeenCalledWith({ x: 10, y: 20 });
    const parsed = JSON.parse(stdout);
    expect(parsed).toBe(30);
    expect(stderr).toBe("");
  });

  it("exits with non-zero error when invalid input is provided to generated CLI", async () => {
    let stderr = "";
    const cli = createGeneratedCli(sampleManifest, {
      sdkModule: mockSdk,
      writeOut: () => {},
      writeErr: (str: string) => {
        stderr += str;
      },
      exitOverride: true,
    });

    await expect(
      cli.parseAsync([
        "node",
        "cli",
        "math-add",
        "--input",
        JSON.stringify({ x: "invalid" }),
      ]),
    ).rejects.toThrow();

    expect(stderr).toContain("INVALID_INPUT");
  });

  it("disambiguates colliding command names deterministically and provides invoke escape hatch", async () => {
    const collidingManifest: CapabilityManifest = {
      schemaVersion: "sdk-anything/manifest/v1",
      generatorVersion: "0.1.0",
      source: {
        kind: "local",
        package: "colliding-sdk",
        version: "1.0.0",
        digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      operations: [
        {
          id: "billing.charge",
          name: "charge",
          summary: "Charge billing",
          description: "Charge billing account",
          invoke: { kind: "top-level-function", functionName: "charge" },
          inputSchema: { type: "object", properties: { amount: { type: "number" } } },
          effect: "pure",
          enabledByDefault: true,
          result: { mode: "direct" },
          provenance: { sourceFile: "index.ts", confidence: "high" },
        },
        {
          id: "shipping.charge",
          name: "charge",
          summary: "Charge shipping",
          description: "Charge shipping fee",
          invoke: { kind: "top-level-function", functionName: "charge" },
          inputSchema: { type: "object", properties: { amount: { type: "number" } } },
          effect: "pure",
          enabledByDefault: true,
          result: { mode: "direct" },
          provenance: { sourceFile: "index.ts", confidence: "high" },
        },
      ],
      unresolved: [],
    };

    let stdout = "";
    const mockModule = {
      charge: vi.fn((amount: any) => ({ charged: typeof amount === "object" ? amount.amount : amount })),
    };

    const cli = createGeneratedCli(collidingManifest, {
      sdkModule: mockModule,
      writeOut: (str: string) => {
        stdout += str;
      },
      writeErr: () => {},
      exitOverride: true,
    });

    // Test list command to verify both operations exist with disambiguated command names
    await cli.parseAsync(["node", "cli", "list", "--json"]);
    const list = JSON.parse(stdout);
    expect(list.length).toBe(2);

    // Test canonical escape hatch invoke <operationId>
    stdout = "";
    await cli.parseAsync([
      "node",
      "cli",
      "invoke",
      "shipping.charge",
      "--input",
      JSON.stringify({ amount: 15 }),
      "--json",
    ]);

    const result = JSON.parse(stdout);
    expect(result).toEqual({ charged: 15 });
  });
});
