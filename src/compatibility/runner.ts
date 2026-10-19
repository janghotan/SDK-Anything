import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { resolveSource } from "../source/index.js";
import { analyzeSourceSnapshot } from "../analyzer/index.js";
import { buildManifest, validateManifest } from "../manifest/index.js";
import { generateArtifacts } from "../generators/index.js";
import { FIXTURE_CATALOG } from "./catalog.js";
import type {
  FixtureCatalogEntry,
  FixtureScorecard,
  CompatibilityScorecardReport,
} from "./types.js";

export async function runFixtureTest(
  entry: FixtureCatalogEntry,
  projectRoot = process.cwd(),
): Promise<FixtureScorecard> {
  const startTime = Date.now();
  const fixtureAbsPath = path.resolve(projectRoot, entry.relativePath);

  if (!entry.expectSuccess) {
    // Malformed / negative test fixture
    try {
      const snapshot = await resolveSource(fixtureAbsPath);
      await analyzeSourceSnapshot(snapshot);
      return {
        fixtureId: entry.id,
        shape: entry.shape,
        status: "FAIL",
        operationsDiscovered: 0,
        operationsEnabled: 0,
        operationsUnresolved: 0,
        manifestValid: false,
        generatedArtifactsCount: 0,
        durationMs: Date.now() - startTime,
        error: "Expected failure on malformed fixture, but resolution succeeded",
      };
    } catch {
      // Expected failure
      return {
        fixtureId: entry.id,
        shape: entry.shape,
        status: "PASS",
        operationsDiscovered: 0,
        operationsEnabled: 0,
        operationsUnresolved: 0,
        manifestValid: false,
        generatedArtifactsCount: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  const tempOutDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `sdk-compat-${entry.id}-`),
  );

  try {
    const snapshot = await resolveSource(fixtureAbsPath);
    const evidence = await analyzeSourceSnapshot(snapshot);
    const manifest = buildManifest(evidence);
    const validation = validateManifest(manifest);

    if (!validation.valid) {
      return {
        fixtureId: entry.id,
        shape: entry.shape,
        status: "FAIL",
        operationsDiscovered: manifest.operations.length,
        operationsEnabled: manifest.operations.filter((o) => o.enabledByDefault).length,
        operationsUnresolved: manifest.unresolved.length,
        manifestValid: false,
        generatedArtifactsCount: 0,
        durationMs: Date.now() - startTime,
        error: `Manifest validation failed: ${validation.errors.join("; ")}`,
      };
    }

    const files = generateArtifacts(manifest, ["mcp", "cli"], tempOutDir);

    const operationsDiscovered = manifest.operations.length;
    const operationsEnabled = manifest.operations.filter((o) => o.enabledByDefault).length;
    const operationsUnresolved = manifest.unresolved.length;

    let status: "PASS" | "FAIL" = "PASS";
    let error: string | undefined;

    if (
      entry.expectedOperationsCount !== undefined &&
      operationsDiscovered < entry.expectedOperationsCount
    ) {
      status = "FAIL";
      error = `Discovered ${operationsDiscovered} operations, expected at least ${entry.expectedOperationsCount}`;
    }

    return {
      fixtureId: entry.id,
      shape: entry.shape,
      status,
      operationsDiscovered,
      operationsEnabled,
      operationsUnresolved,
      manifestValid: true,
      generatedArtifactsCount: files.length,
      durationMs: Date.now() - startTime,
      error,
    };
  } catch (err: unknown) {
    return {
      fixtureId: entry.id,
      shape: entry.shape,
      status: "FAIL",
      operationsDiscovered: 0,
      operationsEnabled: 0,
      operationsUnresolved: 0,
      manifestValid: false,
      generatedArtifactsCount: 0,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    fs.rmSync(tempOutDir, { recursive: true, force: true });
  }
}

export async function runCompatibilityLab(
  projectRoot = process.cwd(),
): Promise<CompatibilityScorecardReport> {
  const scorecards: FixtureScorecard[] = [];

  for (const fixture of FIXTURE_CATALOG) {
    const card = await runFixtureTest(fixture, projectRoot);
    scorecards.push(card);
  }

  const passedFixtures = scorecards.filter((s) => s.status === "PASS").length;
  const failedFixtures = scorecards.filter((s) => s.status === "FAIL").length;

  return {
    timestamp: new Date().toISOString(),
    totalFixtures: scorecards.length,
    passedFixtures,
    failedFixtures,
    scorecards,
    summary: `${passedFixtures}/${scorecards.length} compatibility fixtures passed (${Math.round((passedFixtures / scorecards.length) * 100)}%)`,
  };
}
