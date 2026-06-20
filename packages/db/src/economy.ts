import type { PoolClient } from 'pg';
import { getPool } from './pool.js';

export interface EconomyTransaction {
  id: string;
  accountId: string;
  amount: number;
  reason: string;
  tickId: number | null;
  createdAt: string;
}

export async function creditAccount(
  client: PoolClient,
  accountId: string,
  amount: number,
  reason: string,
  tickId?: number,
): Promise<number> {
  if (amount === 0) {
    const row = await client.query<{ crypto_balance: number }>(
      'SELECT crypto_balance FROM accounts WHERE id = $1',
      [accountId],
    );
    return row.rows[0]?.crypto_balance ?? 0;
  }
  const updated = await client.query<{ crypto_balance: number }>(
    `UPDATE accounts SET crypto_balance = crypto_balance + $2 WHERE id = $1 RETURNING crypto_balance`,
    [accountId, amount],
  );
  await client.query(
    `INSERT INTO economy_transactions (account_id, amount, reason, tick_id)
     VALUES ($1, $2, $3, $4)`,
    [accountId, amount, reason, tickId ?? null],
  );
  return updated.rows[0]?.crypto_balance ?? 0;
}

export async function debitAccount(
  client: PoolClient,
  accountId: string,
  amount: number,
  reason: string,
  tickId?: number,
): Promise<number> {
  return creditAccount(client, accountId, -Math.abs(amount), reason, tickId);
}

export async function listTransactionsSince(
  accountId: string,
  since?: string,
  limit = 50,
): Promise<EconomyTransaction[]> {
  const pool = getPool();
  const result = since
    ? await pool.query<EconomyTransaction>(
        `SELECT id, account_id AS "accountId", amount, reason, tick_id AS "tickId", created_at AS "createdAt"
         FROM economy_transactions
         WHERE account_id = $1 AND created_at > $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [accountId, since, limit],
      )
    : await pool.query<EconomyTransaction>(
        `SELECT id, account_id AS "accountId", amount, reason, tick_id AS "tickId", created_at AS "createdAt"
         FROM economy_transactions
         WHERE account_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [accountId, limit],
      );
  return result.rows;
}

export async function saveAccountTickSummary(
  client: PoolClient,
  accountId: string,
  tickId: number,
  summary: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO account_tick_summaries (account_id, tick_id, summary)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (account_id, tick_id) DO UPDATE SET summary = EXCLUDED.summary`,
    [accountId, tickId, JSON.stringify(summary)],
  );
}

export async function listTickSummariesSince(
  accountId: string,
  sinceTick?: number,
): Promise<Array<{ tickId: number; summary: Record<string, unknown>; createdAt: string }>> {
  const pool = getPool();
  const result = sinceTick != null
    ? await pool.query<{ tick_id: number; summary: Record<string, unknown>; created_at: string }>(
        `SELECT tick_id, summary, created_at
         FROM account_tick_summaries
         WHERE account_id = $1 AND tick_id > $2
         ORDER BY tick_id ASC`,
        [accountId, sinceTick],
      )
    : await pool.query<{ tick_id: number; summary: Record<string, unknown>; created_at: string }>(
        `SELECT tick_id, summary, created_at
         FROM account_tick_summaries
         WHERE account_id = $1
         ORDER BY tick_id DESC
         LIMIT 20`,
        [accountId],
      );
  return result.rows.map((row) => ({
    tickId: Number(row.tick_id),
    summary: row.summary,
    createdAt: row.created_at,
  }));
}
