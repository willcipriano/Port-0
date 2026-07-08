import { getPool } from './pool.js';

export interface SavedRootPasswordEntry {
  targetIpv6: string;
  password: string;
  lastUpdated: string;
}

interface SavedRootPasswordRow {
  target_ipv6: string;
  password: string;
  last_updated: Date;
}

function toEntry(row: SavedRootPasswordRow): SavedRootPasswordEntry {
  return {
    targetIpv6: row.target_ipv6,
    password: row.password,
    lastUpdated: row.last_updated.toISOString(),
  };
}

export async function storeSavedRootPassword(
  accountId: string,
  targetIpv6: string,
  password: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO account_saved_root_passwords (account_id, target_ipv6, password)
     VALUES ($1, LOWER($2), $3)
     ON CONFLICT (account_id, target_ipv6) DO UPDATE SET
       password = EXCLUDED.password,
       last_updated = NOW()`,
    [accountId, targetIpv6, password],
  );
}

export async function listSavedRootPasswords(accountId: string): Promise<SavedRootPasswordEntry[]> {
  const pool = getPool();
  const result = await pool.query<SavedRootPasswordRow>(
    `SELECT target_ipv6, password, last_updated
     FROM account_saved_root_passwords
     WHERE account_id = $1
     ORDER BY last_updated DESC`,
    [accountId],
  );
  return result.rows.map(toEntry);
}

export async function deleteSavedRootPassword(
  accountId: string,
  targetIpv6: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM account_saved_root_passwords
     WHERE account_id = $1 AND LOWER(target_ipv6) = LOWER($2)`,
    [accountId, targetIpv6],
  );
  return (result.rowCount ?? 0) > 0;
}
