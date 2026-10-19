import type { EvidenceInventory } from '../analyzer/types.js';
import type {
  CapabilityManifest,
  ClientDescriptor,
  OperationDescriptor,
  OperationEffect,
  UnresolvedDescriptor,
} from './types.js';

export interface BuildManifestOptions {
  generatorVersion?: string;
}

export function buildManifest(
  evidence: EvidenceInventory,
  options: BuildManifestOptions = {}
): CapabilityManifest {
  const generatorVersion = options.generatorVersion ?? '0.1.0';

  // Build client descriptor if classes or factories exist
  let client: ClientDescriptor | undefined;
  if (evidence.classes.length > 0) {
    const primaryClass = evidence.classes[0];
    const clientOptions: Record<string, any> = {};

    for (const param of primaryClass.constructorParameters) {
      if (param.schema && param.schema.type === 'object' && param.schema.properties) {
        for (const [propName, propSchema] of Object.entries(param.schema.properties)) {
          const isSecret = isLikelySecret(propName);
          const envVarName = toEnvVarName(evidence.source.identifier, propName);
          clientOptions[propName] = {
            type: isSecret ? 'secret' : (propSchema.type ?? 'string'),
            source: isSecret ? `env:${envVarName}` : undefined,
            required: param.schema.required?.includes(propName) ?? false,
            description: propSchema.description,
          };
        }
      } else {
        const isSecret = isLikelySecret(param.name);
        const envVarName = toEnvVarName(evidence.source.identifier, param.name);
        clientOptions[param.name] = {
          type: isSecret ? 'secret' : 'string',
          source: isSecret ? `env:${envVarName}` : undefined,
          required: param.required,
          description: param.description,
        };
      }
    }

    client = {
      module: evidence.source.identifier,
      export: primaryClass.exportName,
      construction: 'class',
      options: clientOptions,
    };
  } else if (evidence.factories.length > 0) {
    const primaryFactory = evidence.factories[0];
    const clientOptions: Record<string, any> = {};

    for (const param of primaryFactory.parameters) {
      if (param.schema && param.schema.type === 'object' && param.schema.properties) {
        for (const [propName, propSchema] of Object.entries(param.schema.properties)) {
          const isSecret = isLikelySecret(propName);
          const envVarName = toEnvVarName(evidence.source.identifier, propName);
          clientOptions[propName] = {
            type: isSecret ? 'secret' : (propSchema.type ?? 'string'),
            source: isSecret ? `env:${envVarName}` : undefined,
            required: param.schema.required?.includes(propName) ?? false,
            description: propSchema.description,
          };
        }
      } else {
        const isSecret = isLikelySecret(param.name);
        const envVarName = toEnvVarName(evidence.source.identifier, param.name);
        clientOptions[param.name] = {
          type: isSecret ? 'secret' : 'string',
          source: isSecret ? `env:${envVarName}` : undefined,
          required: param.required,
          description: param.description,
        };
      }
    }

    client = {
      module: evidence.source.identifier,
      export: primaryFactory.exportName,
      construction: 'factory',
      options: clientOptions,
    };
  }

  // Build operations from top-level functions
  const operations: OperationDescriptor[] = [];

  for (const fn of evidence.functions) {
    const effect: OperationEffect = inferFunctionEffect(fn.name);
    const enabledByDefault = effect === 'pure' || effect === 'read';

    operations.push({
      id: fn.id,
      name: fn.name,
      summary: extractSummary(fn.description, fn.name),
      description: fn.description || `Call ${fn.name}`,
      invoke: {
        kind: 'top-level-function',
        functionName: fn.name,
      },
      inputSchema: fn.inputSchema,
      outputSchema: fn.outputSchema,
      effect,
      enabledByDefault,
      result: { mode: 'direct' },
      provenance: {
        sourceFile: fn.sourceLocation.filePath,
        confidence: fn.confidence,
      },
    });
  }

  // Build operations from class instance methods
  if (evidence.classes.length > 0) {
    for (const cls of evidence.classes) {
      for (const method of cls.methods) {
        const effect: OperationEffect = inferMethodEffect(method.name);
        const enabledByDefault = effect === 'pure' || effect === 'read';
        const isPaginated = method.name.startsWith('list') || method.name.startsWith('search');

        operations.push({
          id: method.id,
          name: method.name,
          summary: extractSummary(method.description, method.name),
          description: method.description || `Execute ${cls.name}.${method.name}`,
          invoke: {
            kind: 'instance-method',
            receiver: cls.name,
            method: method.name,
          },
          inputSchema: method.inputSchema,
          outputSchema: method.outputSchema,
          effect,
          enabledByDefault,
          result: {
            mode: isPaginated ? 'paginated' : 'direct',
            pagination: isPaginated
              ? {
                  type: 'cursor',
                  cursorParam: 'cursor',
                  responseItemsField: 'items',
                  responseNextCursorField: 'nextCursor',
                  maxItems: 100,
                  maxBytes: 1048576, // 1MB default cap
                }
              : undefined,
          },
          provenance: {
            sourceFile: method.sourceLocation.filePath,
            confidence: method.confidence,
          },
        });
      }
    }
  }

  // Map unresolved
  const unresolved: UnresolvedDescriptor[] = evidence.unresolved.map(u => ({
    id: u.symbolName,
    reason: u.reason,
    suggestedAction: u.suggestedAction,
  }));

  // Sort operations by ID deterministically
  operations.sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: 'sdk-anything/manifest/v1',
    generatorVersion,
    source: {
      kind: evidence.source.kind as any,
      package: evidence.source.identifier,
      version: evidence.source.version,
      revision: evidence.source.revision,
      digest: evidence.source.digest,
    },
    client,
    operations,
    unresolved,
  };
}

function inferFunctionEffect(name: string): OperationEffect {
  const lower = name.toLowerCase();
  if (
    lower.startsWith('calculate') ||
    lower.startsWith('compute') ||
    lower.startsWith('format') ||
    lower.startsWith('distance') ||
    lower.startsWith('area') ||
    lower.startsWith('is') ||
    lower.startsWith('has') ||
    lower.startsWith('parse')
  ) {
    return 'pure';
  }
  return inferMethodEffect(name);
}

function inferMethodEffect(name: string): OperationEffect {
  const lower = name.toLowerCase();
  if (
    lower.startsWith('get') ||
    lower.startsWith('list') ||
    lower.startsWith('find') ||
    lower.startsWith('search') ||
    lower.startsWith('fetch') ||
    lower.startsWith('read') ||
    lower.startsWith('describe')
  ) {
    return 'read';
  }
  if (
    lower.startsWith('delete') ||
    lower.startsWith('remove') ||
    lower.startsWith('destroy') ||
    lower.startsWith('drop') ||
    lower.startsWith('purge')
  ) {
    return 'destructive';
  }
  if (
    lower.startsWith('create') ||
    lower.startsWith('add') ||
    lower.startsWith('update') ||
    lower.startsWith('set') ||
    lower.startsWith('put') ||
    lower.startsWith('post') ||
    lower.startsWith('insert') ||
    lower.startsWith('write')
  ) {
    return 'write';
  }
  return 'unknown';
}

function isLikelySecret(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('key') ||
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('auth') ||
    lower.includes('password') ||
    lower.includes('credential')
  );
}

function toEnvVarName(pkgIdentifier: string, optionName: string): string {
  const cleanPkg = pkgIdentifier.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const cleanOpt = optionName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  return `${cleanPkg}_${cleanOpt}`;
}

function extractSummary(desc?: string, fallback = ''): string {
  if (!desc) return fallback;
  const firstSentence = desc.split(/[.\n]/)[0].trim();
  return firstSentence.length > 0 ? firstSentence : fallback;
}
