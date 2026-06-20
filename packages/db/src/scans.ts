import { loadEconomyBalance } from '@port0/shared';
import type { PoolClient } from 'pg';
import { getPool } from './pool.js';
import { currentTickId } from './tickId.js';
import { listInstalledTools } from './rigTools.js';

export interface ScanResultEntry {
  ipv6: string;
  osArchetypeId: string;
  zoneContext: string;
}

export interface ScanRecord {
  id: string;
  accountId: string;
  subnetId: string;
  status: 'queued' | 'complete' | 'cancelled';
  queuedAt: string;
  resolvesAtTick: number;
  completedAt: string | null;
  results: ScanResultEntry[] | null;
}

const SCANNER_TOOL_ID = 'scanner_l1';

function mapScanRow(row: {
  id: string;
  account_id: string;
  subnet_id: string;
  status: string;
  queued_at: string;
  resolves_at_tick: string;
  completed_at: string | null;
  results: ScanResultEntry[] | null;
}): ScanRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    subnetId: row.subnet_id,
    status: row.status as ScanRecord['status'],
    queuedAt: row.queued_at,
    resolvesAtTick: Number(row.resolves_at_tick),
    completedAt: row.completed_at,
    results: row.results,
  };
}

export function toScanResponse(scan: ScanRecord): {
  id: string;
  accountId?: string;
  subnetId?: string;
  status: string;
  results?: string[];
  queuedAt: string;
  completedAt?: string;
} {
  const response: ReturnType<typeof toScanResponse> = {
    id: scan.id,
    status: scan.status,
    queuedAt: scan.queuedAt,
  };
  if (scan.status === 'complete' && scan.results) {
    response.results = scan.results.map((r) => r.ipv6);
    response.completedAt = scan.completedAt ?? undefined;
  }
  return response;
}

export async function queueScan(accountId: string, subnetId: string): Promise<ScanRecord> {
  const tools = await listInstalledTools(accountId);
  if (!tools.includes(SCANNER_TOOL_ID)) {
    throw new ScanError('scanner_required', 'Install a subnet scanner before queuing scans');
  }

  const pool = getPool();
  const active = await pool.query(
    `SELECT id FROM scan_queue WHERE account_id = $1 AND status = 'queued'`,
    [accountId],
  );
  if (active.rowCount && active.rowCount > 0) {
    throw new ScanError('scan_already_queued', 'Only one scan may be queued at a time');
  }

  const resolvesAtTick = currentTickId() + 1;
  const result = await pool.query(
    `INSERT INTO scan_queue (account_id, subnet_id, resolves_at_tick)
     VALUES ($1, $2, $3)
     RETURNING id, account_id, subnet_id, status, queued_at, resolves_at_tick, completed_at, results`,
    [accountId, subnetId, resolvesAtTick],
  );
  return mapScanRow(result.rows[0]);
}

export async function getScan(scanId: string, accountId: string): Promise<ScanRecord | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, account_id, subnet_id, status, queued_at, resolves_at_tick, completed_at, results
     FROM scan_queue
     WHERE id = $1 AND account_id = $2`,
    [scanId, accountId],
  );
  return result.rows[0] ? mapScanRow(result.rows[0]) : null;
}

export class ScanError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

export async function deliverScansForTick(
  client: PoolClient,
  tickId: number,
): Promise<Map<string, { scanId: string; results: ScanResultEntry[] }>> {
  const economy = loadEconomyBalance();
  const pending = await client.query<{
    id: string;
    account_id: string;
    subnet_id: string;
  }>(
    `SELECT id, account_id, subnet_id
     FROM scan_queue
     WHERE status = 'queued' AND resolves_at_tick <= $1
     FOR UPDATE`,
    [tickId],
  );

  const delivered = new Map<string, { scanId: string; results: ScanResultEntry[] }>();

  for (const scan of pending.rows) {
    const zoneResult = await client.query<{ zone_name: string }>(
      'SELECT zone_name FROM world_subnets WHERE id = $1',
      [scan.subnet_id],
    );
    const zoneName = zoneResult.rows[0]?.zone_name ?? 'Unknown';

    const machines = await client.query<{
      id: string;
      ipv6: string;
      os_archetype_id: string;
    }>(
      `SELECT m.id, m.ipv6, m.os_archetype_id
       FROM machines m
       LEFT JOIN account_discovered_machines adm
         ON adm.machine_id = m.id AND adm.account_id = $1
       WHERE adm.machine_id IS NULL
       ORDER BY RANDOM()
       LIMIT $2`,
      [scan.account_id, economy.machinesPerScan],
    );

    const results: ScanResultEntry[] = machines.rows.map((m) => ({
      ipv6: m.ipv6,
      osArchetypeId: m.os_archetype_id,
      zoneContext: zoneName,
    }));

    for (const m of machines.rows) {
      await client.query(
        `INSERT INTO account_discovered_machines (account_id, machine_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [scan.account_id, m.id],
      );
    }

    await client.query(
      `UPDATE scan_queue
       SET status = 'complete', completed_at = NOW(), results = $2::jsonb
       WHERE id = $1`,
      [scan.id, JSON.stringify(results)],
    );

    delivered.set(scan.account_id, { scanId: scan.id, results });
  }

  return delivered;
}
