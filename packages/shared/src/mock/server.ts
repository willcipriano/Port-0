import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  MVP_SUBNET_PREFIX,
  MVP_ZONE_ID,
  MVP_SUBNET_ID,
} from '../constants/ipv6.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapiPath = join(__dirname, '../../openapi.yaml');

const port = Number(process.env.MOCK_PORT ?? 3099);

const mockAccount = {
  id: '00000000-0000-4000-8000-000000000001',
  displayHandle: 'ghost_operator',
  cryptoBalance: 500,
  rigStats: { cpu: 4, ram: 8, storage: 100, bandwidth: 1 },
  status: 'active',
};

function json(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/health') {
    return json(res, 200, { status: 'ok', service: 'mock-api' });
  }

  if (req.method === 'GET' && path === '/openapi.yaml') {
    res.writeHead(200, { 'Content-Type': 'application/yaml' });
    res.end(readFileSync(openapiPath, 'utf8'));
    return;
  }

  if (req.method === 'GET' && path === '/auth/me') {
    return json(res, 200, mockAccount);
  }

  if (req.method === 'GET' && path === '/world/subnet') {
    return json(res, 200, {
      subnet: {
        zoneId: MVP_ZONE_ID,
        zoneName: 'Shady Hollow',
        subnetId: MVP_SUBNET_ID,
        prefix: `${MVP_SUBNET_PREFIX}/64`,
        machineCount: 300,
        landmarkCount: 3,
        theme: 'residential_mixed_shady',
      },
      heatLevel: 0,
    });
  }

  if (req.method === 'GET' && path.startsWith('/machines/')) {
    const ipv6 = decodeURIComponent(path.slice('/machines/'.length));
    return json(res, 200, {
      ipv6,
      osArchetypeId: 'cheap_server',
      securitySummary: 'L1 mixed',
      isLandmark: ipv6.endsWith('::1'),
    });
  }

  if (req.method === 'POST' && path === '/scans') {
    return json(res, 201, {
      id: 'scan-mock-001',
      status: 'queued',
      queuedAt: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && path.startsWith('/scans/')) {
    return json(res, 200, {
      id: path.slice('/scans/'.length),
      status: 'complete',
      results: ['2001:db8:1:7::a1', '2001:db8:1:7::b2'],
    });
  }

  if (req.method === 'GET' && path === '/fleet') {
    return json(res, 200, { machines: [] });
  }

  if (req.method === 'GET' && path === '/market') {
    return json(res, 200, {
      items: [
        { toolId: 'scanner_l1', price: 50 },
        { toolId: 'cracker_l1', price: 75 },
      ],
    });
  }

  json(res, 404, { error: 'not_found', path });
});

server.listen(port, () => {
  console.log(`Port 0 mock API listening on http://localhost:${port}`);
  console.log(`  OpenAPI spec: http://localhost:${port}/openapi.yaml`);
});
