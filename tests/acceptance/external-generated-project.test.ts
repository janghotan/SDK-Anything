import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile, spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = path.resolve(".");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

function runOk(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Command failed: ${command} ${args.join(" ")}\nstdout:\n${stdout}\nstderr:\n${stderr}\n${error.message}`,
            ),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function runProbe(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
): Promise<{
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: string;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeout ?? 30000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        status: null,
        signal: null,
        error: error.message,
        stdout,
        stderr,
      });
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolve({
        status,
        signal,
        error: timedOut ? "Timed out" : undefined,
        stdout,
        stderr,
      });
    });
  });
}

interface ExternalServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * Run the loopback fixture server in its own process. This mirrors a real
 * remote service and keeps the test worker's event loop free while generated
 * CLI binaries run as independent processes.
 */
function startExternalServer(workDir: string): Promise<ExternalServer> {
  const scriptPath = path.join(workDir, "mock-server.mjs");
  fs.writeFileSync(
    scriptPath,
    `
import * as http from "node:http";
const items = Array.from({ length: 25 }, (_, i) => ({
  id: \`item-\${i + 1}\`,
  name: \`Item \${i + 1}\`,
  tag: i % 2 === 0 ? "even" : "odd",
}));
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", \`http://\${req.headers.host}\`);
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer synthetic-secret-token")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", message: "Invalid or missing API key" }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/v1/items") {
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);
    const pageItems = items.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < items.length ? String(cursor + limit) : undefined;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ items: pageItems, nextCursor }));
    return;
  }
  if (req.method === "POST" && url.pathname === "/v1/items") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const item = { id: "item-new", name: parsed.name ?? "Untitled", tag: parsed.tag };
      items.push(item);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(item));
    });
    return;
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/v1/items/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ deleted: true, id: url.pathname.split("/").pop() }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});
server.listen(0, "127.0.0.1", () => {
  console.log(\`PORT=\${server.address().port}\`);
});
`,
  );

  const child = spawn(process.execPath, [scriptPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    let output = "";
    const cleanup = () => {
      child.stdout.removeAllListeners();
      child.stderr.removeAllListeners();
      child.removeAllListeners();
    };
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/PORT=(\d+)/);
      if (match) {
        cleanup();
        resolve({
          baseUrl: `http://127.0.0.1:${match[1]}`,
          close: () =>
            new Promise<void>((done) => {
              if (child.exitCode !== null) return done();
              child.once("exit", () => done());
              child.kill("SIGTERM");
            }),
        });
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("exit", (code) => {
      cleanup();
      reject(
        new Error(
          `Mock server exited before reporting a port (code ${code}): ${output}`,
        ),
      );
    });
  });
}

interface SkillOperation {
  id?: string;
  mcp: string;
  cli: string;
}

function parseSkillTables(skill: string): {
  enabled: SkillOperation[];
  disabled: SkillOperation[];
} {
  const enabled: SkillOperation[] = [];
  const disabled: SkillOperation[] = [];
  let section: "enabled" | "disabled" | "other" = "other";
  for (const line of skill.split("\n")) {
    if (line.startsWith("## ")) {
      if (line.includes("Available Atomic Tools")) section = "enabled";
      else if (line.includes("Disabled Operations")) section = "disabled";
      else section = "other";
      continue;
    }
    if (section === "other" || !line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const strip = (value: string) => value.replace(/`/g, "");
    if (
      section === "enabled" &&
      cells.length === 4 &&
      cells[0].startsWith("`")
    ) {
      enabled.push({ mcp: strip(cells[0]), cli: strip(cells[1]) });
    } else if (
      section === "disabled" &&
      cells.length === 5 &&
      cells[0].startsWith("`")
    ) {
      disabled.push({
        id: strip(cells[0]),
        mcp: strip(cells[1]),
        cli: strip(cells[2]),
      });
    }
  }
  return { enabled, disabled };
}

describe("Phase 12: Installed package -> standalone generated project acceptance", () => {
  let workDir: string;
  let consumerDir: string;
  let generatedDir: string;
  let cliDir: string;
  let mcpDir: string;
  let sdkDir: string;
  let server: ExternalServer;
  let clientEnv: NodeJS.ProcessEnv;
  let skill: { enabled: SkillOperation[]; disabled: SkillOperation[] };

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-external-accept-"));
    consumerDir = path.join(workDir, "consumer");
    generatedDir = path.join(consumerDir, "generated");
    cliDir = path.join(generatedDir, "cli");
    mcpDir = path.join(generatedDir, "mcp");
    sdkDir = path.join(workDir, "built-sdk");

    // 1. Build a realistic client SDK package from the TypeScript fixture so
    //    it can be vendored and consumed without the generator repository.
    const sdkSrc = path.join(workDir, "sdk-src");
    fs.mkdirSync(sdkSrc, { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot, "tests/fixtures/client-sdk/src/index.ts"),
      path.join(sdkSrc, "index.ts"),
    );
    fs.writeFileSync(
      path.join(sdkSrc, "package.json"),
      JSON.stringify({
        name: "@fixture/client-sdk",
        version: "1.0.0",
        type: "module",
      }),
    );
    await runOk(
      process.execPath,
      [
        path.join(repoRoot, "node_modules/typescript/bin/tsc"),
        "index.ts",
        "--outDir",
        path.join(sdkDir, "dist"),
        "--declaration",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2022",
        "--strict",
        "--skipLibCheck",
      ],
      { cwd: sdkSrc },
    );
    fs.writeFileSync(
      path.join(sdkDir, "package.json"),
      JSON.stringify({
        name: "@fixture/client-sdk",
        version: "1.0.0",
        type: "module",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
      }),
    );

    // 2. Pack and install the real sdk-anything tarball in a clean consumer.
    await runOk(npmBin, ["pack", "--pack-destination", workDir], {
      cwd: repoRoot,
    });
    const tarball = fs
      .readdirSync(workDir)
      .find((entry) => entry.endsWith(".tgz"));
    expect(tarball, "npm pack should produce a tarball").toBeTruthy();

    fs.mkdirSync(consumerDir, { recursive: true });
    fs.writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify({ name: "acceptance-consumer", private: true }),
    );
    await runOk(
      npmBin,
      [
        "install",
        path.join(workDir, tarball!),
        "--no-audit",
        "--no-fund",
        "--prefer-offline",
      ],
      { cwd: consumerDir },
    );

    // 3. Generate from the installed CLI, with reviewed client overrides and
    //    the built SDK vendored into the project.
    fs.writeFileSync(
      path.join(consumerDir, "sdk-anything.overrides.json"),
      JSON.stringify({
        schemaVersion: "sdk-anything/overrides/v1",
        client: {
          construction: "class",
          export: "TestApiClient",
          options: {
            apiKey: {
              type: "secret",
              source: "env:MOCK_CLIENT_SECRET_KEY",
              required: true,
            },
            baseUrl: {
              type: "string",
              source: "env:MOCK_CLIENT_BASE_URL",
              required: false,
            },
          },
        },
      }),
    );

    await runOk(
      process.execPath,
      [
        path.join(consumerDir, "node_modules/sdk-anything/dist/cli/bin.js"),
        "generate",
        path.join(repoRoot, "tests/fixtures/client-sdk"),
        "--vendor-sdk",
        sdkDir,
        "--output",
        generatedDir,
        "--json",
      ],
      { cwd: consumerDir },
    );

    // 4. Install and build both adapters as independent npm projects.
    for (const adapterDir of [cliDir, mcpDir]) {
      await runOk(
        npmBin,
        [
          "install",
          "--no-audit",
          "--no-fund",
          "--ignore-scripts",
          "--prefer-offline",
        ],
        { cwd: adapterDir },
      );
      await runOk(npmBin, ["run", "build"], { cwd: adapterDir });
    }

    skill = parseSkillTables(
      fs.readFileSync(path.join(generatedDir, "SKILL.md"), "utf8"),
    );

    server = await startExternalServer(workDir);
    clientEnv = {
      MOCK_CLIENT_SECRET_KEY: "synthetic-secret-token-42",
      MOCK_CLIENT_BASE_URL: server.baseUrl,
    };
  }, 600000);

  afterAll(async () => {
    if (server) await server.close();
    if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
  });

  function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of [
      "MOCK_CLIENT_SECRET_KEY",
      "MOCK_CLIENT_BASE_URL",
      "SDK_ANYTHING_ALLOWED_EFFECTS",
      "SDK_ANYTHING_ALLOWED_OPERATIONS",
      "SDK_ANYTHING_ALLOW_DESTRUCTIVE",
    ]) {
      delete env[key];
    }
    return { ...env, ...overrides };
  }

  function runCli(args: string[], overrides: NodeJS.ProcessEnv = {}) {
    return runProbe(
      process.execPath,
      [path.join(cliDir, "dist/cli.js"), ...args],
      {
        cwd: cliDir,
        env: baseEnv(overrides),
      },
    );
  }

  function readOperation(match: string): SkillOperation {
    const op =
      skill.enabled.find((entry) => entry.cli.toLowerCase().includes(match)) ??
      skill.disabled.find((entry) => entry.cli.toLowerCase().includes(match));
    expect(
      op,
      `SKILL.md should document an operation matching ${match}`,
    ).toBeTruthy();
    return op!;
  }

  async function connectMcp(overrides: NodeJS.ProcessEnv = {}) {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(mcpDir, "dist/server.js")],
      env: baseEnv({ ...clientEnv, ...overrides }) as Record<string, string>,
      stderr: "pipe",
    });
    const client = new Client(
      { name: "external-acceptance-client", version: "0.1.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client;
  }

  it("ships a self-contained, independently buildable generated project", () => {
    for (const file of [
      "capability-manifest.json",
      "SKILL.md",
      "README.md",
      ".sdk-anything-inventory.json",
      "cli/dist/cli.js",
      "cli/dist/capability-manifest.json",
      "mcp/dist/server.js",
      "mcp/dist/capability-manifest.json",
      "vendor/-fixture-client-sdk/dist/index.js",
    ]) {
      expect(fs.existsSync(path.join(generatedDir, file)), file).toBe(true);
    }

    // The generated projects never import the generator repository.
    for (const adapterDir of [cliDir, mcpDir]) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(adapterDir, "package.json"), "utf8"),
      );
      expect(pkg.dependencies["@fixture/client-sdk"]).toBe(
        "file:../vendor/-fixture-client-sdk",
      );
      for (const generatedFile of ["dist/cli.js", "dist/server.js"]) {
        const candidate = path.join(adapterDir, generatedFile);
        if (!fs.existsSync(candidate)) continue;
        const source = fs.readFileSync(candidate, "utf8");
        expect(source).not.toContain("SDK-Anything/src");
        expect(source).not.toContain(repoRoot);
      }
    }
  }, 60000);

  it("exposes identical operations through SKILL.md, CLI help and MCP tools", async () => {
    const allOps = [...skill.enabled, ...skill.disabled];
    expect(skill.enabled).toHaveLength(1);
    expect(skill.disabled.map((op) => op.id)).toEqual(
      expect.arrayContaining([
        "testapiclient.createItem",
        "testapiclient.deleteItem",
      ]),
    );

    const help = await runCli(["--help"]);
    expect(help.status).toBe(0);
    for (const op of allOps) {
      expect(help.stdout).toContain(op.cli);
    }

    const list = await runCli(["list", "--json"]);
    expect(list.status).toBe(0);
    const listed = JSON.parse(list.stdout) as Array<{ id: string }>;
    expect(new Set(listed.map((entry) => entry.id))).toEqual(
      new Set(
        skill.disabled.map((op) => op.id!).concat("testapiclient.listItems"),
      ),
    );

    const mcp = await connectMcp();
    try {
      const tools = await mcp.listTools();
      expect(new Set(tools.tools.map((tool) => tool.name))).toEqual(
        new Set(allOps.map((op) => op.mcp)),
      );
    } finally {
      await mcp.close();
    }
  }, 60000);

  it("executes authenticated reads and cursor pagination through the generated CLI", async () => {
    const readOp = readOperation("listitems");

    const first = await runCli(
      [
        readOp.cli,
        "--input",
        JSON.stringify({ query: { limit: 2 } }),
        "--json",
      ],
      clientEnv,
    );
    expect(first.status, first.stderr).toBe(0);
    const firstPage = JSON.parse(first.stdout);
    expect(firstPage.items.map((item: any) => item.id)).toEqual([
      "item-1",
      "item-2",
    ]);
    expect(firstPage.nextCursor).toBe("2");

    const second = await runCli(
      [
        readOp.cli,
        "--input",
        JSON.stringify({ query: { limit: 2, cursor: firstPage.nextCursor } }),
        "--json",
      ],
      clientEnv,
    );
    expect(second.status, second.stderr).toBe(0);
    const secondPage = JSON.parse(second.stdout);
    expect(secondPage.items.map((item: any) => item.id)).toEqual([
      "item-3",
      "item-4",
    ]);
    expect(secondPage.nextCursor).toBe("4");
  }, 60000);

  it("fails closed on unsafe effects and permits explicit, scoped opt-in", async () => {
    const writeOp = readOperation("createitem");
    const destructiveOp = readOperation("deleteitem");

    const deniedWrite = await runCli(
      [writeOp.cli, "--input", JSON.stringify({ input: { name: "blocked" } })],
      clientEnv,
    );
    expect(deniedWrite.status).not.toBe(0);
    expect(deniedWrite.stderr).toContain("POLICY_DENIED");

    const deniedDelete = await runCli(
      [destructiveOp.cli, "--input", JSON.stringify({ id: "item-1" })],
      clientEnv,
    );
    expect(deniedDelete.status).not.toBe(0);
    expect(deniedDelete.stderr).toContain("POLICY_DENIED");

    const scopedDenial = await runCli(
      [
        readOperation("listitems").cli,
        "--input",
        JSON.stringify({ query: { limit: 1 } }),
        "--allow-operations",
        destructiveOp.id!,
      ],
      clientEnv,
    );
    expect(scopedDenial.status).not.toBe(0);
    expect(scopedDenial.stderr).toContain("POLICY_DENIED");

    const allowedWrite = await runCli(
      [
        writeOp.cli,
        "--input",
        JSON.stringify({ input: { name: "reviewed" } }),
        "--allow-effects",
        "write",
        "--json",
      ],
      clientEnv,
    );
    expect(allowedWrite.status, allowedWrite.stderr).toBe(0);
    expect(JSON.parse(allowedWrite.stdout).name).toBe("reviewed");

    const allowedDelete = await runCli(
      [
        destructiveOp.cli,
        "--input",
        JSON.stringify({ id: "item-1" }),
        "--allow-destructive",
        "--json",
      ],
      clientEnv,
    );
    expect(allowedDelete.status, allowedDelete.stderr).toBe(0);
    expect(JSON.parse(allowedDelete.stdout)).toEqual({
      deleted: true,
      id: "item-1",
    });

    // A per-operation allowlist is a scoped grant that authorizes exactly one
    // operation, including disabled write effects.
    const scopedWrite = await runCli(
      [
        writeOp.cli,
        "--input",
        JSON.stringify({ input: { name: "scoped" } }),
        "--allow-operations",
        writeOp.id!,
        "--json",
      ],
      clientEnv,
    );
    expect(scopedWrite.status, scopedWrite.stderr).toBe(0);
    expect(JSON.parse(scopedWrite.stdout).name).toBe("scoped");
  }, 90000);

  it("returns actionable validation and auth errors without leaking secrets", async () => {
    const readOp = readOperation("listitems");

    const invalid = await runCli(
      [
        readOp.cli,
        "--input",
        JSON.stringify({ query: { limit: "not-a-number" } }),
        "--json",
      ],
      clientEnv,
    );
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain("INVALID_INPUT");
    expect(invalid.stderr).toMatch(/query\/limit/);

    const authFailure = await runCli(
      [readOp.cli, "--input", JSON.stringify({ query: { limit: 1 } })],
      {
        MOCK_CLIENT_SECRET_KEY: "wrong-bad-key",
        MOCK_CLIENT_BASE_URL: server.baseUrl,
      },
    );
    expect(authFailure.status).not.toBe(0);
    expect(authFailure.stderr).toContain("AUTH_REQUIRED");
    expect(authFailure.stderr).not.toContain("wrong-bad-key");

    const credentialUrl = `http://user:synthetic-secret-token-42@127.0.0.1:1`;
    const redacted = await runCli(
      [readOp.cli, "--input", JSON.stringify({ query: { limit: 1 } })],
      {
        MOCK_CLIENT_SECRET_KEY: "synthetic-secret-token-42",
        MOCK_CLIENT_BASE_URL: credentialUrl,
      },
    );
    expect(redacted.status).not.toBe(0);
    expect(redacted.stderr).not.toContain("synthetic-secret-token-42");
    expect(redacted.stderr).toContain("[REDACTED]");
  }, 60000);

  it("serves the same operations over real MCP stdio transport", async () => {
    const readOp = readOperation("listitems");
    const writeOp = readOperation("createitem");
    const destructiveOp = readOperation("deleteitem");

    const client = await connectMcp();
    try {
      const read = (await client.callTool({
        name: readOp.mcp,
        arguments: { query: { limit: 2 } },
      })) as any;
      expect(read.isError).toBeFalsy();
      const firstPage = JSON.parse(read.content[0].text);
      expect(firstPage.items.map((item: any) => item.id)).toEqual([
        "item-1",
        "item-2",
      ]);

      const second = (await client.callTool({
        name: readOp.mcp,
        arguments: { query: { limit: 2, cursor: firstPage.nextCursor } },
      })) as any;
      expect(second.isError).toBeFalsy();
      expect(
        JSON.parse(second.content[0].text).items.map((item: any) => item.id),
      ).toEqual(["item-3", "item-4"]);

      const deniedWrite = (await client.callTool({
        name: writeOp.mcp,
        arguments: { input: { name: "blocked" } },
      })) as any;
      expect(deniedWrite.isError).toBe(true);
      expect(deniedWrite.content[0].text).toContain("POLICY_DENIED");

      const deniedDelete = (await client.callTool({
        name: destructiveOp.mcp,
        arguments: { id: "item-1" },
      })) as any;
      expect(deniedDelete.isError).toBe(true);
      expect(deniedDelete.content[0].text).toContain("POLICY_DENIED");

      const invalid = (await client.callTool({
        name: readOp.mcp,
        arguments: { query: { limit: "bad" } },
      })) as any;
      expect(invalid.isError).toBe(true);
      expect(invalid.content[0].text).toContain("INVALID_INPUT");
    } finally {
      await client.close();
    }

    const elevated = await connectMcp({
      SDK_ANYTHING_ALLOWED_EFFECTS: "read,write",
    });
    try {
      const allowedWrite = (await elevated.callTool({
        name: writeOp.mcp,
        arguments: { input: { name: "reviewed" } },
      })) as any;
      expect(allowedWrite.isError).toBeFalsy();
      expect(JSON.parse(allowedWrite.content[0].text).name).toBe("reviewed");
    } finally {
      await elevated.close();
    }

    const scoped = await connectMcp({
      SDK_ANYTHING_ALLOWED_OPERATIONS: writeOp.id!,
    });
    try {
      const scopedWrite = (await scoped.callTool({
        name: writeOp.mcp,
        arguments: { input: { name: "scoped" } },
      })) as any;
      expect(scopedWrite.isError).toBeFalsy();
      expect(JSON.parse(scopedWrite.content[0].text).name).toBe("scoped");
    } finally {
      await scoped.close();
    }

    const destructive = await connectMcp({
      SDK_ANYTHING_ALLOW_DESTRUCTIVE: "true",
    });
    try {
      const allowedDelete = (await destructive.callTool({
        name: destructiveOp.mcp,
        arguments: { id: "item-1" },
      })) as any;
      expect(allowedDelete.isError).toBeFalsy();
      expect(JSON.parse(allowedDelete.content[0].text)).toEqual({
        deleted: true,
        id: "item-1",
      });
    } finally {
      await destructive.close();
    }

    const authFailure = await connectMcp({
      MOCK_CLIENT_SECRET_KEY: "wrong-bad-key",
    });
    try {
      const auth = (await authFailure.callTool({
        name: readOp.mcp,
        arguments: { query: { limit: 1 } },
      })) as any;
      expect(auth.isError).toBe(true);
      expect(auth.content[0].text).toContain("AUTH_REQUIRED");
      expect(auth.content[0].text).not.toContain("wrong-bad-key");
    } finally {
      await authFailure.close();
    }
  }, 120000);
});
