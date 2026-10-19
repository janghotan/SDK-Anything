export interface ServiceOptions {
  endpoint?: string;
  timeoutMs?: number;
}

export interface ServiceClient {
  fetchStatus(): Promise<{ status: string }>;
  calculate(x: number, y: number): Promise<number>;
}

export function createServiceClient(options?: ServiceOptions): ServiceClient {
  const endpoint = options?.endpoint ?? "http://localhost:8000";
  return {
    async fetchStatus() {
      return { status: "online", endpoint } as any;
    },
    async calculate(x: number, y: number) {
      return x + y;
    },
  };
}
