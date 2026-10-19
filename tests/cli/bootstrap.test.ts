import { describe, it, expect } from "vitest";
import { createCli } from "../../src/cli/index.js";
import { resolveConfig } from "../../src/cli/config.js";

describe("CLI bootstrap and config resolution", () => {
  it("outputs help text when --help is passed", async () => {
    let output = "";
    const cli = createCli({
      writeOut: (str: string) => {
        output += str;
      },
      writeErr: () => {},
      exitOverride: true,
    });

    try {
      await cli.parseAsync(["node", "sdk-anything", "--help"]);
    } catch {
      // commander exitOverride throws
    }

    expect(output).toContain("sdk-anything");
    expect(output).toContain("inspect");
    expect(output).toContain("generate");
    expect(output).toContain("validate");
    expect(output).toContain("test");
  });

  it("outputs version when --version is passed", async () => {
    let output = "";
    const cli = createCli({
      writeOut: (str: string) => {
        output += str;
      },
      writeErr: () => {},
      exitOverride: true,
    });

    try {
      await cli.parseAsync(["node", "sdk-anything", "--version"]);
    } catch {
      // commander exitOverride throws
    }

    expect(output.trim()).toBe("0.1.0");
  });

  it("fails with exit code or error on unknown command", async () => {
    let errOutput = "";
    const cli = createCli({
      writeOut: () => {},
      writeErr: (str: string) => {
        errOutput += str;
      },
      exitOverride: true,
    });

    await expect(
      cli.parseAsync(["node", "sdk-anything", "unknown-cmd"]),
    ).rejects.toThrow();
    expect(errOutput).toBeDefined();
  });

  it("inspects local source directory and prints information", async () => {
    let output = "";
    const cli = createCli({
      writeOut: (str: string) => {
        output += str;
      },
      writeErr: () => {},
      exitOverride: true,
    });

    await cli.parseAsync([
      "node",
      "sdk-anything",
      "inspect",
      "./tests/fixtures/sample-local-sdk",
    ]);
    expect(output).toContain("Resolved source:");
    expect(output).toContain("sample-local-sdk");
    expect(output).toContain("Digest:");
  });

  it("inspects local source directory and outputs JSON when --json is provided", async () => {
    let output = "";
    const cli = createCli({
      writeOut: (str: string) => {
        output += str;
      },
      writeErr: () => {},
      exitOverride: true,
    });

    await cli.parseAsync([
      "node",
      "sdk-anything",
      "inspect",
      "./tests/fixtures/sample-local-sdk",
      "--json",
    ]);
    const parsed = JSON.parse(output);
    expect(parsed.source.kind).toBe("local");
    expect(parsed.source.version).toBe("1.0.0");
    expect(parsed.source.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.functions).toBeDefined();
  });

  it("resolves configuration with defaults", () => {
    const config = resolveConfig();
    expect(config.targets).toEqual(["mcp", "cli"]);
    expect(config.output).toBe("./generated");
    expect(config.ai).toBe(false);
    expect(config.sandbox).toBe(false);
    expect(config.trustedLocal).toBe(false);
  });

  it("resolves configuration with explicit options overriding defaults", () => {
    const config = resolveConfig({
      targets: "mcp",
      output: "./custom-output",
      ai: true,
      sandbox: true,
    });
    expect(config.targets).toEqual(["mcp"]);
    expect(config.output).toBe("./custom-output");
    expect(config.ai).toBe(true);
    expect(config.sandbox).toBe(true);
  });

  it("resolves configuration with environment variables", () => {
    const origEnv = process.env.SDK_ANYTHING_AI;
    try {
      process.env.SDK_ANYTHING_AI = "true";
      const config = resolveConfig();
      expect(config.ai).toBe(true);
    } finally {
      if (origEnv === undefined) {
        delete process.env.SDK_ANYTHING_AI;
      } else {
        process.env.SDK_ANYTHING_AI = origEnv;
      }
    }
  });
});
