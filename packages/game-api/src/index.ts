import { startHealthServer } from '@port0/shared';

const port = Number(process.env.GAME_API_PORT ?? process.env.PORT ?? 3002);

startHealthServer({
  name: 'game-api',
  port,
  extraChecks: async () => ({
    redis: process.env.REDIS_URL ? 'configured' : 'missing',
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    websocket: 'stub',
  }),
});

// Stage 3: hack sessions, WS /session, world/scan/fleet/market routes
