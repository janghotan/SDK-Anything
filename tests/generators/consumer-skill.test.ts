import { describe, it, expect } from "vitest";
import type { CapabilityManifest } from "../../src/manifest/types.js";
import { generateConsumerSkill } from "../../src/generators/consumer-skill/index.js";

describe("Consumer SKILL.md Generator", () => {
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
    client: {
      module: "@turf/turf",
      export: "TurfClient",
      construction: "class",
      options: {
        token: {
          type: "secret",
          source: "env:TURF_API_TOKEN",
          required: true,
          description: "Access token for Turf API",
        },
      },
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
        enabledByDefault: false,
        result: { mode: "direct" },
        provenance: { sourceFile: "index.ts", confidence: "high" },
      },
    ],
    unresolved: [],
  };

  it("generates consumer SKILL.md with instructions, tools table, configuration, and composition guidance", () => {
    const markdown = generateConsumerSkill(sampleManifest);

    expect(markdown).toContain("# @turf/turf Capability Skill");
    expect(markdown).toContain("TURF_API_TOKEN");
    expect(markdown).toContain("math_add");
    expect(markdown).toContain("pure");
    expect(markdown).toContain("Atomic Operation Composition");
    expect(markdown).toContain("records.delete"); // mentions disabled tools
  });
});
