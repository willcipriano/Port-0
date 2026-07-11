import type { PoolClient } from 'pg';
import { getPool } from './pool.js';
import {
  backfillToolsFromRigTools,
  ensureDefaultTree,
  installToolFile,
  listInstalledToolIdsFromFs,
  removeToolFiles,
} from './userFilesystem.js';

/** Tools granted on new accounts. Only ship tools that are playable today. */
const STARTER_TOOLS = [
  'cracker_l1',
  'anti_firewall_l1',
];

/**
 * Previously auto-granted starters that have no player-facing program yet.
 * Removed from rig_tools + user FS on ensure so the local rig only shows owned,
 * available programs. Market purchase can still install them later when ready.
 */
const UNIMPLEMENTED_STARTER_TOOLS = [
  'scanner_l1',
  'trace_blocker_l1',
  'recon_l1',
  'log_cleaner_l1',
];

/** Prefer user filesystem; fall back to legacy rig_tools during transition. */
export async function listInstalledTools(accountId: string): Promise<string[]> {
  await ensureDefaultTree(accountId);
  await backfillToolsFromRigTools(accountId);
  const fromFs = await listInstalledToolIdsFromFs(accountId);
  if (fromFs.length > 0) return fromFs;

  const pool = getPool();
  const result = await pool.query<{ tool_id: string }>(
    'SELECT tool_id FROM rig_tools WHERE account_id = $1 ORDER BY tool_id',
    [accountId],
  );
  return result.rows.map((r) => r.tool_id);
}

export async function ensureStarterTools(accountId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureDefaultTree(accountId, client);

    // Drop unimplemented auto-grants so FS/ownership match playable programs.
    if (UNIMPLEMENTED_STARTER_TOOLS.length > 0) {
      await client.query(
        `DELETE FROM rig_tools WHERE account_id = $1 AND tool_id = ANY($2::text[])`,
        [accountId, UNIMPLEMENTED_STARTER_TOOLS],
      );
      await client.query(
        `DELETE FROM user_fs_nodes
         WHERE account_id = $1
           AND category = 'tool'
           AND tool_id = ANY($2::text[])`,
        [accountId, UNIMPLEMENTED_STARTER_TOOLS],
      );
    }

    for (const toolId of STARTER_TOOLS) {
      await client.query(
        `INSERT INTO rig_tools (account_id, tool_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [accountId, toolId],
      );
      await installToolFile(client, accountId, toolId);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function installTool(
  client: PoolClient,
  accountId: string,
  toolId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO rig_tools (account_id, tool_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [accountId, toolId],
  );
  await installToolFile(client, accountId, toolId);
}

export async function removeTools(accountId: string, toolIds: string[]): Promise<number> {
  if (toolIds.length === 0) return 0;
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM rig_tools WHERE account_id = $1 AND tool_id = ANY($2::text[])`,
    [accountId, toolIds],
  );
  await removeToolFiles(accountId, toolIds);
  return result.rowCount ?? 0;
}

export async function addLoot(
  accountId: string,
  lootType: 'data' | 'credentials' | 'source_code',
  label: string,
  sourceIpv6?: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO rig_loot (account_id, loot_type, label, source_ipv6)
     VALUES ($1, $2, $3, $4)`,
    [accountId, lootType, label, sourceIpv6 ?? null],
  );
}
