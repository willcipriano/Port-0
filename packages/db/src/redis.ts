import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
  }
  return redis;
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedis();
  if (client.status === 'wait') {
    await client.connect();
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}

export function hackSessionKey(sessionId: string): string {
  return `hack:${sessionId}`;
}

export function accountEventsChannel(accountId: string): string {
  return `account:${accountId}:events`;
}

export const WORLD_TICK_CHANNEL = 'world:tick';
