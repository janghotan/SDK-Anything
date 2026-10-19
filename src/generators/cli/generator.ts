import { Command } from "commander";
import type { CapabilityManifest } from "../../manifest/types.js";
import { serializeCanonicalManifest } from "../../manifest/serializer.js";
import { invokeOperation } from "../../runtime/invoker.js";
import type { InvocationContext } from "../../runtime/types.js";
import { getStandaloneRuntimeSource } from "../runtime-template.js";

export function toCliCommandName(operationId: string): string {
  return operationId
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  // Register commands for enabled operations
  const enabledOps = manifest.operations.filter((op) => op.enabledByDefault);

  for (const op of enabledOps) {
    const cmdName = toCliCommandName(op.id);
    program
      .command(cmdName)
      .description(`${op.summary} [Effect: ${op.effect}]`)
      .option(
        "--input <json>",
        "JSON string payload representing input arguments",
      )
      .option("--json", "Output result in machine-readable JSON format")
      .action(async (cmdOpts: { input?: string; json?: boolean }) => {
        try {
          let inputData: any = {};
          if (cmdOpts.input) {
            try {
              inputData = JSON.parse(cmdOpts.input);
            } catch (err: any) {
              throw new Error(
                `INVALID_INPUT: Failed to parse --input JSON: ${err.message}`,
              );
            }
          }

          const result = await invokeOperation(
            manifest,
            op.id,
            inputData,
            context,
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
      });
  }

  return program;
}

export interface GenerateCliOptions {
  sdkDependencyVersion?: string;
}

export function generateCliProject(
  manifest: CapabilityManifest,
  options: GenerateCliOptions = {},
): Record<string, string> {
  const canonicalManifestJson = serializeCanonicalManifest(manifest);
  const enabledOps = manifest.operations.filter((op) => op.enabledByDefault);

  const sdkPkgName = manifest.source.package;
  const sdkPkgVersion = options.sdkDependencyVersion ?? manifest.source.version;
  const safePkgName = manifest.source.package
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();

  const cliTs = `// Generated by SDK-Anything v${manifest.generatorVersion}
// Manifest schema: ${manifest.schemaVersion}
// Target: ${manifest.source.package}@${manifest.source.version}
// Digest: ${manifest.source.digest}

import { Command } from 'commander';
import * as targetSdk from '${sdkPkgName}';
import manifestData from './capability-manifest.json' with { type: 'json' };
import { invokeOperation } from './runtime.js';

const manifest = manifestData as any;

function toCliCommandName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

const enabledOperations = ${JSON.stringify(
    enabledOps.map((op) => ({
      id: op.id,
      cmdName: toCliCommandName(op.id),
      name: op.name,
      summary: op.summary,
      description: op.description,
      effect: op.effect,
      inputSchema: op.inputSchema,
    })),
    null,
    2,
  )};

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

for (const op of enabledOperations) {
  program
    .command(op.cmdName)
    .description(\`\${op.summary} [Effect: \${op.effect}]\`)
    .option('--input <json>', 'JSON string payload representing input arguments')
    .option('--json', 'Output result in JSON format')
    .action(async (cmdOpts: { input?: string; json?: boolean }) => {
      try {
        let input: any = {};
        if (cmdOpts.input) {
          input = JSON.parse(cmdOpts.input);
        }

        const result = await invokeOperation(manifest, op.id, input, {
          sdkModule: targetSdk,
          env: process.env,
          interactive: process.stdout.isTTY,
        });

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

program.parseAsync(process.argv).catch(err => {
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
        build: "tsc",
        start: "node dist/cli.js",
      },
      dependencies: {
        commander: "^15.0.0",
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
