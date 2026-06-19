import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  bearerAuthMiddleware,
  clearExpiredAccountStatus,
  createAccount,
  findAccountById,
  findAccountByOAuth,
  findValidRefreshSession,
  getAccountId,
  loadDefaultRigAndBalance,
  revokeRefreshSession,
  runMigrations,
  seedDatabase,
  storeRefreshSession,
  toAccountResponse,
} from '@port0/db';
import {
  ApiError,
  hashToken,
  issueTokenPair,
  logError,
  logInfo,
  sanitizeError,
  verifyRefreshToken,
} from '@port0/shared';
import { exchangeCode, getOAuthAuthorizeUrl } from './oauth.js';
import { rateLimitMiddleware } from './rateLimit.js';

const app = new Hono();

app.use('*', cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173', credentials: true }));
app.use('/auth/*', rateLimitMiddleware);

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'auth',
    checks: {
      database: process.env.DATABASE_URL ? 'configured' : 'missing',
    },
  }),
);

app.get('/auth/login/:provider', (c) => {
  const provider = c.req.param('provider');
  if (provider !== 'github' && provider !== 'google') {
    throw new ApiError(400, 'invalid_provider', 'Provider must be github or google');
  }
  const redirectUri = c.req.query('redirect_uri') ?? process.env.OAUTH_REDIRECT_URI;
  if (!redirectUri) {
    throw new ApiError(400, 'missing_redirect_uri', 'redirect_uri is required');
  }
  const state = randomBytes(16).toString('hex');
  const url = getOAuthAuthorizeUrl(provider, redirectUri, state);
  return c.json({ url, state });
});

const callbackSchema = z.object({
  provider: z.enum(['github', 'google']),
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

app.post('/auth/callback', zValidator('json', callbackSchema), async (c) => {
  const body = c.req.valid('json');
  const profile = await exchangeCode(body.provider, body.code, body.redirectUri);

  let account = await findAccountByOAuth(profile.provider, profile.sub);
  if (!account) {
    const defaults = loadDefaultRigAndBalance();
    account = await createAccount({
      oauthProvider: profile.provider,
      oauthSub: profile.sub,
      displayHandle: profile.displayHandle,
      cryptoBalance: defaults.starterCrypto,
      rigStats: defaults.rigStats,
    });
    logInfo('account_created', { accountId: account.id, provider: profile.provider });
  }

  await clearExpiredAccountStatus(account.id);
  account = (await findAccountById(account.id)) ?? account;

  const tokens = await issueTokenPair(account.id);
  const refreshExpires = new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800) * 1000);
  await storeRefreshSession(account.id, hashToken(tokens.refreshToken), refreshExpires);

  return c.json({
    ...tokens,
    account: toAccountResponse(account),
  });
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

app.post('/auth/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const claims = await verifyRefreshToken(refreshToken);
  const session = await findValidRefreshSession(hashToken(refreshToken));
  if (!session) {
    throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid or revoked');
  }

  await revokeRefreshSession(session.id);
  const tokens = await issueTokenPair(claims.sub);
  const refreshExpires = new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800) * 1000);
  await storeRefreshSession(claims.sub, hashToken(tokens.refreshToken), refreshExpires);
  return c.json(tokens);
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

app.post('/auth/logout', zValidator('json', logoutSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const session = await findValidRefreshSession(hashToken(refreshToken));
  if (session) {
    await revokeRefreshSession(session.id);
  }
  return c.json({ ok: true });
});

app.get('/auth/me', bearerAuthMiddleware, async (c) => {
  const accountId = getAccountId(c);
  const account = await findAccountById(accountId);
  if (!account) {
    throw new ApiError(404, 'not_found', 'Account not found');
  }
  return c.json(toAccountResponse(account));
});

app.onError((err, c) => {
  const apiErr = sanitizeError(err);
  if (apiErr.status >= 500) {
    logError('auth_request_failed', { message: err instanceof Error ? err.message : String(err) });
  }
  return c.json(apiErr.toJSON(), { status: apiErr.status as 400 });
});

const port = Number(process.env.AUTH_PORT ?? process.env.PORT ?? 3001);

async function bootstrap(): Promise<void> {
  await runMigrations();
  await seedDatabase();
  serve({ fetch: app.fetch, port }, () => {
    logInfo('auth_started', { port });
  });
}

bootstrap().catch((err) => {
  logError('auth_boot_failed', { message: err.message });
  process.exit(1);
});

export { app };
