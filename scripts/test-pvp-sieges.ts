import { loadEnvFile } from '../packages/db/src/loadEnv.js';
import { getOrCreateDevAccount } from '../packages/db/src/accounts.js';
import { getPool } from '../packages/db/src/pool.js';
import { signAccessToken } from '../packages/shared/src/auth/jwt.js';

loadEnvFile();

const API = process.env.GAME_API_URL ?? 'http://localhost:3002';
const TICK_API = process.env.TICK_WORKER_URL ?? 'http://localhost:3003';
const ATTACKER_ID = '00000000-0000-4000-8000-0000000000a5';
const DEFENDER_ID = '00000000-0000-4000-8000-0000000000d5';

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function assignDrone(accountId: string): Promise<{ ipv6: string; machineId: string }> {
  const pool = getPool();
  const machine = await pool.query<{ id: string; ipv6: string }>(
    `SELECT m.id, m.ipv6 FROM machines m
     LEFT JOIN machine_ownership mo ON mo.machine_id = m.id
     WHERE m.is_landmark = false AND mo.machine_id IS NULL
     LIMIT 1`,
  );
  assert(!!machine.rows[0], 'No unowned machines available');
  const row = machine.rows[0]!;
  await pool.query(
    `INSERT INTO machine_ownership (machine_id, owner_account_id)
     VALUES ($1, $2)
     ON CONFLICT (machine_id) DO UPDATE SET owner_account_id = EXCLUDED.owner_account_id`,
    [row.id, accountId],
  );
  await pool.query(
    `INSERT INTO fleet_membership (account_id, machine_id, role)
     VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [accountId, row.id],
  );
  return { ipv6: row.ipv6, machineId: row.id };
}

async function main(): Promise<void> {
  console.log('=== Stage 5 PvP siege integration test ===\n');

  const pool = getPool();
  const attacker = await getOrCreateDevAccount(ATTACKER_ID);
  const defender = await getOrCreateDevAccount(DEFENDER_ID);
  const { token: attackerToken } = await signAccessToken(attacker.id);
  const { token: defenderToken } = await signAccessToken(defender.id);

  const attackerDrone = await assignDrone(attacker.id);
  const defenderDrone = await assignDrone(defender.id);
  for (let i = 0; i < 4; i++) {
    try {
      await assignDrone(attacker.id);
    } catch {
      break;
    }
  }
  console.log(`Attacker drone: ${attackerDrone.ipv6}`);
  console.log(`Defender drone: ${defenderDrone.ipv6}`);

  const fleet = await api(attackerToken, 'GET', '/fleet');
  assert(fleet.status === 200, `/fleet failed: ${JSON.stringify(fleet.json)}`);
  const aggregates = fleet.json.aggregates as { attack: number; mpPool: number; hp: number };
  assert(aggregates.attack >= 1, 'Fleet should have attack aggregate');
  console.log(`Fleet aggregates: attack=${aggregates.attack} mp=${aggregates.mpPool} hp=${aggregates.hp}`);

  const rig = await api(attackerToken, 'GET', '/rig');
  assert(rig.status === 200, '/rig failed');
  assert(typeof rig.json.cpu === 'number', 'Rig should expose stats');
  console.log(`Rig CPU: ${rig.json.cpu} (separate from fleet)`);

  await pool.query(
    `INSERT INTO account_intel (account_id, target_ipv6, owner_hint, confidence, source)
     VALUES ($1, LOWER($2), $3, 0.9, 'test')
     ON CONFLICT DO NOTHING`,
    [attacker.id, defenderDrone.ipv6, defender.display_handle ?? 'defender'],
  );

  const rigSiege = await api(attackerToken, 'POST', '/sieges', {
    targetIpv6: '2001:db8:rig::1',
  });
  assert(rigSiege.status === 404, 'Siege against non-existent rig IPv6 should fail');

  const craft = await pool.query<{ id: string }>(
    `INSERT INTO virus_craft_jobs (account_id, effect_type, level, finishes_at, completed)
     VALUES ($1, 'storage_damage', 2, NOW() - INTERVAL '1 minute', false)
     RETURNING id`,
    [attacker.id],
  );
  const nextTick = await pool.query<{ next: string }>(
    `SELECT COALESCE(MAX(tick_id), 0) + 1 AS next FROM world_ticks`,
  );
  const tickId = Number(nextTick.rows[0].next);
  await fetch(`${TICK_API}/tick/trigger?tickId=${tickId}`, { method: 'POST' });

  const inventory = await api(attackerToken, 'GET', '/viruses/inventory');
  assert(inventory.status === 200, '/viruses/inventory failed');
  const viruses = inventory.json.inventory as Array<{ id: string; usesRemaining: number }>;
  assert(viruses.length >= 1, 'Attacker should have crafted virus');
  const virusId = viruses[0]!.id;
  console.log(`Virus ready: ${virusId} (${viruses[0]!.usesRemaining} uses)`);

  const siegeRes = await api(attackerToken, 'POST', '/sieges', {
    targetIpv6: defenderDrone.ipv6,
    virusIds: [virusId],
  });
  assert(siegeRes.status === 201, `POST /sieges failed: ${JSON.stringify(siegeRes.json)}`);
  const siege = siegeRes.json.siege as { id: string; status: string };
  console.log(`Siege declared: ${siege.id} status=${siege.status}`);

  await api(attackerToken, 'POST', `/sieges/${siege.id}/actions`, {
    type: 'deploy_virus',
    virusId,
  });
  await api(attackerToken, 'POST', `/sieges/${siege.id}/actions`, { type: 'escalate' });
  await api(attackerToken, 'POST', `/sieges/${siege.id}/actions`, { type: 'escalate' });
  console.log('Applied siege actions: virus deploy + escalations');

  await pool.query(
    `UPDATE sieges SET interactive_window_ends_at = NOW() - INTERVAL '1 minute', resolve_at_tick = $2, status = 'resolving'
     WHERE id = $1`,
    [siege.id, tickId + 1],
  );

  const resolveTickId = tickId + 1;
  const tickRes = await fetch(`${TICK_API}/tick/trigger?tickId=${resolveTickId}`, { method: 'POST' });
  const tickResult = (await tickRes.json()) as Record<string, unknown>;
  assert(tickRes.status === 200, `Tick failed: ${JSON.stringify(tickResult)}`);

  const ownerAfter = await pool.query<{ owner_account_id: string }>(
    `SELECT owner_account_id FROM machine_ownership WHERE machine_id = $1`,
    [defenderDrone.machineId],
  );
  assert(
    ownerAfter.rows[0]?.owner_account_id === attacker.id,
    `Expected attacker to own defender drone after siege win, owner=${ownerAfter.rows[0]?.owner_account_id}`,
  );
  console.log('Ownership transferred to attacker on siege win');

  const siegeAfter = await api(attackerToken, 'GET', `/sieges/${siege.id}`);
  assert(siegeAfter.status === 200, 'GET siege failed');
  assert(siegeAfter.json.siege && (siegeAfter.json.siege as { outcome: string }).outcome === 'attacker_win', 'Expected attacker_win outcome');

  const defenderFleet = await api(defenderToken, 'GET', '/fleet');
  const defenderStillOwns = (defenderFleet.json.machines as Array<{ ipv6: string }>).some(
    (m) => m.ipv6.toLowerCase() === defenderDrone.ipv6.toLowerCase(),
  );
  assert(!defenderStillOwns, 'Defender should no longer own the sieged drone');

  console.log('\n=== All Stage 5 integration checks passed ===');
}

main().catch((err) => {
  console.error('\nTEST FAILED:', err.message);
  process.exit(1);
});
