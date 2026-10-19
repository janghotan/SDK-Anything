export interface JSONSchemaProperty {
  type?: string;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  enum?: (string | number | boolean)[];
  const?: string | number | boolean;
  anyOf?: JSONSchemaProperty[];
  oneOf?: JSONSchemaProperty[];
  description?: string;
  default?: unknown;
  additionalProperties?: boolean;
}

export interface JSONSchemaObject {
  $schema?: string;
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
}

export interface SourceLocation {
  filePath: string;
  line: number;
  character: number;
}

export interface DiscoveredParameter {
  name: string;
  typeText: string;
  required: boolean;
  schema?: JSONSchemaProperty;
  description?: string;
}

export interface TypeSummary {
  typeText: string;
  isAsync: boolean;
  unwrappedType?: string;
}

export interface DiscoveredFunction {
  id: string;
  name: string;
  exportName: string;
  modulePath: string;
  isAsync: boolean;
  description?: string;
  jsDoc?: string;
  parameters: DiscoveredParameter[];
  returnType: TypeSummary;
  inputSchema: JSONSchemaObject;
  outputSchema?: JSONSchemaProperty;
  sourceLocation: SourceLocation;
  confidence: "high" | "medium" | "low";
}

export interface DiscoveredMethod {
  id: string;
  name: string;
  receiver: string;
  isAsync: boolean;
  description?: string;
  jsDoc?: string;
  parameters: DiscoveredParameter[];
  returnType: TypeSummary;
  inputSchema: JSONSchemaObject;
  outputSchema?: JSONSchemaProperty;
  sourceLocation: SourceLocation;
  confidence: "high" | "medium" | "low";
}

export interface DiscoveredClass {
  id: string;
  name: string;
  exportName: string;
  modulePath: string;
  description?: string;
  jsDoc?: string;
  constructorParameters: DiscoveredParameter[];
  methods: DiscoveredMethod[];
  sourceLocation: SourceLocation;
}

export interface DiscoveredFactory {
  id: string;
  name: string;
  exportName: string;
  modulePath: string;
  description?: string;
  jsDoc?: string;
  parameters: DiscoveredParameter[];
  returnsClient: string;
  methods: DiscoveredMethod[];
  sourceLocation: SourceLocation;
}

export interface UnresolvedSymbol {
  symbolName: string;
  sourceLocation: SourceLocation;
  reason: string;
  suggestedAction: string;
}

export interface DocumentationSummary {
  hasReadme: boolean;
  readmePath?: string;
  readmeSnippet?: string;
  discoveredExamples: string[];
}

export interface EvidenceInventory {
  source: {
    kind: string;
    identifier: string;
    packageName?: string;
    version: string;
    revision?: string;
    digest: string;
  };
  entryPoint: string;
  functions: DiscoveredFunction[];
  classes: DiscoveredClass[];
  factories: DiscoveredFactory[];
  unresolved: UnresolvedSymbol[];
  documentation: DocumentationSummary;
}
