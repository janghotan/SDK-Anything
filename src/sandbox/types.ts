export type TestMode = "static" | "trusted-local" | "sandbox";

export interface TestReport {
  mode: TestMode;
  isSecuritySandbox: boolean;
  staticChecksPassed: boolean;
  testExecutionPassed?: boolean;
  durationMs: number;
  environment?: {
    runtime: string;
    os: string;
    nodeVersion: string;
  };
  executedTasks?: string[];
  skippedTasks?: string[];
  logs: string[];
  warnings: string[];
}
