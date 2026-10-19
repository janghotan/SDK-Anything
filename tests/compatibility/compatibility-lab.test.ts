import { describe, it, expect } from "vitest";
import {
  runCompatibilityLab,
  FIXTURE_CATALOG,
} from "../../src/compatibility/index.js";

describe("Phase 05: SDK Compatibility Lab", () => {
  it("has a declared fixture catalog covering required SDK shapes", () => {
    expect(FIXTURE_CATALOG.length).toBeGreaterThanOrEqual(5);

    const shapes = FIXTURE_CATALOG.map((f) => f.shape);
    expect(shapes).toContain("pure-function");
    expect(shapes).toContain("authenticated-client");
    expect(shapes).toContain("barrel-reexports");
    expect(shapes).toContain("complex-types");
    expect(shapes).toContain("empty-malformed");
  });

  it("executes compatibility lab across all fixtures with 100% declared pass rate", async () => {
    const report = await runCompatibilityLab();

    expect(report.totalFixtures).toBeGreaterThanOrEqual(5);
    expect(report.failedFixtures).toBe(0);
    expect(report.passedFixtures).toBe(report.totalFixtures);

    // Verify individual scorecards
    for (const card of report.scorecards) {
      expect(card.status).toBe("PASS");
      expect(card.error).toBeUndefined();
    }
  });
});
