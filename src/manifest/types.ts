import type { JSONSchemaObject, JSONSchemaProperty } from '../analyzer/types.js';

export type OperationEffect = 'pure' | 'read' | 'write' | 'destructive' | 'unknown';

export interface ClientOptionDescriptor {
  type: string;
  source?: string; // e.g. "env:API_KEY"
  required: boolean;
  description?: string;
}

export interface ClientDescriptor {
  module: string;
  export: string;
  construction: 'none' | 'class' | 'factory';
  options: Record<string, ClientOptionDescriptor>;
}

export interface PaginationDescriptor {
  type: 'cursor' | 'page' | 'offset';
  cursorParam?: string;
  responseItemsField?: string;
  responseNextCursorField?: string;
  maxItems?: number;
  maxBytes?: number;
}

export interface OperationResultDescriptor {
  mode: 'direct' | 'paginated';
  pagination?: PaginationDescriptor;
}

export interface OperationInvokeDescriptor {
  kind: 'top-level-function' | 'instance-method';
  functionName?: string;
  receiver?: string;
  method?: string;
}

export interface OperationProvenance {
  sourceFile: string;
  confidence: 'high' | 'medium' | 'low';
  overridesApplied?: string[];
}

export interface OperationDescriptor {
  id: string;
  name: string;
  summary: string;
  description: string;
  invoke: OperationInvokeDescriptor;
  inputSchema: JSONSchemaObject;
  outputSchema?: JSONSchemaProperty;
  effect: OperationEffect;
  enabledByDefault: boolean;
  result: OperationResultDescriptor;
  provenance: OperationProvenance;
}

export interface UnresolvedDescriptor {
  id: string;
  reason: string;
  suggestedAction: string;
}

export interface ManifestSourceDescriptor {
  kind: 'npm' | 'local' | 'github';
  package: string;
  version: string;
  revision?: string;
  digest: string;
}

export interface CapabilityManifest {
  schemaVersion: 'sdk-anything/manifest/v1';
  generatorVersion: string;
  source: ManifestSourceDescriptor;
  client?: ClientDescriptor;
  operations: OperationDescriptor[];
  unresolved: UnresolvedDescriptor[];
  overrides?: Record<string, unknown>;
}

export interface OperationOverride {
  enabledByDefault?: boolean;
  effect?: OperationEffect;
  inputSchema?: JSONSchemaObject;
  summary?: string;
  description?: string;
  pagination?: PaginationDescriptor;
}

export interface ClientOverride {
  construction?: 'none' | 'class' | 'factory';
  export?: string;
  options?: Record<string, Partial<ClientOptionDescriptor>>;
}

export interface SdkAnythingOverrides {
  schemaVersion: 'sdk-anything/overrides/v1';
  client?: ClientOverride;
  operations?: Record<string, OperationOverride>;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}
