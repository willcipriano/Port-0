import { getPool } from './pool.js';

export interface IntelEntry {
  targetIpv6: string;
  ownerHint: string | null;
  confidence: number;
  source: string;
  discoveredAt: string;
}

export async function storeIntel(
  accountId: string,
  targetIpv6: string,
  ownerHint: string | null,
  confidence: number,
  source: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO account_intel (account_id, target_ipv6, owner_hint, confidence, source)
     VALUES ($1, LOWER($2), $3, $4, $5)
     ON CONFLICT (account_id, target_ipv6) DO UPDATE SET
       owner_hint = CASE
         WHEN EXCLUDED.confidence >= account_intel.confidence THEN EXCLUDED.owner_hint
         ELSE account_intel.owner_hint
       END,
       confidence = GREATEST(account_intel.confidence, EXCLUDED.confidence),
       source = CASE
         WHEN EXCLUDED.confidence >= account_intel.confidence THEN EXCLUDED.source
         ELSE account_intel.source
       END,
       discovered_at = CASE
         WHEN EXCLUDED.confidence >= account_intel.confidence THEN NOW()
         ELSE account_intel.discovered_at
       END`,
    [accountId, targetIpv6, ownerHint, confidence, source],
  );
}

export async function listIntel(accountId: string): Promise<IntelEntry[]> {
  const pool = getPool();
  const result = await pool.query<{
    target_ipv6: string;
    owner_hint: string | null;
    confidence: number;
    source: string;
    discovered_at: Date;
  }>(
    `SELECT target_ipv6, owner_hint, confidence, source, discovered_at
     FROM account_intel
     WHERE account_id = $1
     ORDER BY discovered_at DESC`,
    [accountId],
  );
  return result.rows.map((row) => ({
    targetIpv6: row.target_ipv6,
    ownerHint: row.owner_hint,
    confidence: row.confidence,
    source: row.source,
    discoveredAt: row.discovered_at.toISOString(),
  }));
}

export async function hasIntelOnTarget(accountId: string, targetIpv6: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM account_intel
       WHERE account_id = $1 AND target_ipv6 = LOWER($2)
         AND owner_hint IS NOT NULL AND owner_hint <> 'unknown'
     ) AS exists`,
    [accountId, targetIpv6],
  );
  return result.rows[0]?.exists ?? false;
}
