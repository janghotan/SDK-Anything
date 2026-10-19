import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";
import { resolveSource } from "../source/index.js";
import { analyzeSourceSnapshot } from "../analyzer/index.js";
import {
  buildManifest,
  validateManifest,
  generateStarterOverrides,
  applyOverrides,
} from "../manifest/index.js";
import { generateArtifacts } from "../generators/index.js";
import { runProjectTests } from "../sandbox/index.js";
import { checkAndRecordDisclosure, requestAiProposals } from "../ai/index.js";
import { runDoctorCheck } from "./doctor.js";

export interface CreateCliOptions {
  writeOut?: (str: string) => void;
  writeErr?: (str: string) => void;
  exitOverride?: boolean;
}

export function createCli(options: CreateCliOptions = {}): Command {
  const program = new Command();

  program
    .name("sdk-anything")
    .description(
      "Turn TypeScript/JavaScript SDKs into inspectable, testable, agent-friendly MCP tools and CLIs",
    )
    .version("0.1.0");

  if (options.writeOut || options.writeErr) {
    program.configureOutput({
      writeOut: options.writeOut ?? ((str) => process.stdout.write(str)),
      writeErr: options.writeErr ?? ((str) => process.stderr.write(str)),
    });
  }

  if (options.exitOverride) {
    program.exitOverride();
  }

  program
    .command("inspect <source>")
    .description(
      "Inspect an npm package, local directory, or public GitHub repo statically",
    )
    .option(
      "--write-overrides",
      "Emit starter sdk-anything.overrides.json for ambiguous types/lifecycle",
    )
    .option("--json", "Output results in JSON format")
    .action(
      async (
        source: string,
        cmdOptions: { writeOverrides?: boolean; json?: boolean },
      ) => {
        try {
          const snapshot = await resolveSource(source);
          const evidence = await analyzeSourceSnapshot(snapshot);

          if (cmdOptions.writeOverrides) {
            const manifest = buildManifest(evidence);
            const starterOverrides = generateStarterOverrides(manifest);
            const overridesPath = path.resolve("sdk-anything.overrides.json");
            fs.writeFileSync(
              overridesPath,
              JSON.stringify(starterOverrides, null, 2),
              "utf8",
            );
            const msg = `Wrote starter overrides to ${overridesPath}`;
            if (options.writeOut) options.writeOut(msg + "\n");
            else console.log(msg);
          }

          if (cmdOptions.json) {
            const out = JSON.stringify(evidence, null, 2);
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          } else {
            const manifest = buildManifest(evidence);
            const pureOps = manifest.operations.filter(
              (o) => o.effect === "pure",
            ).length;
            const readOps = manifest.operations.filter(
              (o) => o.effect === "read",
            ).length;
            const writeOps = manifest.operations.filter(
              (o) => o.effect === "write",
            ).length;
            const destructiveOps = manifest.operations.filter(
              (o) => o.effect === "destructive",
            ).length;
            const unknownOps = manifest.operations.filter(
              (o) => o.effect === "unknown",
            ).length;
            const enabledOps = manifest.operations.filter(
              (o) => o.enabledByDefault,
            ).length;

            const lines = [
              `Resolved source: ${snapshot.identifier}`,
              `Kind:            ${snapshot.kind}`,
              `Version:         ${snapshot.version}`,
              `Digest:          ${snapshot.digest}`,
              `Entry point:     ${evidence.entryPoint}`,
              `Functions:       ${evidence.functions.length} (${evidence.functions.map((f) => f.name).join(", ") || "none"})`,
              `Classes:         ${evidence.classes.length} (${evidence.classes.map((c) => c.name).join(", ") || "none"})`,
              `Factories:       ${evidence.factories.length} (${evidence.factories.map((f) => f.name).join(", ") || "none"})`,
              `Operations:      ${manifest.operations.length} (${enabledOps} enabled by default; pure: ${pureOps}, read: ${readOps}, write: ${writeOps}, destructive: ${destructiveOps}, unknown: ${unknownOps})`,
              `Unresolved:      ${evidence.unresolved.length}`,
            ];
            if (evidence.unresolved.length > 0) {
              lines.push(`Unresolved symbols:`);
              evidence.unresolved.forEach((u) =>
                lines.push(
                  `  - ${u.symbolName}: [${u.reason}] ${u.suggestedAction || ""}`,
                ),
              );
            }
            if (snapshot.warnings.length > 0) {
              lines.push(`Warnings:`);
              snapshot.warnings.forEach((w) => lines.push(`  - ${w}`));
            }
            const out = lines.join("\n");
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          }
        } catch (err: unknown) {
          const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
          if (options.writeErr) options.writeErr(errMsg + "\n");
          else console.error(errMsg);
          if (options.exitOverride) {
            throw err;
          } else {
            process.exit(1);
          }
        }
      },
    );

  program
    .command("generate <source>")
    .description(
      "Generate MCP server, CLI, and consumer SKILL.md from inspected SDK",
    )
    .option(
      "--targets <targets>",
      "Comma-separated generation targets (mcp,cli)",
      "mcp,cli",
    )
    .option(
      "--output <dir>",
      "Output directory for generated project",
      "./generated",
    )
    .option(
      "--ai",
      "Enable optional AI-assisted descriptions and operation selection",
    )
    .option("--check", "Check for drift without writing files to disk")
    .option(
      "--force",
      "Overwrite existing user-modified files without confirmation",
    )
    .option("--json", "Output results in JSON format")
    .action(
      async (
        source: string,
        cmdOptions: {
          targets?: string;
          output?: string;
          ai?: boolean;
          check?: boolean;
          force?: boolean;
          json?: boolean;
        },
      ) => {
        try {
          const snapshot = await resolveSource(source);
          const evidence = await analyzeSourceSnapshot(snapshot);
          let manifest = buildManifest(evidence);

          // Check for local overrides file in cwd
          const overridesPath = path.resolve("sdk-anything.overrides.json");
          if (fs.existsSync(overridesPath)) {
            const rawOverrides = JSON.parse(
              fs.readFileSync(overridesPath, "utf8"),
            );
            manifest = applyOverrides(manifest, rawOverrides);
          }

          // Optional AI-assisted enrichment
          if (cmdOptions.ai) {
            const disclosure = checkAndRecordDisclosure(evidence);
            if (!cmdOptions.json) {
              const discMsg = disclosure.notice;
              if (options.writeOut) options.writeOut(discMsg + "\n");
              else console.log(discMsg);
            }

            const aiResult = await requestAiProposals(evidence);
            if (aiResult.fallback) {
              const warnMsg = `AI Notice: Falling back to deterministic generation (${aiResult.warnings.join("; ")})`;
              if (options.writeErr) options.writeErr(warnMsg + "\n");
              else console.warn(warnMsg);
            } else {
              for (const proposal of aiResult.proposals) {
                const op = manifest.operations.find(
                  (o) => o.id === proposal.operationId,
                );
                if (op) {
                  if (proposal.summary) op.summary = proposal.summary;
                  if (proposal.description)
                    op.description = proposal.description;
                  if (!op.provenance.overridesApplied) {
                    op.provenance.overridesApplied = [];
                  }
                  op.provenance.overridesApplied.push("ai-summary");
                }
              }
              if (!cmdOptions.json) {
                const successMsg = `Applied AI-enhanced descriptions for ${aiResult.proposals.length} operations.`;
                if (options.writeOut) options.writeOut(successMsg + "\n");
                else console.log(successMsg);
              }
            }
          }

          const targets = (cmdOptions.targets ?? "mcp,cli")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          const outputDir = cmdOptions.output ?? "./generated";

          const generatedFiles = generateArtifacts(
            manifest,
            targets,
            outputDir,
            {
              check: !!cmdOptions.check,
              force: !!cmdOptions.force,
            },
          );

          if (cmdOptions.check) {
            const checkMsg =
              "No drift detected; generated project is up to date.";
            if (options.writeOut) options.writeOut(checkMsg + "\n");
            else console.log(checkMsg);
            return;
          }

          if (cmdOptions.json) {
            const out = JSON.stringify(
              {
                manifest: manifest.source,
                targets,
                outputDir: path.resolve(outputDir),
                files: generatedFiles.map((f) =>
                  path.relative(process.cwd(), f),
                ),
              },
              null,
              2,
            );
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          } else {
            const lines = [
              `Generated artifacts in: ${path.resolve(outputDir)}`,
              `Targets: ${targets.join(", ")}`,
              `Enabled operations: ${manifest.operations.filter((o) => o.enabledByDefault).length}`,
              `Files created:`,
              ...generatedFiles.map(
                (f) => `  - ${path.relative(process.cwd(), f)}`,
              ),
            ];
            const out = lines.join("\n");
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          }
        } catch (err: unknown) {
          const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
          if (options.writeErr) options.writeErr(errMsg + "\n");
          else console.error(errMsg);
          if (options.exitOverride) {
            throw err;
          } else {
            process.exit(1);
          }
        }
      },
    );

  program
    .command("validate <path>")
    .description(
      "Statically validate capability manifest and generated project",
    )
    .option("--json", "Output results in JSON format")
    .action(async (targetPath: string, cmdOptions: { json?: boolean }) => {
      try {
        let manifestFile = path.resolve(targetPath);
        if (
          fs.existsSync(manifestFile) &&
          fs.statSync(manifestFile).isDirectory()
        ) {
          const candidate = path.join(manifestFile, "capability-manifest.json");
          const candidateAlt = path.join(
            manifestFile,
            "sdk-anything.manifest.json",
          );
          if (fs.existsSync(candidate)) {
            manifestFile = candidate;
          } else if (fs.existsSync(candidateAlt)) {
            manifestFile = candidateAlt;
          } else {
            throw new Error(
              `No manifest file found in directory: ${targetPath}`,
            );
          }
        }

        if (!fs.existsSync(manifestFile)) {
          throw new Error(`Manifest file does not exist: ${manifestFile}`);
        }

        const raw = fs.readFileSync(manifestFile, "utf8");
        const manifest = JSON.parse(raw);
        const result = validateManifest(manifest);

        if (cmdOptions.json) {
          const out = JSON.stringify(result, null, 2);
          if (options.writeOut) options.writeOut(out + "\n");
          else console.log(out);
        } else {
          if (result.valid) {
            const msg = `Manifest is valid: ${manifest.schemaVersion} (${manifest.operations?.length ?? 0} operations)`;
            if (options.writeOut) options.writeOut(msg + "\n");
            else console.log(msg);
          } else {
            const lines = [`Manifest validation failed:`];
            result.errors.forEach((e) => lines.push(`  - ${e}`));
            const out = lines.join("\n");
            if (options.writeErr) options.writeErr(out + "\n");
            else console.error(out);
            if (options.exitOverride) {
              throw new Error(
                `Manifest validation failed with ${result.errors.length} errors`,
              );
            } else {
              process.exit(1);
            }
          }
        }
      } catch (err: unknown) {
        const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        if (options.writeErr) options.writeErr(errMsg + "\n");
        else console.error(errMsg);
        if (options.exitOverride) {
          throw err;
        } else {
          process.exit(1);
        }
      }
    });

  program
    .command("test <path>")
    .description("Run verification tests for generated project")
    .option(
      "--sandbox",
      "Execute tests in an isolated container sandbox (requires Docker/Podman)",
    )
    .option(
      "--trusted-local",
      "Execute tests in local process (trusted code only, not a sandbox)",
    )
    .option("--json", "Output results in JSON format")
    .action(
      async (
        targetPath: string,
        cmdOptions: {
          sandbox?: boolean;
          trustedLocal?: boolean;
          json?: boolean;
        },
      ) => {
        try {
          let mode: "static" | "trusted-local" | "sandbox" = "static";
          if (cmdOptions.sandbox) {
            mode = "sandbox";
          } else if (cmdOptions.trustedLocal) {
            mode = "trusted-local";
          }

          const report = await runProjectTests(targetPath, { mode });

          if (cmdOptions.json) {
            const out = JSON.stringify(report, null, 2);
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          } else {
            const lines = [
              `Verification Report for: ${path.resolve(targetPath)}`,
              `Mode:                ${report.mode}`,
              `Security Sandbox:    ${report.isSecuritySandbox ? "YES (container isolated)" : "NO (not a sandbox boundary)"}`,
              `Static checks:       ${report.staticChecksPassed ? "PASSED" : "FAILED"}`,
              `Test execution:      ${report.testExecutionPassed === undefined ? "SKIPPED (static mode)" : report.testExecutionPassed ? "PASSED" : "FAILED"}`,
              `Environment:         ${report.environment ? `${report.environment.runtime} (${report.environment.nodeVersion}) on ${report.environment.os}` : "unknown"}`,
              `Executed tasks:      ${report.executedTasks?.join(", ") || "none"}`,
              `Skipped tasks:       ${report.skippedTasks?.join(", ") || "none"}`,
              `Duration:            ${report.durationMs}ms`,
            ];
            if (report.warnings.length > 0) {
              lines.push("Warnings:");
              report.warnings.forEach((w) => lines.push(`  - ${w}`));
            }
            const out = lines.join("\n");
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          }
        } catch (err: unknown) {
          const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
          if (options.writeErr) options.writeErr(errMsg + "\n");
          else console.error(errMsg);
          if (options.exitOverride) {
            throw err;
          } else {
            process.exit(1);
          }
        }
      },
    );

  program
    .command("doctor [path]")
    .description(
      "Verify environment, dependencies, and generated project health",
    )
    .option("--json", "Output results in JSON format")
    .action(
      async (targetPath: string = ".", cmdOptions: { json?: boolean }) => {
        try {
          const report = runDoctorCheck(targetPath);
          if (cmdOptions.json) {
            const out = JSON.stringify(report, null, 2);
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          } else {
            const lines = [
              `SDK-Anything Doctor Report for: ${report.targetPath}`,
              `Status:             ${report.healthy ? "HEALTHY" : "ISSUES FOUND"}`,
              `Target SDK:         ${report.packageName ? `${report.packageName}@${report.packageVersion}` : "Not a generated project directory"}`,
              `Source Digest:      ${report.digest ?? "none"}`,
              `Manifest Version:   ${report.manifestVersion ?? "none"}`,
              `Generator Version:  ${report.generatorVersion ?? "none"}`,
              `Inventory:          ${report.inventoryValid ? `VALID (${report.totalFiles} files verified)` : "UNVERIFIED"}`,
              `Node Runtime:       ${report.nodeVersion}`,
              `Container Runtime:  ${report.containerRuntime ?? "none"}`,
              `Policy:             ${report.policySummary.enabledOperations} enabled, ${report.policySummary.disabledOperations} disabled`,
            ];
            if (report.warnings.length > 0) {
              lines.push("Warnings:");
              report.warnings.forEach((w) => lines.push(`  - ${w}`));
            }
            if (report.errors.length > 0) {
              lines.push("Errors:");
              report.errors.forEach((e) => lines.push(`  - ${e}`));
            }
            const out = lines.join("\n");
            if (options.writeOut) options.writeOut(out + "\n");
            else console.log(out);
          }

          if (!report.healthy) {
            if (options.exitOverride) {
              throw new Error(
                `Doctor check found ${report.errors.length} errors`,
              );
            } else {
              process.exit(1);
            }
          }
        } catch (err: unknown) {
          const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
          if (options.writeErr) options.writeErr(errMsg + "\n");
          else console.error(errMsg);
          if (options.exitOverride) {
            throw err;
          } else {
            process.exit(1);
          }
        }
      },
    );

  return program;
}
