import { createHash, randomBytes } from 'node:crypto';
import * as jose from 'jose';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessClaims {
  sub: string;
  typ: 'access';
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change-me-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
  }
  return new TextEncoder().encode(secret ?? 'dev-secret');
}

export async function signAccessToken(accountId: string): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
  const token = await new jose.SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getSecret());
  return { token, expiresIn };
}

export async function signRefreshToken(accountId: string): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800);
  const token = await new jose.SignJWT({ typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(accountId)
    .setJti(randomBytes(16).toString('hex'))
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getSecret());
  return { token, expiresIn };
}

export async function issueTokenPair(accountId: string): Promise<TokenPair> {
  const access = await signAccessToken(accountId);
  const refresh = await signRefreshToken(accountId);
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresIn: access.expiresIn,
  };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return { sub: payload.sub, typ: 'access' };
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string; jti?: string }> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  if (payload.typ !== 'refresh' || typeof payload.sub !== 'string') {
    throw new Error('Invalid refresh token');
  }
  return { sub: payload.sub, jti: typeof payload.jti === 'string' ? payload.jti : undefined };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const DEV_BYPASS_PREFIX = 'dev:';

export function isDevBypassEnabled(): boolean {
  return process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
}

export function parseDevBypassToken(token: string): string | null {
  if (!isDevBypassEnabled()) return null;
  if (!token.startsWith(DEV_BYPASS_PREFIX)) return null;
  const accountKey = token.slice(DEV_BYPASS_PREFIX.length).trim();
  return accountKey || '00000000-0000-4000-8000-000000000001';
}
