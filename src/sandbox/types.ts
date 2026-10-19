export type TestMode = "static" | "trusted-local" | "sandbox";

export interface TestReport {
  mode: TestMode;
  isSecuritySandbox: boolean;
  staticChecksPassed: boolean;
  testExecutionPassed?: boolean;
  durationMs: number;
  logs: string[];
  warnings: string[];
}
