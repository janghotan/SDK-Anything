import { Command } from "commander";
import type { CapabilityManifest } from "../../manifest/types.js";
import { serializeCanonicalManifest } from "../../manifest/serializer.js";
import { invokeOperation } from "../../runtime/invoker.js";
import type { InvocationContext } from "../../runtime/types.js";
import { getStandaloneRuntimeSource } from "../runtime-template.js";
import type { OperationEffect } from "../../manifest/types.js";
import { buildCliCommandNames } from "../naming.js";

export { toCliCommandName } from "../naming.js";

function parseEffectList(raw?: string): OperationEffect[] | undefined {
  if (!raw) return undefined;
  const valid: OperationEffect[] = [
    "pure",
    "read",
    "write",
    "destructive",
    "unknown",
  ];
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const value of parsed) {
    if (!valid.includes(value as OperationEffect)) {
      throw new Error(
        `INVALID_INPUT: Unknown effect '${value}'. Valid effects: ${valid.join(", ")}`,
      );
    }
  }
  return parsed as OperationEffect[];
}

function buildPolicyContext<T extends GeneratedCliContext>(
  cmdOptions: {
    allowDestructive?: boolean;
    allowEffects?: string;
    allowOperations?: string;
  },
  base: T,
): T {
  const next: T = { ...base };
  const allowedEffects = parseEffectList(cmdOptions.allowEffects);
  if (allowedEffects) {
    next.allowedEffects = allowedEffects;
  }
  if (cmdOptions.allowOperations) {
    next.allowedOperationIds = cmdOptions.allowOperations
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (cmdOptions.allowDestructive) {
    next.allowDestructive = true;
  }
  return next;
}

export interface GeneratedCliContext extends InvocationContext {
  writeOut?: (str: string) => void;
  writeErr?: (str: string) => void;
  exitOverride?: boolean;
}

export function createGeneratedCli(
  manifest: CapabilityManifest,
  context: GeneratedCliContext = {},
): Command {
  const program = new Command();
  const safeName = manifest.source.package.replace(/[^a-zA-Z0-9_-]/g, "-");

  program
    .name(`sdk-cli-${safeName}`)
    .description(
      `Generated CLI for ${manifest.source.package} v${manifest.source.version}`,
    )
    .version(manifest.source.version);

  if (context.writeOut || context.writeErr) {
    program.configureOutput({
      writeOut: context.writeOut ?? ((str) => process.stdout.write(str)),
      writeErr: context.writeErr ?? ((str) => process.stderr.write(str)),
    });
  }

  if (context.exitOverride) {
    program.exitOverride();
  }

  // 1. Introspection command: info
  program
    .command("info")
    .description(
      "Inspect target SDK metadata, client requirements, and available operations",
    )
    .option("--json", "Output result in machine-readable JSON format")
    .action((cmdOpts: { json?: boolean }) => {
      const infoObj = {
        package: manifest.source.package,
        version: manifest.source.version,
        digest: manifest.source.digest,
        client: manifest.client ?? null,
        operationsCount: manifest.operations.length,
        enabledOperationsCount: manifest.operations.filter(
          (o) => o.enabledByDefault,
        ).length,
      };

      const out = cmdOpts.json
        ? JSON.stringify(infoObj, null, 2)
        : `SDK Package: ${manifest.source.package} v${manifest.source.version}\nDigest: ${manifest.source.digest}\nOperations: ${manifest.operations.length} (${manifest.operations.filter((o) => o.enabledByDefault).length} enabled)`;

      if (context.writeOut) context.writeOut(out + "\n");
      else console.log(out);
    });

  // 2. Introspection command: list
  program
    .command("list")
    .description("List all available operations and their effect tiers")
    .option("--json", "Output result in machine-readable JSON format")
    .action((cmdOpts: { json?: boolean }) => {
      const ops = manifest.operations.map((o) => ({
        id: o.id,
        name: o.name,
        effect: o.effect,
        enabled: o.enabledByDefault,
        summary: o.summary,
      }));

      const out = cmdOpts.json
        ? JSON.stringify(ops, null, 2)
        : ops
            .map(
              (o) =>
                `[${o.enabled ? "ENABLED" : "DISABLED"}] ${o.id} (${o.effect}) - ${o.summary}`,
            )
            .join("\n");

      if (context.writeOut) context.writeOut(out + "\n");
      else console.log(out);
    });

  // Register commands for every discovered operation. Disabled operations are
  // still discoverable but fail closed unless the caller explicitly opts in
  // with --allow-effects / --allow-operations / --allow-destructive.
  const commandOps = manifest.operations;
  const commandNames = buildCliCommandNames(commandOps);

  // Helper for stdin reading
  async function readStdin(): Promise<string> {
    if (
      typeof process === "undefined" ||
      !process.stdin ||
      process.stdin.isTTY
    ) {
      return "";
    }
    return new Promise((resolve) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => {
        resolve(data.trim());
      });
      process.stdin.on("error", () => {
        resolve("");
      });
    });
  }

  for (const op of commandOps) {
    const cmdName = commandNames.get(op.id)!;

    program
      .command(cmdName)
      .description(
        `${op.summary} [Effect: ${op.effect}${op.enabledByDefault ? "" : "; disabled by default"}]`,
      )
      .option(
        "--input <json>",
        "JSON string payload representing input arguments",
      )
      .option(
        "--allow-effects <effects>",
        "Comma-separated effect tiers to authorize (pure,read,write,destructive,unknown)",
      )
      .option(
        "--allow-operations <ids>",
        "Comma-separated operation IDs to authorize explicitly",
      )
      .option(
        "--allow-destructive",
        "Explicitly authorize execution of destructive operations in non-interactive environments",
      )
      .option("--json", "Output result in machine-readable JSON format")
      .action(
        async (cmdOpts: {
          input?: string;
          json?: boolean;
          allowDestructive?: boolean;
          allowEffects?: string;
          allowOperations?: string;
        }) => {
          try {
            let rawInput = cmdOpts.input;
            if (!rawInput) {
              rawInput = await readStdin();
            }
            let inputData: any = {};
            if (rawInput) {
              try {
                inputData = JSON.parse(rawInput);
              } catch (err: any) {
                throw new Error(
                  `INVALID_INPUT: Failed to parse input JSON: ${err.message}`,
                );
              }
            }

            const result = await invokeOperation(
              manifest,
              op.id,
              inputData,
              buildPolicyContext(cmdOpts, context),
            );

            if (result.success) {
              const outText = cmdOpts.json
                ? JSON.stringify(result.data, null, 2)
                : typeof result.data === "string"
                  ? result.data
                  : JSON.stringify(result.data, null, 2);

              if (context.writeOut) context.writeOut(outText + "\n");
              else console.log(outText);
            } else {
              const errEnvelope = {
                error: {
                  code: result.error?.code ?? "RUNTIME_ERROR",
                  message: result.error?.message ?? "Operation failed",
                  suggestedAction: result.error?.suggestedAction,
                },
              };
              const errText = cmdOpts.json
                ? JSON.stringify(errEnvelope, null, 2)
                : `Error [${errEnvelope.error.code}]: ${errEnvelope.error.message}`;

              if (context.writeErr) context.writeErr(errText + "\n");
              else console.error(errText);

              if (context.exitOverride) {
                throw new Error(errText);
              } else {
                process.exit(1);
              }
            }
          } catch (err: unknown) {
            const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
            if (context.writeErr) context.writeErr(errMsg + "\n");
            else console.error(errMsg);

            if (context.exitOverride) {
              throw err;
            } else {
              process.exit(1);
            }
          }
        },
      );
  }

  // Canonical escape hatch command: invoke <operationId>
  program
    .command("invoke <operationId>")
    .description("Invoke any operation by its unique canonical ID")
    .option(
      "--input <json>",
      "JSON string payload representing input arguments",
    )
    .option(
      "--allow-effects <effects>",
      "Comma-separated effect tiers to authorize (pure,read,write,destructive,unknown)",
    )
    .option(
      "--allow-operations <ids>",
      "Comma-separated operation IDs to authorize explicitly",
    )
    .option(
      "--allow-destructive",
      "Explicitly authorize execution of destructive operations in non-interactive environments",
    )
    .option("--json", "Output result in machine-readable JSON format")
    .action(
      async (
        operationId: string,
        cmdOpts: {
          input?: string;
          json?: boolean;
          allowDestructive?: boolean;
          allowEffects?: string;
          allowOperations?: string;
        },
      ) => {
        try {
          let rawInput = cmdOpts.input;
          if (!rawInput) {
            rawInput = await readStdin();
          }
          let inputData: any = {};
          if (rawInput) {
            try {
              inputData = JSON.parse(rawInput);
            } catch (err: any) {
              throw new Error(
                `INVALID_INPUT: Failed to parse input JSON: ${err.message}`,
              );
            }
          }

          const result = await invokeOperation(
            manifest,
            operationId,
            inputData,
            buildPolicyContext(cmdOpts, context),
          );

          if (result.success) {
            const outText = cmdOpts.json
              ? JSON.stringify(result.data, null, 2)
              : typeof result.data === "string"
                ? result.data
                : JSON.stringify(result.data, null, 2);

            if (context.writeOut) context.writeOut(outText + "\n");
            else console.log(outText);
          } else {
            const errEnvelope = {
              error: {
                code: result.error?.code ?? "RUNTIME_ERROR",
                message: result.error?.message ?? "Operation failed",
                suggestedAction: result.error?.suggestedAction,
              },
            };
            const errText = cmdOpts.json
              ? JSON.stringify(errEnvelope, null, 2)
              : `Error [${errEnvelope.error.code}]: ${errEnvelope.error.message}`;

            if (context.writeErr) context.writeErr(errText + "\n");
            else console.error(errText);

            if (context.exitOverride) {
              throw new Error(errText);
            } else {
              process.exit(1);
            }
          }
        } catch (err: unknown) {
          const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
          if (context.writeErr) context.writeErr(errMsg + "\n");
          else console.error(errMsg);

          if (context.exitOverride) {
            throw err;
          } else {
            process.exit(1);
          }
        }
      },
    );

  return program;
}

export interface GenerateCliOptions {
  sdkDependencyVersion?: string;
  sdkDependencySpec?: string;
}

export function generateCliProject(
  manifest: CapabilityManifest,
  options: GenerateCliOptions = {},
): Record<string, string> {
  const canonicalManifestJson = serializeCanonicalManifest(manifest);
  const commandOps = manifest.operations;
  const commandNames = buildCliCommandNames(commandOps);

  const sdkPkgName = manifest.source.package;
  const sdkPkgVersion =
    options.sdkDependencySpec ??
    options.sdkDependencyVersion ??
    manifest.source.version;
  const safePkgName = manifest.source.package
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();

  const mappedTemplateOps = commandOps.map((op) => ({
    id: op.id,
    cmdName: commandNames.get(op.id)!,
    name: op.name,
    summary: op.summary,
    description: op.description,
    effect: op.effect,
    enabledByDefault: op.enabledByDefault,
    inputSchema: op.inputSchema,
  }));

  const cliTs = `// Generated by SDK-Anything v${manifest.generatorVersion}
// Manifest schema: ${manifest.schemaVersion}
// Target: ${manifest.source.package}@${manifest.source.version}
// Digest: ${manifest.source.digest}

import { Command } from 'commander';
import * as targetSdk from '${sdkPkgName}';
import { invokeOperation, loadManifest } from './runtime.js';

const manifest = loadManifest();

async function readStdin(): Promise<string> {
  if (typeof process === 'undefined' || !process.stdin || process.stdin.isTTY) {
    return '';
  }
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    process.stdin.on('error', () => {
      resolve('');
    });
  });
}

const commandOperations = ${JSON.stringify(mappedTemplateOps, null, 2)};

const EFFECT_NAMES = ['pure', 'read', 'write', 'destructive', 'unknown'];

function buildInvocationOptions(cmdOpts: {
  allowDestructive?: boolean;
  allowEffects?: string;
  allowOperations?: string;
}) {
  const opts: any = {
    sdkModule: targetSdk,
    env: process.env,
    interactive: process.stdout.isTTY,
  };
  if (cmdOpts.allowEffects) {
    const effects = cmdOpts.allowEffects.split(',').map((value: string) => value.trim()).filter(Boolean);
    for (const effect of effects) {
      if (!EFFECT_NAMES.includes(effect)) {
        console.error(\`INVALID_INPUT: Unknown effect '\${effect}'. Valid effects: \${EFFECT_NAMES.join(', ')}\`);
        process.exit(2);
      }
    }
    opts.allowedEffects = effects;
  }
  if (cmdOpts.allowOperations) {
    opts.allowedOperationIds = cmdOpts.allowOperations.split(',').map((value: string) => value.trim()).filter(Boolean);
  }
  if (cmdOpts.allowDestructive) {
    opts.allowDestructive = true;
  }
  return opts;
}

const program = new Command();
program
  .name('sdk-cli-${safePkgName}')
  .description('CLI for ${manifest.source.package} v${manifest.source.version}')
  .version('${manifest.source.version}');

// Introspection: info
program
  .command('info')
  .description('Inspect target SDK metadata, client requirements, and available operations')
  .option('--json', 'Output result in machine-readable JSON format')
  .action((cmdOpts: { json?: boolean }) => {
    const infoObj = {
      package: manifest.source.package,
      version: manifest.source.version,
      digest: manifest.source.digest,
      client: manifest.client ?? null,
      operationsCount: manifest.operations.length,
      enabledOperationsCount: manifest.operations.filter((o: any) => o.enabledByDefault).length,
    };
    if (cmdOpts.json) {
      console.log(JSON.stringify(infoObj, null, 2));
    } else {
      console.log(\`SDK Package: \${manifest.source.package} v\${manifest.source.version}\\nDigest: \${manifest.source.digest}\\nOperations: \${manifest.operations.length}\`);
    }
  });

// Introspection: list
program
  .command('list')
  .description('List all available operations and their effect tiers')
  .option('--json', 'Output result in machine-readable JSON format')
  .action((cmdOpts: { json?: boolean }) => {
    const ops = manifest.operations.map((o: any) => ({
      id: o.id,
      name: o.name,
      effect: o.effect,
      enabled: o.enabledByDefault,
      summary: o.summary,
    }));
    if (cmdOpts.json) {
      console.log(JSON.stringify(ops, null, 2));
    } else {
      console.log(ops.map((o: any) => \`[\${o.enabled ? 'ENABLED' : 'DISABLED'}] \${o.id} (\${o.effect}) - \${o.summary}\`).join('\\n'));
    }
  });

for (const op of commandOperations) {
  program
    .command(op.cmdName)
    .description(\`\${op.summary} [Effect: \${op.effect}\${op.enabledByDefault ? '' : '; disabled by default'}]\`)
    .option('--input <json>', 'JSON string payload representing input arguments')
    .option('--allow-effects <effects>', 'Comma-separated effect tiers to authorize (pure,read,write,destructive,unknown)')
    .option('--allow-operations <ids>', 'Comma-separated operation IDs to authorize explicitly')
    .option('--allow-destructive', 'Explicitly authorize execution of destructive operations in non-interactive environments')
    .option('--json', 'Output result in JSON format')
    .action(async (cmdOpts: { input?: string; json?: boolean; allowDestructive?: boolean; allowEffects?: string; allowOperations?: string }) => {
      try {
        let rawInput = cmdOpts.input;
        if (!rawInput) {
          rawInput = await readStdin();
        }
        let input: any = {};
        if (rawInput) {
          try {
            input = JSON.parse(rawInput);
          } catch (err: any) {
            console.error(\`INVALID_INPUT: Failed to parse input JSON: \${err.message}\`);
            process.exit(1);
          }
        }

        const result = await invokeOperation(manifest, op.id, input, buildInvocationOptions(cmdOpts));

        if (result.success) {
          if (cmdOpts.json) {
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
          }
        } else {
          console.error(\`Error [\${result.error?.code}]: \${result.error?.message}\`);
          process.exit(1);
        }
      } catch (err: any) {
        console.error(\`Error: \${err?.message || String(err)}\`);
        process.exit(1);
      }
    });
}

// Canonical escape hatch command: invoke <operationId>
program
  .command('invoke <operationId>')
  .description('Direct invocation of any operation by its unique canonical ID')
  .option('--input <json>', 'JSON string payload representing input arguments')
  .option('--allow-effects <effects>', 'Comma-separated effect tiers to authorize (pure,read,write,destructive,unknown)')
  .option('--allow-operations <ids>', 'Comma-separated operation IDs to authorize explicitly')
  .option('--allow-destructive', 'Explicitly authorize execution of destructive operations in non-interactive environments')
  .option('--json', 'Output result in JSON format')
  .action(async (operationId: string, cmdOpts: { input?: string; json?: boolean; allowDestructive?: boolean; allowEffects?: string; allowOperations?: string }) => {
    try {
      let rawInput = cmdOpts.input;
      if (!rawInput) {
        rawInput = await readStdin();
      }
      let input: any = {};
      if (rawInput) {
        try {
          input = JSON.parse(rawInput);
        } catch (err: any) {
          console.error(\`INVALID_INPUT: Failed to parse input JSON: \${err.message}\`);
          process.exit(1);
        }
      }

      const result = await invokeOperation(manifest, operationId, input, buildInvocationOptions(cmdOpts));

      if (result.success) {
        if (cmdOpts.json) {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
        }
      } else {
        console.error(\`Error [\${result.error?.code}]: \${result.error?.message}\`);
        process.exit(1);
      }
    } catch (err: any) {
      console.error(\`Error: \${err?.message || String(err)}\`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
`;

  const packageJson = JSON.stringify(
    {
      name: `cli-${safePkgName}`,
      version: "0.1.0",
      type: "module",
      private: true,
      bin: {
        [`sdk-cli-${safePkgName}`]: "./dist/cli.js",
      },
      scripts: {
        build:
          "tsc && node -e \"require('node:fs').copyFileSync('capability-manifest.json','dist/capability-manifest.json')\"",
        start: "node dist/cli.js",
        test: "tsc --noEmit",
      },
      dependencies: {
        commander: "^15.0.0",
        ajv: "^8.20.0",
        "ajv-formats": "^3.0.1",
        [sdkPkgName]: sdkPkgVersion,
      },
      devDependencies: {
        "@types/node": "^24.0.0",
        typescript: "^5.7.3",
      },
    },
    null,
    2,
  );

  const tsconfigJson = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        lib: ["ES2022"],
        types: ["node"],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: "./dist",
        rootDir: "./",
        resolveJsonModule: true,
      },
      include: ["cli.ts", "runtime.ts"],
    },
    null,
    2,
  );

  return {
    "cli.ts": cliTs,
    "runtime.ts": getStandaloneRuntimeSource(),
    "package.json": packageJson,
    "tsconfig.json": tsconfigJson,
    "capability-manifest.json": canonicalManifestJson,
  };
}
