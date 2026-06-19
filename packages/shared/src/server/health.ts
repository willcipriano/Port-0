import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface ServiceConfig {
  name: string;
  port: number;
  extraChecks?: () => Promise<Record<string, string>>;
}

export function startHealthServer(config: ServiceConfig): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/health') {
      const checks = config.extraChecks ? await config.extraChecks() : {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: config.name,
          checks,
        }),
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  server.listen(config.port, () => {
    console.log(`${config.name} listening on port ${config.port}`);
  });
}
