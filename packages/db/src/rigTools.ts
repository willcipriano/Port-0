import { getPool } from './pool.js';

const STARTER_TOOLS = [
  'scanner_l1',
  'cracker_l1',
  'trace_blocker_l1',
  'port_opener_l1',
  'recon_l1',
  'log_cleaner_l1',
];

export async function listInstalledTools(accountId: string): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ tool_id: string }>(
    'SELECT tool_id FROM rig_tools WHERE account_id = $1 ORDER BY tool_id',
    [accountId],
  );
  return result.rows.map((r) => r.tool_id);
}

export async function ensureStarterTools(accountId: string): Promise<void> {
  const pool = getPool();
  for (const toolId of STARTER_TOOLS) {
    await pool.query(
      `INSERT INTO rig_tools (account_id, tool_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [accountId, toolId],
    );
  }
}

export async function installTool(
  client: import('pg').PoolClient,
  accountId: string,
  toolId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO rig_tools (account_id, tool_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [accountId, toolId],
  );
}

export async function removeTools(accountId: string, toolIds: string[]): Promise<number> {
  if (toolIds.length === 0) return 0;
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM rig_tools WHERE account_id = $1 AND tool_id = ANY($2::text[])`,
    [accountId, toolIds],
  );
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
