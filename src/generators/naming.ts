import type { OperationDescriptor } from "../manifest/types.js";

export function toCliCommandName(operationId: string): string {
  return operationId
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toMcpToolName(operationId: string): string {
  return operationId
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Build deterministic, collision-free names for generated surfaces.
 *
 * Normalising different operation IDs can produce the same identifier (for
 * example `billing.charge`, `billing/charge`, and `billing:charge` all become
 * `billing-charge`). The first operation keeps the base name and subsequent
 * collisions receive a stable numeric suffix. Reserved names (such as the CLI's
 * `info`/`list`/`invoke` commands) are skipped in the same way.
 */
export function buildUniqueNames(
  operations: OperationDescriptor[],
  normalize: (operationId: string) => string,
  reserved: string[] = [],
  separator = "-",
): Map<string, string> {
  const used = new Set(reserved);
  const names = new Map<string, string>();

  for (const op of operations) {
    const base = normalize(op.id) || "operation";
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}${separator}${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    names.set(op.id, candidate);
  }

  return names;
}

export function buildCliCommandNames(
  operations: OperationDescriptor[],
): Map<string, string> {
  return buildUniqueNames(
    operations,
    toCliCommandName,
    ["info", "list", "invoke", "help"],
    "-",
  );
}

export function buildMcpToolNames(
  operations: OperationDescriptor[],
): Map<string, string> {
  return buildUniqueNames(operations, toMcpToolName, [], "_");
}
