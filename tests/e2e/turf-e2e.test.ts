import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { resolveSource } from '../../src/source/index.js';
import { analyzeSourceSnapshot } from '../../src/analyzer/index.js';
import { buildManifest, validateManifest } from '../../src/manifest/index.js';
import { generateArtifacts } from '../../src/generators/index.js';
import { createMcpServer } from '../../src/generators/mcp/index.js';
import { createGeneratedCli } from '../../src/generators/cli/index.js';

describe('Turf End-to-End Golden Example', () => {
  const turfSourceDir = path.resolve('examples/turf');
  const outputDir = path.resolve('tmp/generated-turf-e2e');

  it('runs complete end-to-end pipeline: inspect -> generate -> MCP & CLI execution', async () => {
    // Clean output dir
    fs.rmSync(outputDir, { recursive: true, force: true });

    // 1. Static inspection without executing code
    const snapshot = await resolveSource(turfSourceDir);
    expect(snapshot.kind).toBe('local');
    expect(snapshot.version).toBe('7.2.0');
    expect(snapshot.digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    const evidence = await analyzeSourceSnapshot(snapshot);
    expect(evidence.functions.some(f => f.name === 'distance')).toBe(true);
    expect(evidence.functions.some(f => f.name === 'point')).toBe(true);

    const distanceFn = evidence.functions.find(f => f.name === 'distance')!;
    expect(distanceFn.inputSchema.properties).toHaveProperty('from');
    expect(distanceFn.inputSchema.properties).toHaveProperty('to');
    expect(distanceFn.inputSchema.properties).toHaveProperty('options');

    // 2. Build capability manifest
    const manifest = buildManifest(evidence);
    const val = validateManifest(manifest);
    expect(val.valid).toBe(true);

    const distOp = manifest.operations.find(o => o.id === 'distance')!;
    expect(distOp.effect).toBe('pure');
    expect(distOp.enabledByDefault).toBe(true);

    // 3. Generate MCP, CLI, and consumer SKILL.md
    const files = generateArtifacts(manifest, ['mcp', 'cli'], outputDir);
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(fs.existsSync(path.join(outputDir, 'capability-manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'mcp/server.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'cli/cli.ts'))).toBe(true);

    // 4. Test execution via official MCP client/server
    const turfModule = await import('../../examples/turf/src/index.js');
    const mcpServer = createMcpServer(manifest, { sdkModule: turfModule });
    const mcpClient = new Client({ name: 'test-turf-mcp-client', version: '0.1.0' }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      mcpServer.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);

    const toolList = await mcpClient.listTools();
    expect(toolList.tools.some(t => t.name === 'distance')).toBe(true);

    const mcpResult = (await mcpClient.callTool({
      name: 'distance',
      arguments: {
        from: [-75.343, 39.984],
        to: [-75.534, 39.123],
        options: { units: 'miles' },
      },
    })) as any;

    expect(mcpResult.isError).toBeFalsy();
    expect(mcpResult.content[0].text).toBe('60.37');
    await Promise.all([mcpClient.close(), mcpServer.close()]);

    // 5. Test execution via generated CLI
    let cliStdout = '';
    const cli = createGeneratedCli(manifest, {
      sdkModule: turfModule,
      writeOut: (str: string) => { cliStdout += str; },
      writeErr: () => {},
      exitOverride: true,
    });

    await cli.parseAsync([
      'node',
      'cli',
      'distance',
      '--input',
      JSON.stringify({
        from: [-75.343, 39.984],
        to: [-75.534, 39.123],
        options: { units: 'miles' },
      }),
      '--json',
    ]);

    const parsedCliResult = JSON.parse(cliStdout);
    expect(parsedCliResult).toBe(60.37);

    // 6. Verify consumer SKILL.md
    const skillContent = fs.readFileSync(path.join(outputDir, 'SKILL.md'), 'utf8');
    expect(skillContent).toContain('# @example/turf-sample Capability Skill');
    expect(skillContent).toContain('distance');
    expect(skillContent).toContain('pure');

    // Clean up
    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
