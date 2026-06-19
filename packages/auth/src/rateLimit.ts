const hits = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export async function rateLimitMiddleware(c: import('hono').Context, next: import('hono').Next) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    await next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    return c.json({ error: 'rate_limited', message: 'Too many auth requests' }, 429);
  }

  entry.count += 1;
  await next();
}
