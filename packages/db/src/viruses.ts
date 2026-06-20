import { loadVirusBalance } from '@port0/shared';
import type { PoolClient } from 'pg';
import { getPool } from './pool.js';

export interface VirusItem {
  id: string;
  effectType: string;
  level: number;
  usesRemaining: number;
  createdAt: string;
}

export interface VirusCraftJob {
  id: string;
  effectType: string;
  level: number;
  startedAt: string;
  finishesAt: string;
  completed: boolean;
}

export class VirusError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VirusError';
  }
}

export async function getVirusById(virusId: string, accountId: string): Promise<VirusItem | null> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    effect_type: string;
    level: number;
    uses_remaining: number;
    created_at: Date;
  }>(
    `SELECT id, effect_type, level, uses_remaining, created_at
     FROM virus_inventory
     WHERE id = $1 AND account_id = $2`,
    [virusId, accountId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    effectType: row.effect_type,
    level: row.level,
    usesRemaining: row.uses_remaining,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listVirusInventory(accountId: string): Promise<VirusItem[]> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    effect_type: string;
    level: number;
    uses_remaining: number;
    created_at: Date;
  }>(
    `SELECT id, effect_type, level, uses_remaining, created_at
     FROM virus_inventory
     WHERE account_id = $1 AND uses_remaining > 0
     ORDER BY created_at DESC`,
    [accountId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    effectType: row.effect_type,
    level: row.level,
    usesRemaining: row.uses_remaining,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function listActiveCraftJobs(accountId: string): Promise<VirusCraftJob[]> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    effect_type: string;
    level: number;
    started_at: Date;
    finishes_at: Date;
    completed: boolean;
  }>(
    `SELECT id, effect_type, level, started_at, finishes_at, completed
     FROM virus_craft_jobs
     WHERE account_id = $1 AND NOT completed
     ORDER BY finishes_at ASC`,
    [accountId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    effectType: row.effect_type,
    level: row.level,
    startedAt: row.started_at.toISOString(),
    finishesAt: row.finishes_at.toISOString(),
    completed: row.completed,
  }));
}

async function hasSourceCodeLoot(accountId: string, effectType: string): Promise<boolean> {
  const pool = getPool();
  const family = effectType.replace('_', '-');
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM rig_loot
       WHERE account_id = $1 AND loot_type = 'source_code'
         AND (label ILIKE $2 OR label ILIKE $3)
     ) AS exists`,
    [accountId, `%${effectType}%`, `%${family}%`],
  );
  return result.rows[0]?.exists ?? false;
}

export async function startVirusCraft(
  accountId: string,
  effectType: string,
  level: number,
): Promise<{ jobId: string; finishesAt: string }> {
  if (effectType !== 'storage_damage') {
    throw new VirusError('unsupported_effect', 'Only storage_damage virus is implemented at MVP');
  }
  if (level < 1 || level > 3) {
    throw new VirusError('invalid_level', 'Virus level must be 1-3');
  }

  const balance = loadVirusBalance();
  let craftMinutes = balance.craftMinutes * level;
  if (await hasSourceCodeLoot(accountId, effectType)) {
    craftMinutes *= balance.sourceCodeCraftTimeMultiplier;
  }
  const finishesAt = new Date(Date.now() + craftMinutes * 60 * 1000);

  const pool = getPool();
  const result = await pool.query<{ id: string; finishes_at: Date }>(
    `INSERT INTO virus_craft_jobs (account_id, effect_type, level, finishes_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, finishes_at`,
    [accountId, effectType, level, finishesAt],
  );
  const row = result.rows[0]!;
  return { jobId: row.id, finishesAt: row.finishes_at.toISOString() };
}

export async function completeVirusCrafts(client: PoolClient): Promise<number> {
  const balance = loadVirusBalance();
  const due = await client.query<{
    id: string;
    account_id: string;
    effect_type: string;
    level: number;
  }>(
    `SELECT id, account_id, effect_type, level
     FROM virus_craft_jobs
     WHERE NOT completed AND finishes_at <= NOW()
     FOR UPDATE`,
  );

  for (const job of due.rows) {
    await client.query(
      `INSERT INTO virus_inventory (account_id, effect_type, level, uses_remaining)
       VALUES ($1, $2, $3, $4)`,
      [job.account_id, job.effect_type, job.level, balance.uses],
    );
    await client.query(`UPDATE virus_craft_jobs SET completed = true WHERE id = $1`, [job.id]);
  }
  return due.rowCount ?? 0;
}

export async function consumeVirusUse(
  client: PoolClient,
  virusId: string,
  accountId: string,
): Promise<void> {
  const result = await client.query<{ uses_remaining: number }>(
    `UPDATE virus_inventory
     SET uses_remaining = uses_remaining - 1
     WHERE id = $1 AND account_id = $2 AND uses_remaining > 0
     RETURNING uses_remaining`,
    [virusId, accountId],
  );
  if (!result.rowCount) {
    throw new VirusError('virus_depleted', 'Virus has no uses remaining');
  }
}
