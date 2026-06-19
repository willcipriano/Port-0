import type { Context, MiddlewareHandler, Next } from 'hono';
import type { AccountStatus } from '@port0/shared';
import { ApiError, parseDevBypassToken, verifyAccessToken } from '@port0/shared';
import { clearExpiredAccountStatus, findAccountById, getOrCreateDevAccount } from './accounts.js';

export type AuthVariables = {
  accountId: string;
  accountStatus: AccountStatus;
};

async function resolveAccountId(token: string): Promise<string> {
  const devId = parseDevBypassToken(token);
  if (devId) {
    const account = await getOrCreateDevAccount(devId);
    return account.id;
  }
  const claims = await verifyAccessToken(token);
  return claims.sub;
}

export const bearerAuthMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'unauthorized', 'Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const accountId = await resolveAccountId(token);
    await clearExpiredAccountStatus(accountId);
    const account = await findAccountById(accountId);
    if (!account) {
      throw new ApiError(401, 'unauthorized', 'Account not found');
    }
    c.set('accountId', accountId);
    c.set('accountStatus', account.status);
    await next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'unauthorized', 'Invalid token');
  }
};

export function getAccountId(c: Context): string {
  return c.get('accountId') as string;
}

export function getAccountStatus(c: Context): AccountStatus {
  return c.get('accountStatus') as AccountStatus;
}
