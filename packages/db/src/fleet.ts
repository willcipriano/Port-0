import { loadEconomyBalance } from '@port0/shared';
import { getPool } from './pool.js';
import { creditAccount } from './economy.js';

export interface FleetMachine {
  ipv6: string;
  osArchetypeId: string;
  isLandmark: boolean;
  landmarkId: string | null;
  claimedAt: string;
}

export async function listFleetMachines(accountId: string): Promise<FleetMachine[]> {
  const pool = getPool();
  const result = await pool.query<{
    ipv6: string;
    os_archetype_id: string;
    is_landmark: boolean;
    landmark_id: string | null;
    claimed_at: string;
  }>(
    `SELECT m.ipv6, m.os_archetype_id, m.is_landmark, m.landmark_id, mo.claimed_at
     FROM machine_ownership mo
     JOIN machines m ON m.id = mo.machine_id
     WHERE mo.owner_account_id = $1
     ORDER BY mo.claimed_at DESC`,
    [accountId],
  );
  return result.rows.map((row) => ({
    ipv6: row.ipv6,
    osArchetypeId: row.os_archetype_id,
    isLandmark: row.is_landmark,
    landmarkId: row.landmark_id,
    claimedAt: row.claimed_at,
  }));
}

export async function sellLootItem(
  accountId: string,
  lootId: string,
): Promise<{ lootId: string; amount: number; balance: number }> {
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

export class InventoryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}
