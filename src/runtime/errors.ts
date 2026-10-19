import type { NormalizedError, NormalizedErrorCode } from "./types.js";

export function redactSecrets(
  text: string,
  knownSecrets: string[] = [],
): string {
  let result = text;

  // Redact explicit secret strings
  for (const secret of knownSecrets) {
    if (secret && secret.length >= 4) {
      result = result.split(secret).join("[REDACTED]");
    }
  }

  // Redact common auth token formats (Bearer ..., token ...)
  result = result.replace(
    /bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    "Bearer [REDACTED]",
  );
  result = result.replace(
    /(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[A-Za-z0-9._~+/-]{8,}['"]?/gi,
    "$1=[REDACTED]",
  );

  // Redact URL embedded credentials (https://user:pass@host)
  result = result.replace(
    /:\/\/[^:\s]+:[^@\s]+@/g,
    "://[REDACTED]:[REDACTED]@",
  );

  // Redact URL query parameter tokens (?token=..., &key=..., etc.)
  result = result.replace(
    /([?&](?:api[_-]?key|token|secret|password|access_token)=)[^&\s]+/gi,
    "$1[REDACTED]",
  );

  return result;
}

export function normalizeError(
  err: unknown,
  knownSecrets: string[] = [],
): NormalizedError {
  if (!err) {
    return {
      code: "RUNTIME_ERROR",
      message: "Unknown runtime error occurred",
    };
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const message = redactSecrets(rawMessage, knownSecrets);

  let code: NormalizedErrorCode = "RUNTIME_ERROR";

  if (
    /policy denied|permission denied|disabled by default|unauthorized effect/i.test(
      message,
    )
  ) {
    code = "POLICY_DENIED";
  } else if (
    /unauthorized|authentication required|invalid token|api key|401|forbidden|403|\bauth\b/i.test(
      message,
    )
  ) {
    code = "AUTH_REQUIRED";
  } else if (/not found|404/i.test(message)) {
    code = "NOT_FOUND";
  } else if (/rate limit|too many requests|429/i.test(message)) {
    code = "RATE_LIMITED";
  } else if (/timed? out|timeout/i.test(message)) {
    code = "TIMEOUT";
  } else if (
    /invalid input|validation failed|missing required property|schema validation/i.test(
      message,
    )
  ) {
    code = "INVALID_INPUT";
  } else if (
    /sdk error|network error|econnrefused|fetch failed/i.test(message)
  ) {
    code = "SDK_ERROR";
  }

  return {
    code,
    message,
    suggestedAction: getSuggestedAction(code),
  };
}

function getSuggestedAction(code: NormalizedErrorCode): string | undefined {
  switch (code) {
    case "AUTH_REQUIRED":
      return "Verify required environment variables or credentials are set in the environment";
    case "POLICY_DENIED":
      return "Operation effect is restricted by default. Enable the effect class in invocation options or manifest overrides";
    case "INVALID_INPUT":
      return "Check the input payload against the operation input schema";
    case "TIMEOUT":
      return "Increase timeoutMs in invocation options";
    default:
      return undefined;
  }
}
