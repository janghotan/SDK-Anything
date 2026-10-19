export type FixtureShape =
  | "pure-function"
  | "authenticated-client"
  | "barrel-reexports"
  | "complex-types"
  | "factory-client"
  | "empty-malformed";

export interface FixtureCatalogEntry {
  id: string;
  name: string;
  relativePath: string;
  shape: FixtureShape;
  expectedOperationsCount?: number;
  expectedUnresolvedCount?: number;
  expectSuccess: boolean;
  notes: string;
}

export interface FixtureScorecard {
  fixtureId: string;
  shape: FixtureShape;
  status: "PASS" | "FAIL";
  operationsDiscovered: number;
  operationsEnabled: number;
  operationsUnresolved: number;
  manifestValid: boolean;
  generatedArtifactsCount: number;
  durationMs: number;
  error?: string;
}

export interface CompatibilityScorecardReport {
  timestamp: string;
  totalFixtures: number;
  passedFixtures: number;
  failedFixtures: number;
  scorecards: FixtureScorecard[];
  summary: string;
}
