import * as http from 'node:http';

export interface MockServerInstance {
  server: http.Server;
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startMockServer(port = 0): Promise<MockServerInstance> {
  const items = Array.from({ length: 25 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
    tag: i % 2 === 0 ? 'even' : 'odd',
  }));

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const authHeader = req.headers.authorization;

    // Health check
    if (url.pathname === '/v1/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Auth verification
    if (!authHeader || !authHeader.startsWith('Bearer synthetic-secret-token')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized', message: 'Invalid or missing API key' }));
      return;
    }

    // Rate limiting simulation
    if (url.pathname === '/v1/rate-limited') {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'rate_limited', message: 'Too many requests' }));
      return;
    }

    // Slow endpoint
    if (url.pathname === '/v1/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ slow: true }));
      }, 500);
      return;
    }

    // Server error
    if (url.pathname === '/v1/error') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error', message: 'Internal server failure' }));
      return;
    }

    // List items (paginated)
    if (req.method === 'GET' && url.pathname === '/v1/items') {
      const cursor = parseInt(url.searchParams.get('cursor') ?? '0', 10);
      const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);

      const pageItems = items.slice(cursor, cursor + limit);
      const nextCursor = cursor + limit < items.length ? String(cursor + limit) : undefined;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ items: pageItems, nextCursor }));
      return;
    }

    // Create item
    if (req.method === 'POST' && url.pathname === '/v1/items') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const newItem = { id: `item-${Date.now()}`, name: parsed.name ?? 'Untitled', tag: parsed.tag };
          items.push(newItem);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newItem));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'bad_request' }));
        }
      });
      return;
    }

    // Delete item
    if (req.method === 'DELETE' && url.pathname.startsWith('/v1/items/')) {
      const id = url.pathname.replace('/v1/items/', '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ deleted: true, id }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found', message: 'Endpoint not found' }));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as any;
      const actualPort = addr.port;
      resolve({
        server,
        port: actualPort,
        baseUrl: `http://127.0.0.1:${actualPort}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
