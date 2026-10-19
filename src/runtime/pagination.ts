import type { PaginationDescriptor } from "../manifest/types.js";

export interface BoundedResult {
  data: any;
  truncated: boolean;
}

export function boundResult(
  data: any,
  paginationDesc?: PaginationDescriptor,
  contextCaps?: { maxItems?: number; maxBytes?: number },
): BoundedResult {
  if (data === null || data === undefined) {
    return { data, truncated: false };
  }

  const maxItems = contextCaps?.maxItems ?? paginationDesc?.maxItems ?? 100;
  const maxBytes = contextCaps?.maxBytes ?? paginationDesc?.maxBytes ?? 1048576; // 1MB default

  let truncated = false;
  let result = data;

  // 1. Bound array items
  if (Array.isArray(data)) {
    if (data.length > maxItems) {
      result = data.slice(0, maxItems);
      truncated = true;
    }
  } else if (typeof data === "object") {
    const itemsField = paginationDesc?.responseItemsField ?? "items";
    if (Array.isArray(data[itemsField])) {
      const items = data[itemsField];
      if (items.length > maxItems) {
        result = {
          ...data,
          [itemsField]: items.slice(0, maxItems),
        };
        truncated = true;
      }
    }
  }

  // 2. Check byte size
  try {
    const jsonStr = JSON.stringify(result);
    if (Buffer.byteLength(jsonStr, "utf8") > maxBytes) {
      truncated = true;
      // If it's an object with items, progressively slice items down to fit within maxBytes
      const itemsField = paginationDesc?.responseItemsField ?? "items";
      if (typeof result === "object" && Array.isArray(result[itemsField])) {
        let items = result[itemsField];
        while (
          items.length > 0 &&
          Buffer.byteLength(
            JSON.stringify({ ...result, [itemsField]: items }),
            "utf8",
          ) > maxBytes
        ) {
          items = items.slice(0, Math.floor(items.length / 2));
        }
        result = {
          ...result,
          [itemsField]: items,
        };
      }
    }
  } catch {
    // Non-serializable objects pass through
  }

  return {
    data: result,
    truncated,
  };
}

export function validatePaginationCursor(
  cursor: string | undefined,
  seenCursors: Set<string>,
): void {
  if (!cursor) return;
  if (seenCursors.has(cursor)) {
    throw new Error(
      `Infinite pagination loop detected: cursor '${cursor}' was already seen`,
    );
  }
  seenCursors.add(cursor);
}
