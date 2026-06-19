import { startHealthServer } from '@port0/shared';

const port = Number(process.env.AUTH_PORT ?? process.env.PORT ?? 3001);

startHealthServer({
  name: 'auth',
  port,
  extraChecks: async () => ({
    oauth: 'stub',
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
  }),
});

// Stage 1: OAuth callback, refresh, /auth/me
