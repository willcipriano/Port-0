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
  getScan,
  getFleetResponse,
  listIntel,
  listMarketCatalog,
  listTickSummariesSince,
  listVirusInventory,
  listActiveCraftJobs,
  declareSiege,
  getSiege,
  applySiegeAction,
  MarketError,
  purchaseMarketItem,
  queueScan,
  runMigrations,
  ScanError,
  seedDatabase,
  sellLootItem,
  InventoryError,
  SiegeError,
  VirusError,
  startVirusCraft,
  toAccountResponse,
  toRigResponse,
  toScanResponse,
  updateFleetRole,
  FleetError,
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
import { createSiegeWebSocketHandlers } from './siegeWs.js';

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
  try {
    const scan = await queueScan(getAccountId(c), body.subnetId);
    return c.json(toScanResponse(scan), 201);
  } catch (err) {
    if (err instanceof ScanError) {
      throw new ApiError(400, err.code, err.message);
    }
    throw err;
  }
});

app.get('/scans/:id', bearerAuthMiddleware, requireAction('read_only'), async (c) => {
  const scan = await getScan(c.req.param('id'), getAccountId(c));
  if (!scan) throw new ApiError(404, 'not_found', 'Scan not found');
  return c.json(toScanResponse(scan));
});

app.get('/market', bearerAuthMiddleware, requireAction('read_only'), async (c) => {
  const items = await listMarketCatalog();
  return c.json({ items });
});

const purchaseSchema = z.object({ toolId: z.string().min(1) });

app.post(
  '/market/purchase',
  bearerAuthMiddleware,
  requireAction('market_buy'),
  zValidator('json', purchaseSchema),
  async (c) => {
    const body = c.req.valid('json');
    try {
      const result = await purchaseMarketItem(getAccountId(c), body.toolId);
      return c.json(result);
    } catch (err) {
      if (err instanceof MarketError) {
        const status = err.code === 'insufficient_funds' ? 402 : 400;
        throw new ApiError(status, err.code, err.message);
      }
      throw err;
    }
  },
);

app.get('/fleet', bearerAuthMiddleware, requireAction('fleet_mgmt'), async (c) => {
  const fleet = await getFleetResponse(getAccountId(c));
  return c.json(fleet);
});

app.get('/rig', bearerAuthMiddleware, requireAction('read_only'), async (c) => {
  const account = await findAccountById(getAccountId(c));
  if (!account) throw new ApiError(404, 'not_found', 'Account not found');
  return c.json(toRigResponse(account));
});

const fleetRoleSchema = z.object({
  role: z.enum(['staging', 'passive_income', 'defensive', 'owner']),
});

app.patch(
  '/fleet/:ipv6/role',
  bearerAuthMiddleware,
  requireAction('fleet_mgmt'),
  zValidator('json', fleetRoleSchema),
  async (c) => {
    const body = c.req.valid('json');
    try {
      const machine = await updateFleetRole(getAccountId(c), c.req.param('ipv6'), body.role);
      return c.json({ machine });
    } catch (err) {
      if (err instanceof FleetError) {
        throw new ApiError(404, err.code, err.message);
      }
      throw err;
    }
  },
);

app.get('/intel', bearerAuthMiddleware, requireAction('read_only'), async (c) => {
  const intel = await listIntel(getAccountId(c));
  return c.json({ intel });
});

const declareSiegeSchema = z.object({
  targetIpv6: z.string().min(1),
  committedCpu: z.number().int().min(0).optional(),
  committedRam: z.number().int().min(0).optional(),
  virusIds: z.array(z.string().uuid()).optional(),
});

app.post(
  '/sieges',
  bearerAuthMiddleware,
  requireAction('siege_attack'),
  zValidator('json', declareSiegeSchema),
  async (c) => {
    const body = c.req.valid('json');
    try {
      const siege = await declareSiege({
        attackerAccountId: getAccountId(c),
        targetIpv6: body.targetIpv6,
        committedCpu: body.committedCpu,
        committedRam: body.committedRam,
        virusIds: body.virusIds,
      });
      return c.json({ siege }, 201);
    } catch (err) {
      if (err instanceof SiegeError) {
        const status =
          err.code === 'recon_required' || err.code === 'own_target' || err.code === 'target_unowned'
            ? 400
            : err.code === 'target_not_found'
              ? 404
              : 400;
        throw new ApiError(status, err.code, err.message);
      }
      throw err;
    }
  },
);

app.get('/sieges/:id', bearerAuthMiddleware, requireAction('read_only'), async (c) => {
  const result = await getSiege(c.req.param('id'), getAccountId(c));
  if (!result) throw new ApiError(404, 'not_found', 'Siege not found');
  return c.json(result);
});

const siegeActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('deploy_virus'), virusId: z.string().uuid(), targetIpv6: z.string().optional() }),
  z.object({ type: z.literal('escalate') }),
  z.object({ type: z.literal('target_drone'), targetIpv6: z.string().min(1) }),
  z.object({ type: z.literal('countermeasure') }),
  z.object({ type: z.literal('isolate_node'), targetIpv6: z.string().min(1) }),
  z.object({ type: z.literal('defend_tool'), toolId: z.string().min(1) }),
]);

app.post(
  '/sieges/:id/actions',
  bearerAuthMiddleware,
  zValidator('json', siegeActionSchema),
  async (c) => {
    const body = c.req.valid('json');
    const category: ActionCategory =
      body.type === 'deploy_virus' || body.type === 'escalate' || body.type === 'target_drone'
        ? 'siege_attack'
        : 'read_only';
    const status = getAccountStatus(c);
    if (isActionBlocked(status, category)) {
      throw new ApiError(403, 'account_status_blocked', blockedReason(status, category));
    }
    try {
      const result = await applySiegeAction(c.req.param('id'), getAccountId(c), body);
      return c.json(result);
    } catch (err) {
      if (err instanceof SiegeError) {
        throw new ApiError(400, err.code, err.message);
      }
      throw err;
    }
  },
);

const craftVirusSchema = z.object({
  effectType: z.literal('storage_damage'),
  level: z.number().int().min(1).max(3),
});

app.post(
  '/viruses/craft',
  bearerAuthMiddleware,
  requireAction('siege_attack'),
  zValidator('json', craftVirusSchema),
  async (c) => {
    const body = c.req.valid('json');
    try {
      const job = await startVirusCraft(getAccountId(c), body.effectType, body.level);
      return c.json(job, 201);
    } catch (err) {
      if (err instanceof VirusError) {
        throw new ApiError(400, err.code, err.message);
      }
      throw err;
    }
  },
);

app.get('/viruses/inventory', bearerAuthMiddleware, requireAction('read_only'), async (c) => {
  const accountId = getAccountId(c);
  const [inventory, jobs] = await Promise.all([
    listVirusInventory(accountId),
    listActiveCraftJobs(accountId),
  ]);
  return c.json({ inventory, craftJobs: jobs });
});

const sellSchema = z.object({ lootId: z.string().uuid() });

app.post(
  '/inventory/sell',
  bearerAuthMiddleware,
  requireAction('market_buy'),
  zValidator('json', sellSchema),
  async (c) => {
    const body = c.req.valid('json');
    try {
      const result = await sellLootItem(getAccountId(c), body.lootId);
      return c.json(result);
    } catch (err) {
      if (err instanceof InventoryError) {
        throw new ApiError(404, err.code, err.message);
      }
      throw err;
    }
  },
);

app.get('/me/sync', bearerAuthMiddleware, async (c) => {
  const sinceTickRaw = c.req.query('sinceTick');
  const sinceTick = sinceTickRaw != null ? Number(sinceTickRaw) : undefined;
  const account = await findAccountById(getAccountId(c));
  if (!account) throw new ApiError(404, 'not_found', 'Account not found');
  const summaries = await listTickSummariesSince(
    account.id,
    sinceTick != null && !Number.isNaN(sinceTick) ? sinceTick : undefined,
  );
  return c.json({
    account: toAccountResponse(account),
    tickSummaries: summaries,
  });
});

app.get(
  '/siege',
  upgradeWebSocket(async (c) => {
    const token = c.req.query('token');
    const siegeId = c.req.query('siegeId');
    if (!token || !siegeId) {
      return { onOpen: (_e, ws) => ws.close(4400, 'Missing token or siegeId') };
    }
    try {
      const { parseDevBypassToken, verifyAccessToken } = await import('@port0/shared');
      const { getOrCreateDevAccount } = await import('@port0/db');
      const devId = parseDevBypassToken(token);
      let accountId: string;
      if (devId) {
        accountId = (await getOrCreateDevAccount(devId)).id;
      } else {
        accountId = (await verifyAccessToken(token)).sub;
      }
      return createSiegeWebSocketHandlers(siegeId, accountId);
    } catch {
      return { onOpen: (_e, ws) => ws.close(4401, 'Invalid token') };
    }
  }),
);

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
