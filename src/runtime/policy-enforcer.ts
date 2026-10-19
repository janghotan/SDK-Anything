import type {
  OperationDescriptor,
  OperationEffect,
} from "../manifest/types.js";
import type { InvocationContext } from "./types.js";

export async function enforceOperationPolicy(
  op: OperationDescriptor,
  context: InvocationContext,
): Promise<void> {
  const allowedEffects: OperationEffect[] = [
    ...(context.allowedEffects ?? ["pure", "read"]),
  ];

  if (
    context.allowDestructive ||
    context.allowedOperationIds?.includes(op.id)
  ) {
    if (!allowedEffects.includes("destructive")) {
      allowedEffects.push("destructive");
    }
  }

  // Check allowlist if provided
  if (
    context.allowedOperationIds &&
    !context.allowedOperationIds.includes(op.id)
  ) {
    throw new Error(
      `Policy denied: operation '${op.id}' is not in the explicit allowedOperationIds list`,
    );
  }

  // Check effect permissions
  if (!allowedEffects.includes(op.effect)) {
    throw new Error(
      `Policy denied: operation '${op.id}' has effect '${op.effect}', which is disabled by default. Permitted effects: [${allowedEffects.join(", ")}]`,
    );
  }

  // If operation is marked disabled in manifest and no explicit override in allowedEffects/authorization
  const isExplicitlyAuthorized =
    (context.allowedEffects && context.allowedEffects.includes(op.effect)) ||
    (op.effect === "destructive" && context.allowDestructive) ||
    context.allowedOperationIds?.includes(op.id);

  if (!op.enabledByDefault && !isExplicitlyAuthorized) {
    throw new Error(
      `Policy denied: operation '${op.id}' is disabled by default in manifest. Must be enabled via policy configuration or overrides.`,
    );
  }

  // Destructive operations safety check
  if (op.effect === "destructive") {
    if (context.interactive) {
      if (context.confirmDestructive) {
        const confirmed = await context.confirmDestructive(op.id);
        if (!confirmed) {
          throw new Error(
            `Policy denied: destructive operation '${op.id}' was rejected by user confirmation`,
          );
        }
      } else {
        throw new Error(
          `Policy denied: destructive operation '${op.id}' requires interactive confirmation, but no confirmation handler is available`,
        );
      }
    } else if (context.interactive === false) {
      // Non-interactive / non-TTY environment must fail closed without explicit authorization
      if (
        !context.allowDestructive &&
        !context.allowedOperationIds?.includes(op.id)
      ) {
        throw new Error(
          `Policy denied: destructive operation '${op.id}' cannot be executed in non-interactive environment without explicit authorization (allowDestructive: true or allowedOperationIds)`,
        );
      }
    }
  }
}
