import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { analyzeSourceSnapshot } from "../../src/analyzer/index.js";

describe("TypeScript Analyzer and Evidence Inventory", () => {
  const fixturePath = path.resolve("tests/fixtures/analyzer-types");

  it("extracts top-level pure functions and type schemas deterministically", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);

    expect(evidence.functions.length).toBeGreaterThan(0);
    const distFn = evidence.functions.find(
      (f) => f.name === "calculateDistance",
    );
    expect(distFn).toBeDefined();
    expect(distFn?.description).toContain(
      "Calculate distance between two points.",
    );
    expect(distFn?.parameters.length).toBe(3);

    // Verify inputSchema generated
    expect(distFn?.inputSchema.type).toBe("object");
    expect(distFn?.inputSchema.properties).toHaveProperty("from");
    expect(distFn?.inputSchema.properties).toHaveProperty("to");
    expect(distFn?.inputSchema.properties).toHaveProperty("units");
    expect(distFn?.inputSchema.required).toEqual(["from", "to"]);

    // Check nested enum schema for units
    const unitsSchema = (distFn?.inputSchema.properties as any).units;
    expect(unitsSchema.enum).toEqual(["kilometers", "miles", "degrees"]);
  });

  it("extracts class constructors and instance methods", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);

    expect(evidence.classes.length).toBeGreaterThan(0);
    const client = evidence.classes.find((c) => c.name === "RestClient");
    expect(client).toBeDefined();
    expect(client?.constructorParameters.length).toBe(1);
    expect(client?.constructorParameters[0].name).toBe("config");

    // Methods
    expect(client?.methods.some((m) => m.name === "listItems")).toBe(true);
    expect(client?.methods.some((m) => m.name === "deleteItem")).toBe(true);

    const listMethod = client?.methods.find((m) => m.name === "listItems");
    expect(listMethod).toBeDefined();
    expect(listMethod?.isAsync).toBe(true);
    expect(listMethod?.inputSchema.properties).toHaveProperty("query");
    expect(listMethod?.inputSchema.properties).toHaveProperty("limit");
  });

  it("detects factory functions returning client instances", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);

    expect(evidence.factories.length).toBeGreaterThan(0);
    const factory = evidence.factories.find(
      (f) => f.name === "createRestClient",
    );
    expect(factory).toBeDefined();
    expect(factory?.returnsClient).toBe("RestClient");
  });

  it("records unresolved symbols for circular types and unsupported callback signatures with structured diagnostic codes", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);

    expect(evidence.unresolved.length).toBeGreaterThan(0);
    const circular = evidence.unresolved.find(
      (u) => u.symbolName === "processNode" || u.symbolName === "CircularNode",
    );
    expect(circular).toBeDefined();
    expect(circular?.reason).toMatch(/circular/i);
    expect(circular?.code).toBe("CIRCULAR_TYPE");

    const callbackOp = evidence.unresolved.find(
      (u) => u.symbolName === "listenEvents",
    );
    expect(callbackOp).toBeDefined();
    expect(callbackOp?.reason).toMatch(/callback|function/i);
    expect(callbackOp?.code).toBe("UNSUPPORTED_CALLBACK");

    const anyOp = evidence.unresolved.find(
      (u) => u.symbolName === "untypedHandler",
    );
    expect(anyOp).toBeDefined();
    expect(anyOp?.code).toBe("UNCONSTRAINED_ANY_OR_UNKNOWN");

    const genericOp = evidence.unresolved.find(
      (u) => u.symbolName === "unboundGeneric",
    );
    expect(genericOp).toBeDefined();
    expect(genericOp?.code).toBe("UNBOUND_GENERIC");
  });

  it("extracts enums, index signatures, and utility types into valid JSON schemas", async () => {
    const evidence = await analyzeSourceSnapshot(fixturePath);

    // String Enum
    const priorityFn = evidence.functions.find((f) => f.name === "setPriority");
    expect(priorityFn).toBeDefined();
    const priorityParam = priorityFn?.inputSchema.properties.priority as any;
    expect(priorityParam.enum).toEqual(["low", "medium", "high"]);

    // Numeric Enum
    const statusFn = evidence.functions.find((f) => f.name === "setStatus");
    expect(statusFn).toBeDefined();
    const statusParam = statusFn?.inputSchema.properties.status as any;
    expect(statusParam.enum).toEqual([0, 1, 2]);

    // Record / Index signature
    const lookupFn = evidence.functions.find(
      (f) => f.name === "lookupMetadata",
    );
    expect(lookupFn).toBeDefined();
    const mapParam = lookupFn?.inputSchema.properties.map as any;
    expect(mapParam.type).toBe("object");
    expect(mapParam.additionalProperties).toEqual({ type: "string" });

    // Partial utility type
    const updateFn = evidence.functions.find((f) => f.name === "updateConfig");
    expect(updateFn).toBeDefined();
    const patchParam = updateFn?.inputSchema.properties.patch as any;
    expect(patchParam.type).toBe("object");
    expect(patchParam.properties).toHaveProperty("apiKey");
    // Partial makes all properties optional
    expect(patchParam.required).toBeUndefined();

    // Overloads
    const formatFn = evidence.functions.find(
      (f) => f.name === "formatCoordinate",
    );
    expect(formatFn).toBeDefined();
    expect(formatFn?.overloadsCount).toBe(2);
  });

  it("produces byte-identical canonical evidence on repeated runs", async () => {
    const run1 = await analyzeSourceSnapshot(fixturePath);
    const run2 = await analyzeSourceSnapshot(fixturePath);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });
});
