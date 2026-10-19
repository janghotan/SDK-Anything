export interface AiClientConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface AiOperationProposal {
  operationId: string;
  summary?: string;
  description?: string;
  group?: string;
  examples?: Array<{
    name: string;
    input: Record<string, unknown>;
    explanation?: string;
  }>;
}

export interface AiProposalsResult {
  proposals: AiOperationProposal[];
  fallback: boolean;
  warnings: string[];
  disclosed: boolean;
}

export interface DisclosureNotice {
  disclosed: boolean;
  notice: string;
  snippets: string[];
}
