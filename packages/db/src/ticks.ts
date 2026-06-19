import { getPool } from './pool.js';
import { connectRedis, WORLD_TICK_CHANNEL } from './redis.js';

export const TICK_INTERVAL_SECONDS = Number(process.env.TICK_INTERVAL_MINUTES ?? 15) * 60;

export function currentTickId(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TICK_INTERVAL_SECONDS);
}

export interface TickRunResult {
  tickId: number;
  started: boolean;
  duplicate: boolean;
}

export async function runTick(tickId: number): Promise<TickRunResult> {
  const pool = getPool();
  const insert = await pool.query(
    `INSERT INTO world_ticks (tick_id, status)
     VALUES ($1, 'running')
     ON CONFLICT (tick_id) DO NOTHING
     RETURNING tick_id`,
    [tickId],
  );

  if (!insert.rowCount) {
    return { tickId, started: false, duplicate: true };
  }

  try {
    const redis = await connectRedis();
    await redis.publish(WORLD_TICK_CHANNEL, JSON.stringify({ tickId, status: 'completed' }));

    await pool.query(
      `UPDATE world_ticks SET status = 'completed', completed_at = NOW() WHERE tick_id = $1`,
      [tickId],
    );
    return { tickId, started: true, duplicate: false };
  } catch (err) {
    await pool.query(
      `UPDATE world_ticks SET status = 'failed', completed_at = NOW() WHERE tick_id = $1`,
      [tickId],
    );
    throw err;
  }
}
