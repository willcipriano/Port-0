import type { SecurityComponents } from '@port0/shared';
import { factionFromArchetype, defaultFilesystem } from '@port0/shared';
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
}

export async function findMachineByIpv6(ipv6: string): Promise<DbMachine | null> {
  const pool = getPool();
  const result = await pool.query<DbMachine>(
    `SELECT id, ipv6, os_archetype_id, is_landmark, landmark_id,
            security_components, faction, filesystem, alarm_active
     FROM machines WHERE LOWER(ipv6) = LOWER($1)`,
    [ipv6],
  );
  return result.rows[0] ?? null;
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
       security_components, faction, filesystem, alarm_active
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, true)`,
    [
      machine.ipv6,
      machine.osArchetypeId,
      machine.isLandmark,
      machine.landmarkId ?? null,
      JSON.stringify(machine.securityComponents),
      faction,
      JSON.stringify(filesystem),
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
