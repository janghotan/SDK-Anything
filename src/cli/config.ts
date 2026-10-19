export interface SdkAnythingConfig {
  targets: string[];
  output: string;
  ai: boolean;
  sandbox: boolean;
  trustedLocal: boolean;
  writeOverrides?: boolean;
  json?: boolean;
  openAiBaseUrl?: string;
  openAiApiKey?: string;
  openAiModel?: string;
}

export interface CliOptionsInput {
  targets?: string | string[];
  output?: string;
  ai?: boolean;
  sandbox?: boolean;
  trustedLocal?: boolean;
  writeOverrides?: boolean;
  json?: boolean;
  openAiBaseUrl?: string;
  openAiApiKey?: string;
  openAiModel?: string;
}

export function resolveConfig(
  options: CliOptionsInput = {},
): SdkAnythingConfig {
  const envAi = process.env.SDK_ANYTHING_AI;
  const envAiBool = envAi
    ? envAi.toLowerCase() === "true" || envAi === "1"
    : false;

  let targets: string[] = ["mcp", "cli"];
  if (options.targets) {
    if (Array.isArray(options.targets)) {
      targets = options.targets;
    } else {
      targets = options.targets
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  return {
    targets,
    output: options.output ?? process.env.SDK_ANYTHING_OUTPUT ?? "./generated",
    ai: options.ai ?? envAiBool ?? false,
    sandbox: options.sandbox ?? process.env.SDK_ANYTHING_SANDBOX === "true",
    trustedLocal:
      options.trustedLocal ?? process.env.SDK_ANYTHING_TRUSTED_LOCAL === "true",
    writeOverrides: options.writeOverrides ?? false,
    json: options.json ?? false,
    openAiBaseUrl:
      options.openAiBaseUrl ??
      process.env.OPENAI_BASE_URL ??
      process.env.OPENAI_API_BASE,
    openAiApiKey: options.openAiApiKey ?? process.env.OPENAI_API_KEY,
    openAiModel:
      options.openAiModel ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}
