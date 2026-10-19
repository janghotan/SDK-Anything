export interface ClientConfig {
  baseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface ListItemQuery {
  cursor?: string;
  limit?: number;
}

export interface Item {
  id: string;
  name: string;
  tag?: string;
}

export interface ListItemsResponse {
  items: Item[];
  nextCursor?: string;
}

export interface CreateItemInput {
  name: string;
  tag?: string;
}

export class TestApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: ClientConfig) {
    if (!config?.apiKey) {
      throw new Error('API key is required to construct TestApiClient');
    }
    this.baseUrl = config.baseUrl ?? 'http://127.0.0.1:8080';
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  async listItems(query?: ListItemQuery): Promise<ListItemsResponse> {
    const url = new URL('/v1/items', this.baseUrl);
    if (query?.cursor) url.searchParams.set('cursor', query.cursor);
    if (query?.limit) url.searchParams.set('limit', String(query.limit));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || `HTTP ${res.status}`);
    }

    return (await res.json()) as ListItemsResponse;
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    const url = new URL('/v1/items', this.baseUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || `HTTP ${res.status}`);
    }

    return (await res.json()) as Item;
  }

  async deleteItem(id: string): Promise<{ deleted: boolean; id: string }> {
    const url = new URL(`/v1/items/${encodeURIComponent(id)}`, this.baseUrl);
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || `HTTP ${res.status}`);
    }

    return (await res.json()) as { deleted: boolean; id: string };
  }
}

export function createTestApiClient(config: ClientConfig): TestApiClient {
  return new TestApiClient(config);
}
