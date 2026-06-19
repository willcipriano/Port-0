import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { currentTickId, runMigrations, runTick, seedDatabase } from '@port0/db';
import { logError, logInfo } from '@port0/shared';

const app = new Hono();
let lastScheduledTickId: number | null = null;

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'tick-worker',
    checks: {
      database: process.env.DATABASE_URL ? 'configured' : 'missing',
      tickIntervalMinutes: String(process.env.TICK_INTERVAL_MINUTES ?? 15),
      scheduler: 'active',
      lastTickId: lastScheduledTickId,
    },
  }),
);

app.post('/tick/trigger', async (c) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MANUAL_TICK !== 'true') {
    return c.json({ error: 'forbidden', message: 'Manual tick trigger disabled' }, 403);
  }
  const tickId = currentTickId();
  const result = await runTick(tickId);
  return c.json(result);
});

async function scheduleTick(): Promise<void> {
  const tickId = currentTickId();
  if (lastScheduledTickId === tickId) return;
  try {
    const result = await runTick(tickId);
    if (result.started) {
      logInfo('tick_completed', { tickId });
    }
    lastScheduledTickId = tickId;
  } catch (err) {
    logError('tick_failed', { tickId, message: err instanceof Error ? err.message : String(err) });
  }
}

const port = Number(process.env.TICK_WORKER_PORT ?? process.env.PORT ?? 3003);
const pollMs = 30_000;

async function bootstrap(): Promise<void> {
  await runMigrations();
  await seedDatabase();
  await scheduleTick();
  setInterval(() => {
    void scheduleTick();
  }, pollMs);

  serve({ fetch: app.fetch, port }, () => {
    logInfo('tick_worker_started', { port, pollMs });
  });
}

bootstrap().catch((err) => {
  logError('tick_worker_boot_failed', { message: err.message });
  process.exit(1);
});

export { app };
