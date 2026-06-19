import { startHealthServer } from '@port0/shared';

const port = Number(process.env.TICK_WORKER_PORT ?? process.env.PORT ?? 3003);
const tickMinutes = Number(process.env.TICK_INTERVAL_MINUTES ?? 15);

startHealthServer({
  name: 'tick-worker',
  port,
  extraChecks: async () => ({
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    tickIntervalMinutes: String(tickMinutes),
    scheduler: 'stub',
  }),
});

// Stage 4: 15-min tick loop — scans, economy, heat, sieges
