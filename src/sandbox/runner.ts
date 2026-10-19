import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import type { TestMode, TestReport } from "./types.js";
import { validateManifest } from "../manifest/validator.js";

export function detectContainerRuntime(): "docker" | "podman" | null {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return "docker";
  } catch {
    // Docker not available
  }

  try {
    execSync("podman --version", { stdio: "ignore" });
    return "podman";
  } catch {
    // Podman not available
  }

  return null;
}

export interface RunProjectTestsOptions {
  mode?: TestMode;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export async function runProjectTests(
  projectPath: string,
  options: RunProjectTestsOptions = {},
): Promise<TestReport> {
  const startTime = Date.now();
  const logs: string[] = [];
  const warnings: string[] = [];
  const mode: TestMode = options.mode ?? "static";
  const resolvedPath = path.resolve(projectPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  // 1. Static Verification (always executed, requires no container)
  logs.push(`Running static checks on ${resolvedPath}...`);
  let manifestPath = path.join(resolvedPath, "capability-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    manifestPath = path.join(resolvedPath, "sdk-anything.manifest.json");
  }

  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const val = validateManifest(manifest);
      if (!val.valid) {
        throw new Error(
          `Static manifest validation failed: ${val.errors.join("; ")}`,
        );
      }
      logs.push(
        `Manifest schema validation passed (${manifest.operations?.length ?? 0} operations)`,
      );
    } catch (err: any) {
      throw new Error(`Manifest verification failed: ${err.message}`);
    }
  } else {
    warnings.push(`No capability-manifest.json found at ${resolvedPath}`);
  }

  const staticChecksPassed = true;

  // 2. Execution Testing Modes
  const currentEnv = {
    runtime: "node",
    os: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
  };

  const executedTasks: string[] = ["static manifest validation"];
  const skippedTasks: string[] = [];

  if (mode === "sandbox") {
    const runtime = detectContainerRuntime();
    if (!runtime) {
      throw new Error(
        `Container runtime (docker or podman) is required for --sandbox mode, but neither was found on PATH. ` +
          `SDK-Anything refuses to silently fall back to trusted-local execution for untrusted code.`,
      );
    }

    // Container isolation execution
    logs.push(
      `Executing tests inside isolated ${runtime} container (no network, temporary volume)...`,
    );
    const containerArgs = [
      "run",
      "--rm",
      "--network",
      "none",
      "-v",
      `${resolvedPath}:/workspace:ro`,
      "-w",
      "/workspace",
      "node:20-alpine",
      "npm",
      "test",
    ];

    const proc = spawnSync(runtime, containerArgs, {
      encoding: "utf8",
      timeout: options.timeoutMs ?? 60000,
    });

    executedTasks.push(`container test execution (${runtime})`);

    if (proc.status !== 0) {
      throw new Error(
        `Sandbox test execution failed (exit code ${proc.status}): ${proc.stderr || proc.stdout}`,
      );
    }

    logs.push("Container test execution passed.");
    return {
      mode: "sandbox",
      isSecuritySandbox: true,
      staticChecksPassed: true,
      testExecutionPassed: true,
      durationMs: Date.now() - startTime,
      environment: {
        runtime,
        os: `${process.platform}-${process.arch}`,
        nodeVersion: process.version,
      },
      executedTasks,
      skippedTasks,
      logs,
      warnings,
    };
  }

  if (mode === "trusted-local") {
    logs.push(
      "Running tests in --trusted-local mode (sanitized child process environment, NOT a security sandbox)...",
    );

    // Locate candidate package.json files
    const candidateDirs: string[] = [];
    if (fs.existsSync(path.join(resolvedPath, "package.json"))) {
      candidateDirs.push(resolvedPath);
    }
    for (const sub of ["cli", "mcp"]) {
      const subDir = path.join(resolvedPath, sub);
      if (fs.existsSync(path.join(subDir, "package.json"))) {
        candidateDirs.push(subDir);
      }
    }

    let testPassed = true;
    let anyTestRun = false;

    for (const dir of candidateDirs) {
      const pkgPath = path.join(dir, "package.json");
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.scripts?.test) {
          anyTestRun = true;
          const targetLabel = path.relative(resolvedPath, dir) || "root";
          if (!fs.existsSync(path.join(dir, "node_modules"))) {
            warnings.push(
              `node_modules not found in ${targetLabel}; run npm install before executing tests`,
            );
          }
          executedTasks.push(`npm test (${targetLabel})`);

          const sanitizedEnv: Record<string, string> = {
            PATH: process.env.PATH || "",
            NODE_ENV: "test",
            TMPDIR: process.env.TMPDIR || "/tmp",
            ...(options.env || {}),
          };

          const proc = spawnSync("npm", ["test"], {
            cwd: dir,
            env: sanitizedEnv,
            encoding: "utf8",
            timeout: options.timeoutMs ?? 30000,
          });

          if (proc.status !== 0) {
            logs.push(`Test command output (${targetLabel}): ${proc.stdout}\n${proc.stderr}`);
            testPassed = false;
          } else {
            logs.push(`Test command passed for ${targetLabel}.`);
          }
        }
      } catch (err: any) {
        warnings.push(`Could not execute npm test in ${dir}: ${err.message}`);
      }
    }

    if (!anyTestRun) {
      warnings.push("No test scripts found in project or subprojects");
      skippedTasks.push("npm test (no test scripts declared)");
    }

    return {
      mode: "trusted-local",
      isSecuritySandbox: false, // Explicitly false
      staticChecksPassed: true,
      testExecutionPassed: testPassed,
      durationMs: Date.now() - startTime,
      environment: currentEnv,
      executedTasks,
      skippedTasks,
      logs,
      warnings,
    };
  }

  // mode === 'static'
  skippedTasks.push("child process test execution (static mode)");
  return {
    mode: "static",
    isSecuritySandbox: false,
    staticChecksPassed,
    testExecutionPassed: undefined,
    durationMs: Date.now() - startTime,
    environment: currentEnv,
    executedTasks,
    skippedTasks,
    logs,
    warnings,
  };
}
