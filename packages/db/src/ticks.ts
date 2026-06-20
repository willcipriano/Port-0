import { getPool } from './pool.js';
import { connectRedis, WORLD_TICK_CHANNEL, accountEventsChannel } from './redis.js';
import {
  TICK_STEPS,
  finalizeAccountSummaries,
  type AccountTickDelta,
  type TickStepContext,
} from './tickSteps.js';

export { currentTickId, TICK_INTERVAL_SECONDS } from './tickId.js';

export interface TickStepTiming {
  name: string;
  durationMs: number;
}

export interface TickRunResult {
  tickId: number;
  started: boolean;
  duplicate: boolean;
  stepTimings?: TickStepTiming[];
  accountsAffected?: number;
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

  const stepTimings: TickStepTiming[] = [];
  const accountDeltas = new Map<string, AccountTickDelta>();

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ctx: TickStepContext = { tickId, client, accountDeltas };

      for (const step of TICK_STEPS) {
        const start = performance.now();
        await step.run(ctx);
        stepTimings.push({ name: step.name, durationMs: Math.round(performance.now() - start) });
      }

      await finalizeAccountSummaries(ctx);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const redis = await connectRedis();
    const summaryPayload = {
      tickId,
      status: 'completed' as const,
      stepTimings,
      accountsAffected: accountDeltas.size,
    };
    await redis.publish(WORLD_TICK_CHANNEL, JSON.stringify(summaryPayload));

    for (const [accountId, delta] of accountDeltas) {
      await redis.publish(
        accountEventsChannel(accountId),
        JSON.stringify({ type: 'tick_applied', tickId, ...delta }),
      );
    }

    await pool.query(
      `UPDATE world_ticks SET status = 'completed', completed_at = NOW() WHERE tick_id = $1`,
      [tickId],
    );

    return {
      tickId,
      started: true,
      duplicate: false,
      stepTimings,
      accountsAffected: accountDeltas.size,
    };
  } catch (err) {
    await pool.query(
      `UPDATE world_ticks SET status = 'failed', completed_at = NOW() WHERE tick_id = $1`,
      [tickId],
    );
    throw err;
  }
}
