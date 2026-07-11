import { getPool } from './pool.js';
import type { DbAccountWithRig } from './types.js';

export type FleetRole = 'owner' | 'staging' | 'passive_income' | 'defensive';

export interface FleetMachine {
  ipv6: string;
  osArchetypeId: string;
  isLandmark: boolean;
  landmarkId: string | null;
  claimedAt: string;
  role: FleetRole;
  resources: { cpu: number; ram: number; storage: number };
}

export interface FleetAggregates {
  attack: number;
  mpPool: number;
  hp: number;
}

export interface FleetResponse {
  machines: FleetMachine[];
  aggregates: FleetAggregates;
}

export async function listFleetMachines(accountId: string): Promise<FleetMachine[]> {
  const pool = getPool();
  const result = await pool.query<{
    ipv6: string;
    os_archetype_id: string;
    is_landmark: boolean;
    landmark_id: string | null;
    claimed_at: Date;
    role: string;
    cpu: number;
    ram: number;
    storage: number;
  }>(
    `SELECT m.ipv6, m.os_archetype_id, m.is_landmark, m.landmark_id, mo.claimed_at,
            COALESCE(fm.role, 'owner') AS role, m.cpu, m.ram, m.storage
     FROM machine_ownership mo
     JOIN machines m ON m.id = mo.machine_id
     LEFT JOIN fleet_membership fm ON fm.account_id = mo.owner_account_id AND fm.machine_id = m.id
     WHERE mo.owner_account_id = $1
     ORDER BY mo.claimed_at DESC`,
    [accountId],
  );
  return result.rows.map((row) => ({
    ipv6: row.ipv6,
    osArchetypeId: row.os_archetype_id,
    isLandmark: row.is_landmark,
    landmarkId: row.landmark_id,
    claimedAt: row.claimed_at.toISOString(),
    role: row.role as FleetRole,
    resources: { cpu: row.cpu, ram: row.ram, storage: row.storage },
  }));
}

export async function getFleetResponse(accountId: string): Promise<FleetResponse> {
  const machines = await listFleetMachines(accountId);
  const aggregates = machines.reduce(
    (acc, m) => ({
      attack: acc.attack + m.resources.cpu,
      mpPool: acc.mpPool + m.resources.ram,
      hp: acc.hp + m.resources.storage,
    }),
    { attack: 0, mpPool: 0, hp: 0 },
  );
  return { machines, aggregates };
}

export async function getFleetAggregates(accountId: string): Promise<FleetAggregates> {
  const { aggregates } = await getFleetResponse(accountId);
  return aggregates;
}

export async function updateFleetRole(
  accountId: string,
  ipv6: string,
  role: FleetRole,
): Promise<FleetMachine> {
  const pool = getPool();
  const result = await pool.query<{ machine_id: string }>(
    `SELECT mo.machine_id
     FROM machine_ownership mo
     JOIN machines m ON m.id = mo.machine_id
     WHERE mo.owner_account_id = $1 AND LOWER(m.ipv6) = LOWER($2)`,
    [accountId, ipv6],
  );
  if (!result.rows[0]) {
    throw new FleetError('machine_not_found', 'Machine not in your fleet');
  }
  await pool.query(
    `INSERT INTO fleet_membership (account_id, machine_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (account_id, machine_id) DO UPDATE SET role = EXCLUDED.role`,
    [accountId, result.rows[0].machine_id, role],
  );
  const fleet = await listFleetMachines(accountId);
  const updated = fleet.find((m) => m.ipv6.toLowerCase() === ipv6.toLowerCase());
  if (!updated) throw new FleetError('machine_not_found', 'Machine not in your fleet');
  return updated;
}

export function toRigResponse(
  account: DbAccountWithRig,
  usage?: { usedQgb: number; capacityQgb: number },
) {
  return {
    cpu: account.cpu,
    ram: account.ram,
    storage: account.storage,
    bandwidth: account.bandwidth,
    cyberware: Array.isArray(account.cyberware) ? account.cyberware : [],
    usedQgb: usage?.usedQgb ?? 0,
    capacityQgb: usage?.capacityQgb ?? account.storage,
  };
}

export async function sellLootItem(
  accountId: string,
  lootId: string,
): Promise<{ lootId: string; amount: number; balance: number }> {
  const { loadEconomyBalance } = await import('@port0/shared');
  const economy = loadEconomyBalance();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const loot = await client.query<{ id: string }>(
      `DELETE FROM rig_loot WHERE id = $1 AND account_id = $2 RETURNING id`,
      [lootId, accountId],
    );
    if (!loot.rowCount) {
      throw new InventoryError('loot_not_found', 'Loot item not found');
    }
    const { creditAccount } = await import('./economy.js');
    const balance = await creditAccount(
      client,
      accountId,
      economy.lootSellPrice,
      `loot_sell:${lootId}`,
    );
    await client.query('COMMIT');
    return { lootId, amount: economy.lootSellPrice, balance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export class FleetError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FleetError';
  }
}

export class InventoryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}
