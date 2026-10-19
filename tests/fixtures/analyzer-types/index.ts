export type Units = 'kilometers' | 'miles' | 'degrees';

export interface Point {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export interface ClientConfig {
  baseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface Item {
  id: string;
  name: string;
  tags?: string[];
}

export interface CircularNode {
  id: string;
  parent?: CircularNode;
}

/**
 * Calculate distance between two points.
 * @param from Starting coordinate point
 * @param to Ending coordinate point
 * @param units Measurement units
 */
export function calculateDistance(
  from: Point,
  to: Point,
  units?: Units
): number {
  return 42;
}

/**
 * Format coordinate input.
 */
export function formatCoordinate(coord: Point): string;
export function formatCoordinate(lat: number, lon: number): string;
export function formatCoordinate(a: Point | number, b?: number): string {
  return `${a}, ${b}`;
}

/**
 * Test client class with instance methods.
 */
export class RestClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  /**
   * List items from the API.
   */
  async listItems(query?: string, limit?: number): Promise<Item[]> {
    return [{ id: '1', name: 'Sample' }];
  }

  /**
   * Delete an item by ID.
   */
  async deleteItem(id: string): Promise<boolean> {
    return true;
  }
}

/**
 * Factory for creating a RestClient.
 */
export function createRestClient(config: ClientConfig): RestClient {
  return new RestClient(config);
}

/**
 * Unsupported operation with callback.
 */
export function listenEvents(onEvent: (event: string) => void): void {
  // Callback not supported for atomic tools
}

/**
 * Function with circular reference parameter.
 */
export function processNode(node: CircularNode): string {
  return node.id;
}
