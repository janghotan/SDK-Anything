import { describe, it, expect, vi } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CapabilityManifest } from '../../src/manifest/types.js';
import {
  generateMcpProject,
  createMcpServer,
  toMcpToolName,
} from '../../src/generators/mcp/index.js';

describe('MCP Server Generator', () => {
  const mockSdk = {
    add: vi.fn((input: { x: number; y: number }) => input.x + input.y),
    deleteRecord: vi.fn(() => ({ deleted: true })),
  };

  const sampleManifest: CapabilityManifest = {
    schemaVersion: 'sdk-anything/manifest/v1',
    generatorVersion: '0.1.0',
    source: {
      kind: 'npm',
      package: '@turf/turf',
      version: '7.2.0',
      digest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
    operations: [
      {
        id: 'math.add',
        name: 'add',
        summary: 'Add numbers',
        description: 'Add two numbers together',
        invoke: { kind: 'top-level-function', functionName: 'add' },
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
          additionalProperties: false,
        },
        effect: 'pure',
        enabledByDefault: true,
        result: { mode: 'direct' },
        provenance: { sourceFile: 'index.ts', confidence: 'high' },
      },
      {
        id: 'records.delete',
        name: 'deleteRecord',
        summary: 'Delete record',
        description: 'Delete a record by id',
        invoke: { kind: 'top-level-function', functionName: 'deleteRecord' },
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        effect: 'destructive',
        enabledByDefault: false, // DISABLED BY DEFAULT
        result: { mode: 'direct' },
        provenance: { sourceFile: 'index.ts', confidence: 'high' },
      },
    ],
    unresolved: [],
  };

  it('converts operation IDs to safe valid MCP tool names', () => {
    expect(toMcpToolName('math.add')).toBe('math_add');
    expect(toMcpToolName('items.list-all')).toBe('items_list_all');
  });

  it('generates readable and inspectable TypeScript MCP server project files', async () => {
    const files = generateMcpProject(sampleManifest);

    expect(files).toHaveProperty('server.ts');
    expect(files).toHaveProperty('package.json');
    expect(files).toHaveProperty('tsconfig.json');
    expect(files).toHaveProperty('capability-manifest.json');

    const serverCode = files['server.ts'];
    expect(serverCode).toContain('@modelcontextprotocol/sdk/server/index.js');
    expect(serverCode).toContain('StdioServerTransport');
    expect(serverCode).toContain('math_add');
    // Disabled operations must not be exposed in tool list
    expect(serverCode).not.toContain('records_delete');
    // Ensure no dynamic eval
    expect(serverCode).not.toContain('eval(');

    // Package.json dependencies
    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies).toHaveProperty('@modelcontextprotocol/sdk');
    expect(pkg.dependencies).toHaveProperty('@turf/turf');
  });

  it('runs generated MCP server via official in-memory SDK client', async () => {
    const server = createMcpServer(sampleManifest, { sdkModule: mockSdk });
    const client = new Client({ name: 'test-mcp-client', version: '0.1.0' }, { capabilities: {} });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    // 1. List tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);
    expect(toolNames).toContain('math_add');
    expect(toolNames).not.toContain('records_delete');

    // 2. Call tool successfully
    mockSdk.add.mockClear();
    const callRes = (await client.callTool({
      name: 'math_add',
      arguments: { x: 15, y: 25 },
    })) as any;
    expect(callRes.isError).toBeFalsy();
    expect(mockSdk.add).toHaveBeenCalledWith({ x: 15, y: 25 });
    expect(callRes.content[0].type).toBe('text');
    expect(callRes.content[0].text).toBe('40');

    // 3. Call tool with invalid input
    const invalidRes = (await client.callTool({
      name: 'math_add',
      arguments: { x: 'not-a-number', y: 25 },
    })) as any;
    expect(invalidRes.isError).toBe(true);
    expect(invalidRes.content[0].text).toContain('INVALID_INPUT');

    await Promise.all([client.close(), server.close()]);
  });
});
