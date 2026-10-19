import type { OperationEffect } from "../manifest/types.js";

export type NormalizedErrorCode =
  | "INVALID_INPUT"
  | "POLICY_DENIED"
  | "AUTH_REQUIRED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "SDK_ERROR"
  | "UNSUPPORTED_OPERATION"
  | "RUNTIME_ERROR";

export interface NormalizedError {
  code: NormalizedErrorCode;
  message: string;
  details?: unknown;
  suggestedAction?: string;
}

export interface InvocationContext {
  env?: Record<string, string | undefined>;
  allowedEffects?: OperationEffect[];
  allowedOperationIds?: string[];
  timeoutMs?: number;
  maxItems?: number;
  maxBytes?: number;
  interactive?: boolean;
  allowDestructive?: boolean;
  confirmDestructive?: (opId: string) => Promise<boolean>;
  sdkInstance?: unknown;
  sdkModule?: any;
}

export interface InvocationResult {
  success: boolean;
  operationId: string;
  data?: unknown;
  error?: NormalizedError;
  truncated?: boolean;
  executionTimeMs: number;
}
