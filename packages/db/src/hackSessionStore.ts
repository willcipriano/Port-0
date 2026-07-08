import { randomUUID } from 'node:crypto';
import type { HackSessionState } from '@port0/shared';
import { connectRedis, hackSessionKey } from './redis.js';

const SESSION_TTL_SECONDS = 60 * 60 * 2;

function accountSessionKey(accountId: string): string {
  return `account:${accountId}:active_hack`;
}

export async function saveHackSession(session: HackSessionState): Promise<void> {
  const redis = await connectRedis();
  const key = hackSessionKey(session.id);
  await redis.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
  await redis.set(accountSessionKey(session.accountId), session.id, 'EX', SESSION_TTL_SECONDS);
}

export async function loadHackSession(sessionId: string): Promise<HackSessionState | null> {
  const redis = await connectRedis();
  const raw = await redis.get(hackSessionKey(sessionId));
  if (!raw) return null;
  return JSON.parse(raw) as HackSessionState;
}

export async function deleteHackSession(session: HackSessionState): Promise<void> {
  const redis = await connectRedis();
  await redis.del(hackSessionKey(session.id));
  const active = await redis.get(accountSessionKey(session.accountId));
  if (active === session.id) {
    await redis.del(accountSessionKey(session.accountId));
  }
}

export async function getActiveSessionId(accountId: string): Promise<string | null> {
  const redis = await connectRedis();
  return redis.get(accountSessionKey(accountId));
}

export async function getActiveSession(accountId: string): Promise<HackSessionState | null> {
  const sessionId = await getActiveSessionId(accountId);
  if (!sessionId) return null;
  const session = await loadHackSession(sessionId);
  if (!session) {
    const redis = await connectRedis();
    await redis.del(accountSessionKey(accountId));
    return null;
  }
  return session;
}

export function createSessionId(): string {
  return randomUUID();
}
