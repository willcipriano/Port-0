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

  if (req.method === 'GET' && path === '/world/nodes') {
    return json(res, 200, {
      nodes: [
        // Landmarks (fixed coords)
        { ipv6: '2001:db8:1:7::1', osArchetypeId: 'generic_linux',    isLandmark: true,  latitude:  40.71,  longitude:  -74.01 },
        { ipv6: '2001:db8:1:7::2', osArchetypeId: 'corp_workstation', isLandmark: true,  latitude:  51.51,  longitude:   -0.13 },
        { ipv6: '2001:db8:1:7::3', osArchetypeId: 'cheap_server',     isLandmark: true,  latitude:  35.69,  longitude:  139.69 },
        // Proc-gen sample (spread across continents)
        { ipv6: '2001:db8:1:7::a1', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  41.20,  longitude:  -73.80 },
        { ipv6: '2001:db8:1:7::a2', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  34.20,  longitude: -118.10 },
        { ipv6: '2001:db8:1:7::a3', osArchetypeId: 'generic_linux',   isLandmark: false, latitude:  52.10,  longitude:    4.70 },
        { ipv6: '2001:db8:1:7::a4', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  48.90,  longitude:    2.50 },
        { ipv6: '2001:db8:1:7::a5', osArchetypeId: 'generic_linux',   isLandmark: false, latitude: -23.30,  longitude:  -46.40 },
        { ipv6: '2001:db8:1:7::a6', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  25.30,  longitude:   55.50 },
        { ipv6: '2001:db8:1:7::a7', osArchetypeId: 'corp_workstation',isLandmark: false, latitude:   1.50,  longitude:  103.90 },
        { ipv6: '2001:db8:1:7::a8', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  37.60,  longitude:  126.80 },
        { ipv6: '2001:db8:1:7::a9', osArchetypeId: 'cheap_server',    isLandmark: false, latitude: -33.70,  longitude:  151.00 },
        { ipv6: '2001:db8:1:7::aa', osArchetypeId: 'generic_linux',   isLandmark: false, latitude: -26.40,  longitude:   28.20 },
        { ipv6: '2001:db8:1:7::ab', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  19.20,  longitude:   73.00 },
        { ipv6: '2001:db8:1:7::ac', osArchetypeId: 'mainframe',       isLandmark: false, latitude:  50.20,  longitude:    8.90 },
        { ipv6: '2001:db8:1:7::b1', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  43.80,  longitude:  -79.10 },
        { ipv6: '2001:db8:1:7::b2', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  31.40,  longitude:  121.30 },
        { ipv6: '2001:db8:1:7::b3', osArchetypeId: 'generic_linux',   isLandmark: false, latitude:  59.50,  longitude:   18.30 },
        { ipv6: '2001:db8:1:7::b4', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  30.20,  longitude:   31.40 },
        { ipv6: '2001:db8:1:7::b5', osArchetypeId: 'cheap_server',    isLandmark: false, latitude:  22.40,  longitude:  114.30 },
      ],
    });
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
