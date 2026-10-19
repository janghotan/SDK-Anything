import { describe, it, expect, vi } from 'vitest';
import {
  invokeOperation,
  redactSecrets,
} from '../../src/runtime/index.js';
import type { CapabilityManifest } from '../../src/manifest/types.js';

describe('Shared Invocation Runtime and Policy Enforcement', () => {
  // Mock SDK module
  const mockSdkMethods = {
    pureCalculate: vi.fn((input: { a: number; b: number }) => input.a + input.b),
    getItems: vi.fn(async (input: { limit?: number }) => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i + 1}`, name: `Item ${i + 1}` }));
      return { items: items.slice(0, input.limit ?? 10), nextCursor: 'cursor-2' };
    }),
    deleteItem: vi.fn(async (input: { id: string }) => {
      return { deleted: true, id: input.id };
    }),
  };

  class MockClient {
    token: string;
    constructor(options: { token: string }) {
      if (!options?.token) {
        throw new Error('Authentication required: token missing');
      }
      this.token = options.token;
    }
    async list(input: any) {
      return mockSdkMethods.getItems(input);
    }
    async remove(input: any) {
      return mockSdkMethods.deleteItem(input);
    }
  }

  const mockModule = {
    pureCalculate: mockSdkMethods.pureCalculate,
    MockClient,
    createMockClient: (opts: any) => new MockClient(opts),
  };

  const testManifest: CapabilityManifest = {
    schemaVersion: 'sdk-anything/manifest/v1',
    generatorVersion: '0.1.0',
    source: {
      kind: 'local',
      package: 'mock-sdk',
      version: '1.0.0',
      digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    },
    client: {
      module: 'mock-sdk',
      export: 'MockClient',
      construction: 'class',
      options: {
        token: {
          type: 'secret',
          source: 'env:MOCK_SDK_TOKEN',
          required: true,
        },
      },
    },
    operations: [
      {
        id: 'calculate',
        name: 'pureCalculate',
        summary: 'Calculate',
        description: 'Pure calculation',
        invoke: { kind: 'top-level-function', functionName: 'pureCalculate' },
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
          },
          required: ['a', 'b'],
          additionalProperties: false,
        },
        effect: 'pure',
        enabledByDefault: true,
        result: { mode: 'direct' },
        provenance: { sourceFile: 'index.ts', confidence: 'high' },
      },
      {
        id: 'items.list',
        name: 'list',
        summary: 'List items',
        description: 'List items with pagination',
        invoke: { kind: 'instance-method', receiver: 'MockClient', method: 'list' },
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
          },
          additionalProperties: false,
        },
        effect: 'read',
        enabledByDefault: true,
        result: {
          mode: 'paginated',
          pagination: {
            type: 'cursor',
            cursorParam: 'cursor',
            responseItemsField: 'items',
            maxItems: 5,
            maxBytes: 1024,
          },
        },
        provenance: { sourceFile: 'index.ts', confidence: 'high' },
      },
      {
        id: 'items.delete',
        name: 'remove',
        summary: 'Delete item',
        description: 'Delete item by id',
        invoke: { kind: 'instance-method', receiver: 'MockClient', method: 'remove' },
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
          additionalProperties: false,
        },
        effect: 'destructive',
        enabledByDefault: false,
        result: { mode: 'direct' },
        provenance: { sourceFile: 'index.ts', confidence: 'high' },
      },
    ],
    unresolved: [],
  };

  it('invokes pure top-level function successfully with input validation', async () => {
    const res = await invokeOperation(testManifest, 'calculate', { a: 10, b: 20 }, { sdkModule: mockModule });
    expect(res.success).toBe(true);
    expect(res.data).toBe(30);
  });

  it('rejects invalid inputs before calling SDK method', async () => {
    mockSdkMethods.pureCalculate.mockClear();
    const res = await invokeOperation(testManifest, 'calculate', { a: 'invalid-string', b: 20 }, { sdkModule: mockModule });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('INVALID_INPUT');
    expect(mockSdkMethods.pureCalculate).not.toHaveBeenCalled();
  });

  it('blocks disabled destructive operations by default and does not invoke SDK', async () => {
    mockSdkMethods.deleteItem.mockClear();
    const res = await invokeOperation(
      testManifest,
      'items.delete',
      { id: '123' },
      {
        sdkModule: mockModule,
        env: { MOCK_SDK_TOKEN: 'secret-token-123' },
        allowedEffects: ['pure', 'read'], // destructive NOT allowed
      }
    );
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('POLICY_DENIED');
    expect(mockSdkMethods.deleteItem).not.toHaveBeenCalled();
  });

  it('allows destructive operations when explicitly authorized in allowedEffects', async () => {
    const res = await invokeOperation(
      testManifest,
      'items.delete',
      { id: '123' },
      {
        sdkModule: mockModule,
        env: { MOCK_SDK_TOKEN: 'secret-token-123' },
        allowedEffects: ['pure', 'read', 'destructive'],
      }
    );
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ deleted: true, id: '123' });
  });

  it('resolves credentials from environment references and redacts secrets from errors', async () => {
    const secret = 'super-secret-auth-token-456';
    // Test secret missing
    const resNoAuth = await invokeOperation(
      testManifest,
      'items.list',
      {},
      {
        sdkModule: mockModule,
        env: {}, // Missing MOCK_SDK_TOKEN
      }
    );
    expect(resNoAuth.success).toBe(false);
    expect(resNoAuth.error?.code).toBe('AUTH_REQUIRED');

    // Test secret redaction
    const redacted = redactSecrets(`Failed connecting with token ${secret}`, [secret]);
    expect(redacted).not.toContain(secret);
    expect(redacted).toContain('[REDACTED]');
  });

  it('enforces maximum item and byte pagination limits', async () => {
    const res = await invokeOperation(
      testManifest,
      'items.list',
      { limit: 20 },
      {
        sdkModule: mockModule,
        env: { MOCK_SDK_TOKEN: 'secret-token' },
      }
    );
    expect(res.success).toBe(true);
    const data = res.data as { items: any[] };
    expect(data.items.length).toBeLessThanOrEqual(5); // manifest cap is 5
    expect(res.truncated).toBe(true);
  });

  it('handles operation timeouts gracefully', async () => {
    const slowModule = {
      pureCalculate: () => new Promise(resolve => setTimeout(() => resolve(42), 200)),
    };
    const res = await invokeOperation(
      testManifest,
      'calculate',
      { a: 1, b: 2 },
      {
        sdkModule: slowModule,
        timeoutMs: 50, // Timeout after 50ms
      }
    );
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('TIMEOUT');
  });
});
