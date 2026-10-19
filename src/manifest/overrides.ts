import type {
  CapabilityManifest,
  SdkAnythingOverrides,
  OperationDescriptor,
} from "./types.js";

export function applyOverrides(
  manifest: CapabilityManifest,
  overrides: SdkAnythingOverrides,
): CapabilityManifest {
  if (overrides.schemaVersion !== "sdk-anything/overrides/v1") {
    throw new Error(
      `Unsupported overrides schemaVersion: ${overrides.schemaVersion}`,
    );
  }

  const updated: CapabilityManifest = JSON.parse(JSON.stringify(manifest));
  const knownOpIds = new Set(updated.operations.map((o) => o.id));

  // 1. Client overrides
  if (overrides.client && updated.client) {
    if (overrides.client.construction) {
      updated.client.construction = overrides.client.construction;
    }
    if (overrides.client.export) {
      updated.client.export = overrides.client.export;
    }
    if (overrides.client.options) {
      for (const [key, val] of Object.entries(overrides.client.options)) {
        if (!updated.client.options[key]) {
          updated.client.options[key] = {
            type: val.type ?? "string",
            required: val.required ?? true,
            source: val.source,
            description: val.description,
          };
        } else {
          Object.assign(updated.client.options[key], val);
        }
      }
    }
  }

  // 2. Operation overrides
  if (overrides.operations) {
    for (const [opId, opOverride] of Object.entries(overrides.operations)) {
      if (!knownOpIds.has(opId)) {
        // Check if it's in unresolved
        const unresolvedIndex = updated.unresolved.findIndex(
          (u) => u.id === opId,
        );
        if (unresolvedIndex !== -1 && opOverride.inputSchema) {
          // Promote from unresolved to an enabled operation
          const newOp: OperationDescriptor = {
            id: opId,
            name: opId.split(".").pop() ?? opId,
            summary: opOverride.summary ?? `Operation ${opId}`,
            description:
              opOverride.description ?? `Reviewed operation for ${opId}`,
            invoke: {
              kind: opId.includes(".")
                ? "instance-method"
                : "top-level-function",
              receiver: opId.includes(".") ? opId.split(".")[0] : undefined,
              method: opId.includes(".") ? opId.split(".")[1] : undefined,
              functionName: opId.includes(".") ? undefined : opId,
            },
            inputSchema: opOverride.inputSchema,
            effect: opOverride.effect ?? "read",
            enabledByDefault: opOverride.enabledByDefault ?? true,
            result: { mode: "direct", pagination: opOverride.pagination },
            provenance: {
              sourceFile: "overrides",
              confidence: "high",
              overridesApplied: ["inputSchema", "enabledByDefault", "effect"],
            },
          };
          updated.operations.push(newOp);
          updated.unresolved.splice(unresolvedIndex, 1);
          continue;
        }

        throw new Error(
          `Unknown operation ID in overrides: '${opId}' (at /operations/${opId}) does not match any discovered operation`,
        );
      }

      const op = updated.operations.find((o) => o.id === opId);
      if (op) {
        if (!op.provenance.overridesApplied) {
          op.provenance.overridesApplied = [];
        }

        if (opOverride.enabledByDefault !== undefined) {
          op.enabledByDefault = opOverride.enabledByDefault;
          op.provenance.overridesApplied.push("enabledByDefault");
        }
        if (opOverride.effect !== undefined) {
          op.effect = opOverride.effect;
          op.provenance.overridesApplied.push("effect");
        }
        if (opOverride.inputSchema !== undefined) {
          op.inputSchema = opOverride.inputSchema;
          op.provenance.overridesApplied.push("inputSchema");
        }
        if (opOverride.summary !== undefined) {
          op.summary = opOverride.summary;
          op.provenance.overridesApplied.push("summary");
        }
        if (opOverride.description !== undefined) {
          op.description = opOverride.description;
          op.provenance.overridesApplied.push("description");
        }
        if (opOverride.pagination !== undefined) {
          op.result.pagination = opOverride.pagination;
          op.result.mode = "paginated";
          op.provenance.overridesApplied.push("pagination");
        }
      }
    }
  }

  updated.overrides = overrides as any;
  return updated;
}

export function generateStarterOverrides(
  manifest: CapabilityManifest,
): SdkAnythingOverrides {
  const operations: Record<string, any> = {};

  // Include disabled operations so user can review and explicitly enable
  for (const op of manifest.operations) {
    if (!op.enabledByDefault) {
      operations[op.id] = {
        effect: op.effect,
        enabledByDefault: false, // User changes to true to enable
        summary: op.summary,
      };
    }
  }

  // Include unresolved symbols so user can supply schemas
  for (const u of manifest.unresolved) {
    operations[u.id] = {
      effect: "read",
      enabledByDefault: false,
      inputSchema: {
        type: "object",
        properties: {},
        description: `Provide input schema to resolve: ${u.reason}`,
      },
    };
  }

  return {
    schemaVersion: "sdk-anything/overrides/v1",
    client: manifest.client
      ? {
          construction: manifest.client.construction,
          export: manifest.client.export,
          options: manifest.client.options,
        }
      : undefined,
    operations,
  };
}
