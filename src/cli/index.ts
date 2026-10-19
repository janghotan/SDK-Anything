import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { resolveSource } from '../source/index.js';
import { analyzeSourceSnapshot } from '../analyzer/index.js';
import {
  buildManifest,
  validateManifest,
  generateStarterOverrides,
  applyOverrides,
} from '../manifest/index.js';
import { generateArtifacts } from '../generators/index.js';

export interface CreateCliOptions {
  writeOut?: (str: string) => void;
  writeErr?: (str: string) => void;
  exitOverride?: boolean;
}

export function createCli(options: CreateCliOptions = {}): Command {
  const program = new Command();

  program
    .name('sdk-anything')
    .description('Turn TypeScript/JavaScript SDKs into inspectable, testable, agent-friendly MCP tools and CLIs')
    .version('0.1.0');

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
    .command('inspect <source>')
    .description('Inspect an npm package, local directory, or public GitHub repo statically')
    .option('--write-overrides', 'Emit starter sdk-anything.overrides.json for ambiguous types/lifecycle')
    .option('--json', 'Output results in JSON format')
    .action(async (source: string, cmdOptions: { writeOverrides?: boolean; json?: boolean }) => {
      try {
        const snapshot = await resolveSource(source);
        const evidence = await analyzeSourceSnapshot(snapshot);

        if (cmdOptions.writeOverrides) {
          const manifest = buildManifest(evidence);
          const starterOverrides = generateStarterOverrides(manifest);
          const overridesPath = path.resolve('sdk-anything.overrides.json');
          fs.writeFileSync(overridesPath, JSON.stringify(starterOverrides, null, 2), 'utf8');
          const msg = `Wrote starter overrides to ${overridesPath}`;
          if (options.writeOut) options.writeOut(msg + '\n');
          else console.log(msg);
        }

        if (cmdOptions.json) {
          const out = JSON.stringify(evidence, null, 2);
          if (options.writeOut) options.writeOut(out + '\n');
          else console.log(out);
        } else {
          const lines = [
            `Resolved source: ${snapshot.identifier}`,
            `Kind:            ${snapshot.kind}`,
            `Version:         ${snapshot.version}`,
            `Digest:          ${snapshot.digest}`,
            `Entry point:     ${evidence.entryPoint}`,
            `Functions:       ${evidence.functions.length} (${evidence.functions.map(f => f.name).join(', ') || 'none'})`,
            `Classes:         ${evidence.classes.length} (${evidence.classes.map(c => c.name).join(', ') || 'none'})`,
            `Factories:       ${evidence.factories.length} (${evidence.factories.map(f => f.name).join(', ') || 'none'})`,
            `Unresolved:      ${evidence.unresolved.length}`,
          ];
          if (evidence.unresolved.length > 0) {
            lines.push(`Unresolved symbols:`);
            evidence.unresolved.forEach(u => lines.push(`  - ${u.symbolName}: ${u.reason}`));
          }
          if (snapshot.warnings.length > 0) {
            lines.push(`Warnings:`);
            snapshot.warnings.forEach(w => lines.push(`  - ${w}`));
          }
          const out = lines.join('\n');
          if (options.writeOut) options.writeOut(out + '\n');
          else console.log(out);
        }
      } catch (err: unknown) {
        const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        if (options.writeErr) options.writeErr(errMsg + '\n');
        else console.error(errMsg);
        if (options.exitOverride) {
          throw err;
        } else {
          process.exit(1);
        }
      }
    });

  program
    .command('generate <source>')
    .description('Generate MCP server, CLI, and consumer SKILL.md from inspected SDK')
    .option('--targets <targets>', 'Comma-separated generation targets (mcp,cli)', 'mcp,cli')
    .option('--output <dir>', 'Output directory for generated project', './generated')
    .option('--ai', 'Enable optional AI-assisted descriptions and operation selection')
    .option('--json', 'Output results in JSON format')
    .action(async (source: string, cmdOptions: { targets?: string; output?: string; ai?: boolean; json?: boolean }) => {
      try {
        const snapshot = await resolveSource(source);
        const evidence = await analyzeSourceSnapshot(snapshot);
        let manifest = buildManifest(evidence);

        // Check for local overrides file in cwd
        const overridesPath = path.resolve('sdk-anything.overrides.json');
        if (fs.existsSync(overridesPath)) {
          const rawOverrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
          manifest = applyOverrides(manifest, rawOverrides);
        }

        const targets = (cmdOptions.targets ?? 'mcp,cli').split(',').map(t => t.trim()).filter(Boolean);
        const outputDir = cmdOptions.output ?? './generated';

        const generatedFiles = generateArtifacts(manifest, targets, outputDir);

        if (cmdOptions.json) {
          const out = JSON.stringify({
            manifest: manifest.source,
            targets,
            outputDir: path.resolve(outputDir),
            files: generatedFiles.map(f => path.relative(process.cwd(), f)),
          }, null, 2);
          if (options.writeOut) options.writeOut(out + '\n');
          else console.log(out);
        } else {
          const lines = [
            `Generated artifacts in: ${path.resolve(outputDir)}`,
            `Targets: ${targets.join(', ')}`,
            `Enabled operations: ${manifest.operations.filter(o => o.enabledByDefault).length}`,
            `Files created:`,
            ...generatedFiles.map(f => `  - ${path.relative(process.cwd(), f)}`),
          ];
          const out = lines.join('\n');
          if (options.writeOut) options.writeOut(out + '\n');
          else console.log(out);
        }
      } catch (err: unknown) {
        const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        if (options.writeErr) options.writeErr(errMsg + '\n');
        else console.error(errMsg);
        if (options.exitOverride) {
          throw err;
        } else {
          process.exit(1);
        }
      }
    });

  program
    .command('validate <path>')
    .description('Statically validate capability manifest and generated project')
    .option('--json', 'Output results in JSON format')
    .action(async (targetPath: string, cmdOptions: { json?: boolean }) => {
      try {
        let manifestFile = path.resolve(targetPath);
        if (fs.existsSync(manifestFile) && fs.statSync(manifestFile).isDirectory()) {
          const candidate = path.join(manifestFile, 'capability-manifest.json');
          const candidateAlt = path.join(manifestFile, 'sdk-anything.manifest.json');
          if (fs.existsSync(candidate)) {
            manifestFile = candidate;
          } else if (fs.existsSync(candidateAlt)) {
            manifestFile = candidateAlt;
          } else {
            throw new Error(`No manifest file found in directory: ${targetPath}`);
          }
        }

        if (!fs.existsSync(manifestFile)) {
          throw new Error(`Manifest file does not exist: ${manifestFile}`);
        }

        const raw = fs.readFileSync(manifestFile, 'utf8');
        const manifest = JSON.parse(raw);
        const result = validateManifest(manifest);

        if (cmdOptions.json) {
          const out = JSON.stringify(result, null, 2);
          if (options.writeOut) options.writeOut(out + '\n');
          else console.log(out);
        } else {
          if (result.valid) {
            const msg = `Manifest is valid: ${manifest.schemaVersion} (${manifest.operations?.length ?? 0} operations)`;
            if (options.writeOut) options.writeOut(msg + '\n');
            else console.log(msg);
          } else {
            const lines = [`Manifest validation failed:`];
            result.errors.forEach(e => lines.push(`  - ${e}`));
            const out = lines.join('\n');
            if (options.writeErr) options.writeErr(out + '\n');
            else console.error(out);
            if (options.exitOverride) {
              throw new Error(`Manifest validation failed with ${result.errors.length} errors`);
            } else {
              process.exit(1);
            }
          }
        }
      } catch (err: unknown) {
        const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        if (options.writeErr) options.writeErr(errMsg + '\n');
        else console.error(errMsg);
        if (options.exitOverride) {
          throw err;
        } else {
          process.exit(1);
        }
      }
    });

  program
    .command('test <path>')
    .description('Run verification tests for generated project')
    .option('--sandbox', 'Execute tests in an isolated container sandbox (requires Docker/Podman)')
    .option('--trusted-local', 'Execute tests in local process (trusted code only, not a sandbox)')
    .option('--json', 'Output results in JSON format')
    .action(async (_path, _cmdOptions) => {
      // Stub for Phase 01; full implementation in subsequent phases
    });

  return program;
}
