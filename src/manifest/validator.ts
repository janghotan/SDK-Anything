import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { CapabilityManifest, ManifestValidationResult } from "./types.js";

let ajvInstance: any = null;
let validateFn: any = null;

function resolveSchemaPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, "../../schema/capability-manifest.schema.json"),
    path.resolve(currentDir, "../../../schema/capability-manifest.schema.json"),
    path.resolve(process.cwd(), "schema/capability-manifest.schema.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Capability manifest schema not found. Searched candidates: ${candidates.join(", ")}`,
  );
}

function getValidator() {
  if (!validateFn) {
    const AjvClass = (Ajv2020 as any).default ?? Ajv2020;
    ajvInstance = new AjvClass({ allErrors: true, strict: false });
    const addFormatsFn = (addFormats as any).default ?? addFormats;
    addFormatsFn(ajvInstance);

    const schemaPath = resolveSchemaPath();
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    validateFn = ajvInstance.compile(schema);
  }
  return validateFn;
}

export function validateManifest(
  manifest: CapabilityManifest,
): ManifestValidationResult {
  const errors: string[] = [];

  // 1. JSON Schema validation
  const validator = getValidator();
  const valid = validator(manifest);

  if (!valid && validator.errors) {
    for (const err of validator.errors) {
      errors.push(`${err.instancePath || "root"}: ${err.message}`);
    }
  }

  // 2. Semantic validation
  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest must be an object"] };
  }

  if (manifest.schemaVersion !== "sdk-anything/manifest/v1") {
    errors.push(
      `Unsupported schema version '${manifest.schemaVersion}'. Supported version is 'sdk-anything/manifest/v1'. Please regenerate with SDK-Anything v${manifest.generatorVersion || "0.1.0"} or run migration.`,
    );
  }

  // Operation IDs uniqueness
  const seenIds = new Set<string>();
  if (Array.isArray(manifest.operations)) {
    for (const op of manifest.operations) {
      if (seenIds.has(op.id)) {
        errors.push(`Duplicate operation ID: '${op.id}'`);
      }
      seenIds.add(op.id);

      // Effect policy enforcement:
      // Writes, destructive operations, and unknown effects must be disabled by default
      if (
        (op.effect === "write" ||
          op.effect === "destructive" ||
          op.effect === "unknown") &&
        op.enabledByDefault === true
      ) {
        // Only permissible if explicitly approved via overrides provenance
        const hasExplicitOverride =
          op.provenance?.overridesApplied?.includes("enabledByDefault");
        if (!hasExplicitOverride) {
          errors.push(
            `Operation '${op.id}' has effect '${op.effect}' but enabledByDefault is true without explicit override approval`,
          );
        }
      }

      // Check invocation descriptor
      if (op.invoke.kind === "top-level-function" && !op.invoke.functionName) {
        errors.push(
          `Operation '${op.id}': kind 'top-level-function' requires functionName`,
        );
      }
      if (
        op.invoke.kind === "instance-method" &&
        (!op.invoke.receiver || !op.invoke.method)
      ) {
        errors.push(
          `Operation '${op.id}': kind 'instance-method' requires receiver and method`,
        );
      }
    }
  }

  // Check client credentials
  if (manifest.client?.options) {
    for (const [key, opt] of Object.entries(manifest.client.options)) {
      if (opt.type === "secret") {
        if (!opt.source || !opt.source.startsWith("env:")) {
          errors.push(
            `Client secret option '${key}' must specify source as an environment reference (e.g. env:VARIABLE_NAME), got: '${opt.source}'`,
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
