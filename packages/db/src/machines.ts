import type { SecurityComponents } from '@port0/shared';
import { factionFromArchetype, defaultFilesystem, createRng, GEO_ANCHORS, GEO_ANCHOR_TOTAL_WEIGHT } from '@port0/shared';
import type { GeneratedMachine } from '@port0/shared';
import type { PoolClient } from 'pg';
import { getPool } from './pool.js';

export interface DbMachine {
  id: string;
  ipv6: string;
  os_archetype_id: string;
  is_landmark: boolean;
  landmark_id: string | null;
  security_components: SecurityComponents;
  faction: string;
  filesystem: Record<string, unknown>;
  alarm_active: boolean;
  cpu: number;
  ram: number;
  storage: number;
  latitude: number | null;
  longitude: number | null;
}

export async function findMachineByIpv6(ipv6: string): Promise<DbMachine | null> {
  const pool = getPool();
  const result = await pool.query<DbMachine>(
    `SELECT id, ipv6, os_archetype_id, is_landmark, landmark_id,
            security_components, faction, filesystem, alarm_active,
            cpu, ram, storage, latitude, longitude
     FROM machines WHERE LOWER(ipv6) = LOWER($1)`,
    [ipv6],
  );
  return result.rows[0] ?? null;
}

export async function getMachineOwner(
  machineId: string,
): Promise<{ accountId: string; displayHandle: string | null } | null> {
  const pool = getPool();
  const result = await pool.query<{ owner_account_id: string; display_handle: string | null }>(
    `SELECT mo.owner_account_id, a.display_handle
     FROM machine_ownership mo
     JOIN accounts a ON a.id = mo.owner_account_id
     WHERE mo.machine_id = $1`,
    [machineId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { accountId: row.owner_account_id, displayHandle: row.display_handle };
}

export async function transferMachineOwnership(
  machineId: string,
  fromAccountId: string,
  toAccountId: string,
  reason: string,
  existingClient?: PoolClient,
): Promise<void> {
  const pool = getPool();
  const client = existingClient ?? (await pool.connect());
  const ownsClient = !existingClient;
  try {
    if (ownsClient) await client.query('BEGIN');
    await client.query('DELETE FROM machine_ownership WHERE machine_id = $1', [machineId]);
    await client.query(
      `INSERT INTO machine_ownership (machine_id, owner_account_id)
       VALUES ($1, $2)`,
      [machineId, toAccountId],
    );
    await client.query('DELETE FROM fleet_membership WHERE machine_id = $1', [machineId]);
    await client.query(
      `INSERT INTO fleet_membership (account_id, machine_id, role)
       VALUES ($1, $2, 'owner')`,
      [toAccountId, machineId],
    );
    await client.query(
      `INSERT INTO audit_log (event_type, account_id, payload)
       VALUES ('ownership_transfer', $1, $2::jsonb)`,
      [
        toAccountId,
        JSON.stringify({
          machine_id: machineId,
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          reason,
        }),
      ],
    );
    if (ownsClient) await client.query('COMMIT');
  } catch (err) {
    if (ownsClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownsClient) client.release();
  }
}

export async function claimMachine(machineId: string, accountId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM machine_ownership WHERE machine_id = $1', [machineId]);
    await client.query(
      `INSERT INTO machine_ownership (machine_id, owner_account_id)
       VALUES ($1, $2)`,
      [machineId, accountId],
    );
    await client.query(
      `INSERT INTO fleet_membership (account_id, machine_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT DO NOTHING`,
      [accountId, machineId],
    );
    await client.query(
      `INSERT INTO audit_log (event_type, account_id, payload)
       VALUES ('ownership_transfer', $1, $2::jsonb)`,
      [
        accountId,
        JSON.stringify({
          machine_id: machineId,
          to_account_id: accountId,
          reason: 'hack_claim',
        }),
      ],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function incrementSubnetHeat(subnetId: string, amount: number): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ heat_level: number }>(
    `UPDATE world_subnets
     SET heat_level = heat_level + $2
     WHERE id = $1
     RETURNING heat_level`,
    [subnetId, amount],
  );
  return result.rows[0]?.heat_level ?? 0;
}

export async function getSubnetHeat(subnetId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ heat_level: number }>(
    'SELECT heat_level FROM world_subnets WHERE id = $1',
    [subnetId],
  );
  return result.rows[0]?.heat_level ?? 0;
}

export async function getDefaultSubnetId(): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>('SELECT id FROM world_subnets LIMIT 1');
  return result.rows[0]?.id ?? null;
}

export async function insertMachineRow(client: PoolClient, machine: GeneratedMachine): Promise<void> {
  const faction = factionFromArchetype(machine.osArchetypeId);
  const filesystem = defaultFilesystem(machine.osArchetypeId);
  await client.query(
    `INSERT INTO machines (
       ipv6, os_archetype_id, is_landmark, landmark_id,
       security_components, faction, filesystem, alarm_active,
       cpu, ram, storage, latitude, longitude
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, true, $8, $9, $10, $11, $12)`,
    [
      machine.ipv6,
      machine.osArchetypeId,
      machine.isLandmark,
      machine.landmarkId ?? null,
      JSON.stringify(machine.securityComponents),
      faction,
      JSON.stringify(filesystem),
      machine.resources.cpu,
      machine.resources.ram,
      machine.resources.storage,
      machine.latitude,
      machine.longitude,
    ],
  );
}

export async function backfillMachineSecurity(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ id: string; os_archetype_id: string }>(
    `SELECT id, os_archetype_id FROM machines WHERE security_components IS NULL`,
  );
  let updated = 0;
  for (const row of result.rows) {
    const faction = factionFromArchetype(row.os_archetype_id);
    const filesystem = defaultFilesystem(row.os_archetype_id);
    const defaults =
      row.os_archetype_id === 'cheap_server'
        ? { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 }
        : row.os_archetype_id === 'generic_linux'
          ? { password: 2, firewall: 2, alarm: 2, encryption: 1, antivirus: 1 }
          : { password: 3, firewall: 3, alarm: 3, encryption: 2, antivirus: 2 };
    await pool.query(
      `UPDATE machines
       SET security_components = $2::jsonb,
           faction = COALESCE(NULLIF(faction, ''), $3),
           filesystem = CASE WHEN filesystem = '{}'::jsonb THEN $4::jsonb ELSE filesystem END
       WHERE id = $1`,
      [row.id, JSON.stringify(defaults), faction, JSON.stringify(filesystem)],
    );
    updated += 1;
  }
  return updated;
}

/**
 * Backfill latitude/longitude for any machine rows that are missing them.
 * Uses a deterministic seed derived from the machine's IPv6 address so the
 * result is reproducible without a full re-bootstrap.
 */
export async function backfillMachineLocation(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ id: string; ipv6: string }>(
    `SELECT id, ipv6 FROM machines WHERE latitude IS NULL OR longitude IS NULL`,
  );
  let updated = 0;
  for (const row of result.rows) {
    // Derive seed from the IPv6 string (simple djb2-style hash)
    let seed = 5381;
    for (let i = 0; i < row.ipv6.length; i++) {
      seed = ((seed * 33) ^ row.ipv6.charCodeAt(i)) >>> 0;
    }
    const rng = createRng(seed);
    // Weighted anchor pick (mirrors rollLocation in generateSubnet)
    let roll = rng.next() * GEO_ANCHOR_TOTAL_WEIGHT;
    let anchor = GEO_ANCHORS[GEO_ANCHORS.length - 1]!;
    for (const a of GEO_ANCHORS) {
      roll -= a.weight;
      if (roll <= 0) { anchor = a; break; }
    }
    const u1 = Math.max(1e-10, rng.next());
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const jitterScale = 2.5;
    const latitude  = Math.min(85,  Math.max(-85,  anchor.lat + z * jitterScale));
    const longitude = Math.min(180, Math.max(-180, anchor.lng + z * jitterScale));
    await pool.query(
      `UPDATE machines SET latitude = $2, longitude = $3 WHERE id = $1`,
      [row.id, latitude, longitude],
    );
    updated += 1;
  }
  return updated;
}
