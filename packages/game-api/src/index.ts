import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  bearerAuthMiddleware,
  findAccountById,
  getAccountId,
  getAccountStatus,
  getDefaultSubnetId,
  getPool,
  runMigrations,
  seedDatabase,
  toAccountResponse,
} from '@port0/db';
import {
  ApiError,
  blockedReason,
  isActionBlocked,
  logError,
  logInfo,
  sanitizeError,
  type ActionCategory,
} from '@port0/shared';
import { createSessionWebSocketHandlers } from './sessionWs.js';

const app = new Hono();
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

app.use('*', cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173', credentials: true }));

app.get('/health', async (c) => {
  let database: string = process.env.DATABASE_URL ? 'configured' : 'missing';
  if (process.env.DATABASE_URL) {
    try {
      await getPool().query('SELECT 1');
      database = 'ok';
    } catch {
      database = 'error';
    }
  }
  return c.json({
    status: 'ok',
    service: 'game-api',
    version: process.env.npm_package_version ?? '0.0.1',
    checks: {
      database,
      redis: process.env.REDIS_URL ? 'configured' : 'missing',
      websocket: 'ready',
    },
  });
});

app.get('/version', (c) => c.json({ service: 'game-api', version: '0.0.1' }));

function requireAction(category: ActionCategory) {
  return async (c: import('hono').Context, next: import('hono').Next) => {
    const status = getAccountStatus(c);
    if (isActionBlocked(status, category)) {
      throw new ApiError(403, 'account_status_blocked', blockedReason(status, category), {
        status,
        action: category,
      });
    }
    await next();
  };
}

app.get('/me', bearerAuthMiddleware, async (c) => {
  const account = await findAccountById(getAccountId(c));
  if (!account) throw new ApiError(404, 'not_found', 'Account not found');
  return c.json(toAccountResponse(account));
});

app.get('/world/subnet', bearerAuthMiddleware, requireAction('read_only'), async (c) => {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, zone_id, zone_name, ipv6_prefix, theme, machine_count, landmark_count, heat_level
     FROM world_subnets LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'not_found', 'Subnet not seeded');
  return c.json({
    subnet: {
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      subnetId: row.id,
      prefix: row.ipv6_prefix,
      machineCount: row.machine_count,
      landmarkCount: row.landmark_count,
      theme: row.theme,
    },
    heatLevel: row.heat_level,
  });
});

const scanSchema = z.object({ subnetId: z.string().min(1) });

app.post('/scans', bearerAuthMiddleware, requireAction('scan'), zValidator('json', scanSchema), async (c) => {
  const body = c.req.valid('json');
  return c.json({
    id: `scan-${Date.now()}`,
    accountId: getAccountId(c),
    subnetId: body.subnetId,
    status: 'queued',
    queuedAt: new Date().toISOString(),
  }, 201);
});

app.post('/market/purchase', bearerAuthMiddleware, requireAction('market_buy'), async (c) => {
  throw new ApiError(501, 'not_implemented', 'Market purchases arrive in Stage 4');
});

app.get('/fleet', bearerAuthMiddleware, requireAction('fleet_mgmt'), async (c) => {
  return c.json({ machines: [] });
});

app.get(
  '/session',
  upgradeWebSocket(async (c) => {
    const token = c.req.query('token');
    if (!token) {
      return { onOpen: (_e, ws) => ws.close(4401, 'Missing token') };
    }
    let accountId: string;
    try {
      const { parseDevBypassToken, verifyAccessToken } = await import('@port0/shared');
      const { getOrCreateDevAccount, findAccountById: loadAccount } = await import('@port0/db');
      const devId = parseDevBypassToken(token);
      if (devId) {
        accountId = (await getOrCreateDevAccount(devId)).id;
      } else {
        accountId = (await verifyAccessToken(token)).sub;
      }
      const account = await loadAccount(accountId);
      if (!account) {
        return { onOpen: (_e, ws) => ws.close(4401, 'Invalid token') };
      }
      if (isActionBlocked(account.status, 'hack')) {
        return { onOpen: (_e, ws) => ws.close(4403, blockedReason(account.status, 'hack')) };
      }
      const subnetId = await getDefaultSubnetId();
      return createSessionWebSocketHandlers(account, subnetId);
    } catch {
      return { onOpen: (_e, ws) => ws.close(4401, 'Invalid token') };
    }
  }),
);

app.onError((err, c) => {
  const apiErr = sanitizeError(err);
  if (apiErr.status >= 500) {
    logError('game_api_request_failed', { message: err instanceof Error ? err.message : String(err) });
  }
  return c.json(apiErr.toJSON(), { status: apiErr.status as 400 });
});

const port = Number(process.env.GAME_API_PORT ?? process.env.PORT ?? 3002);

async function bootstrap(): Promise<void> {
  await runMigrations();
  await seedDatabase();
  const server = serve({ fetch: app.fetch, port }, () => {
    logInfo('game_api_started', { port });
  });
  injectWebSocket(server);
}

bootstrap().catch((err) => {
  logError('game_api_boot_failed', { message: err.message });
  process.exit(1);
});

export { app };
