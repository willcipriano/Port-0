import { loadEnvFile } from '../packages/db/src/loadEnv.js';
import { getOrCreateDevAccount } from '../packages/db/src/accounts.js';
import { getPool } from '../packages/db/src/pool.js';
import { signAccessToken } from '../packages/shared/src/auth/jwt.js';

loadEnvFile();

const API = process.env.GAME_API_URL ?? 'http://localhost:3002';
const TICK_API = process.env.TICK_WORKER_URL ?? 'http://localhost:3003';
const TEST_ACCOUNT = '00000000-0000-4000-8000-0000000000e4';

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

async function main(): Promise<void> {
  console.log('=== Stage 4 tick economy integration test ===\n');

  const account = await getOrCreateDevAccount(TEST_ACCOUNT);
  const { token } = await signAccessToken(account.id);
  console.log(`Account: ${account.id}`);

  const pool = getPool();

  await pool.query(
    `UPDATE scan_queue SET status = 'cancelled' WHERE account_id = $1 AND status = 'queued'`,
    [account.id],
  );

  // Bump heat so we can verify decay
  await pool.query(`UPDATE world_subnets SET heat_level = 10 WHERE id = 'block_7'`);

  const meBefore = await api(token, 'GET', '/me');
  assert(meBefore.status === 200, `/me failed: ${JSON.stringify(meBefore.json)}`);
  const balanceBefore = meBefore.json.cryptoBalance as number;
  console.log(`Balance before: ${balanceBefore}`);

  const subnet = await api(token, 'GET', '/world/subnet');
  assert(subnet.status === 200, `/world/subnet failed`);
  const heatBefore = subnet.json.heatLevel as number;
  const subnetId = (subnet.json.subnet as { subnetId: string }).subnetId;
  console.log(`Subnet ${subnetId}, heat before: ${heatBefore}`);

  const market = await api(token, 'GET', '/market');
  assert(market.status === 200, `/market failed`);
  const items = market.json.items as Array<{ toolId: string; price: number }>;
  assert(items.length >= 6, `Expected market items, got ${items.length}`);
  console.log(`Market catalog: ${items.length} items`);

  // Grant one drone for passive income / upkeep test
  const machine = await pool.query<{ id: string }>(
    `SELECT id FROM machines WHERE is_landmark = false LIMIT 1`,
  );
  assert(machine.rows[0], 'No machines in world');
  await pool.query(
    `INSERT INTO machine_ownership (machine_id, owner_account_id)
     VALUES ($1, $2)
     ON CONFLICT (machine_id) DO UPDATE SET owner_account_id = EXCLUDED.owner_account_id`,
    [machine.rows[0].id, account.id],
  );
  await pool.query(
    `INSERT INTO fleet_membership (account_id, machine_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING`,
    [account.id, machine.rows[0].id],
  );

  const fleet = await api(token, 'GET', '/fleet');
  assert(fleet.status === 200, `/fleet failed`);
  const fleetCount = (fleet.json.machines as unknown[]).length;
  assert(fleetCount >= 1, `Expected fleet machines, got ${fleetCount}`);
  console.log(`Fleet: ${fleetCount} machine(s)`);

  // Queue scan
  const scanRes = await api(token, 'POST', '/scans', { subnetId });
  assert(scanRes.status === 201, `POST /scans failed: ${JSON.stringify(scanRes.json)}`);
  const scanId = scanRes.json.id as string;
  assert(scanRes.json.status === 'queued', 'Scan should be queued');
  console.log(`Scan queued: ${scanId}`);

  const nextTick = await pool.query<{ next: string }>(
    `SELECT COALESCE(MAX(tick_id), 0) + 1 AS next FROM world_ticks`,
  );
  const deliverTickId = Number(nextTick.rows[0].next);
  await pool.query(`UPDATE scan_queue SET resolves_at_tick = $1 WHERE id = $2`, [deliverTickId, scanId]);

  console.log(`Running tick ${deliverTickId}...`);
  const tickRes = await fetch(`${TICK_API}/tick/trigger?tickId=${deliverTickId}`, { method: 'POST' });
  const tickResult = (await tickRes.json()) as Record<string, unknown>;
  assert(tickRes.status === 200, `Tick trigger failed: ${JSON.stringify(tickResult)}`);
  assert(tickResult.started === true, `Tick duplicate or failed: ${JSON.stringify(tickResult)}`);
  const stepTimings = tickResult.stepTimings as Array<{ name: string; durationMs: number }> | undefined;
  console.log(`Tick steps: ${stepTimings?.map((s) => `${s.name}=${s.durationMs}ms`).join(', ')}`);
  assert((tickResult.accountsAffected as number) >= 1, 'Expected at least one account affected');

  const scanAfter = await api(token, 'GET', `/scans/${scanId}`);
  assert(scanAfter.status === 200, `GET /scans/${scanId} failed`);
  assert(scanAfter.json.status === 'complete', `Scan not complete: ${JSON.stringify(scanAfter.json)}`);
  const results = scanAfter.json.results as string[];
  assert(results.length > 0, 'Scan should return IPv6 results');
  console.log(`Scan results (${results.length}): ${results.slice(0, 3).join(', ')}${results.length > 3 ? '...' : ''}`);

  const meAfter = await api(token, 'GET', '/me');
  const balanceAfter = meAfter.json.cryptoBalance as number;
  const netDrone = 10 - 5; // passive income - upkeep per tick
  assert(
    balanceAfter === balanceBefore + netDrone,
    `Balance should change by ${netDrone}: before=${balanceBefore} after=${balanceAfter}`,
  );
  console.log(`Balance after tick: ${balanceAfter} (+${netDrone} net from 1 drone)`);

  const subnetAfter = await api(token, 'GET', '/world/subnet');
  const heatAfter = subnetAfter.json.heatLevel as number;
  assert(heatAfter === heatBefore - 1, `Heat should decay by 1: ${heatBefore} -> ${heatAfter}`);
  console.log(`Heat after tick: ${heatAfter} (decayed from ${heatBefore})`);

  const sync = await api(token, 'GET', `/me/sync?sinceTick=${deliverTickId - 1}`);
  assert(sync.status === 200, `/me/sync failed`);
  const summaries = sync.json.tickSummaries as Array<{ tickId: number; summary: Record<string, unknown> }>;
  assert(summaries.some((s) => s.tickId === deliverTickId), 'Sync should include tick summary');
  const summary = summaries.find((s) => s.tickId === deliverTickId)!;
  assert(summary.summary.scanResults != null, 'Summary should include scan results');
  console.log(`Sync summary for tick ${deliverTickId}: balanceChange=${summary.summary.balanceChange}`);

  // Loot sell
  const lootInsert = await pool.query<{ id: string }>(
    `INSERT INTO rig_loot (account_id, loot_type, label, source_ipv6)
     VALUES ($1, 'data', 'test_dump.sql', '2001:db8:1:7::test')
     RETURNING id`,
    [account.id],
  );
  const lootId = lootInsert.rows[0].id;
  const sell = await api(token, 'POST', '/inventory/sell', { lootId });
  assert(sell.status === 200, `POST /inventory/sell failed: ${JSON.stringify(sell.json)}`);
  assert(sell.json.amount === 25, 'Loot sell price should be 25');
  console.log(`Sold loot for ${sell.json.amount} crypto, balance now ${sell.json.balance}`);

  // Market purchase blocked when already owned
  const purchase = await api(token, 'POST', '/market/purchase', { toolId: 'scanner_l1' });
  assert(purchase.status === 400, 'Purchase of owned tool should fail');
  console.log(`Market purchase correctly rejected: ${purchase.json.error}`);

  console.log('\n=== All Stage 4 integration checks passed ===');
}

main().catch((err) => {
  console.error('\nTEST FAILED:', err.message);
  process.exit(1);
});
