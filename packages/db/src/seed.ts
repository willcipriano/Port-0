import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';
import { bootstrapWorld } from './worldBootstrap.js';
import { backfillMachineSecurity, backfillMachineLocation, backfillMachinePasswords } from './machines.js';

function contentRoot(): string {
  if (process.env.CONTENT_DIR) return resolve(process.env.CONTENT_DIR);
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../content');
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

export async function seedDatabase(): Promise<void> {
  const pool = getPool();
  const root = contentRoot();

  const subnet = loadJson(resolve(root, 'subnet/mvp-subnet.json'));
  await pool.query(
    `INSERT INTO world_subnets (id, zone_id, zone_name, ipv6_prefix, theme, machine_count, landmark_count, heat_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
     ON CONFLICT (id) DO UPDATE SET
       zone_id = EXCLUDED.zone_id,
       zone_name = EXCLUDED.zone_name,
       ipv6_prefix = EXCLUDED.ipv6_prefix,
       theme = EXCLUDED.theme,
       machine_count = EXCLUDED.machine_count,
       landmark_count = EXCLUDED.landmark_count`,
    [
      subnet.subnet_id,
      subnet.zone_id,
      subnet.zone_name,
      subnet.ipv6_prefix,
      subnet.theme,
      subnet.machine_count,
      subnet.landmark_count,
    ],
  );

  const toolsFile = loadJson(resolve(root, 'tools/mvp-tools.json')) as {
    tools: Array<{ id: string; market_price: number }>;
  };
  for (const tool of toolsFile.tools) {
    await pool.query(
      `INSERT INTO market_catalog (tool_id, price, active)
       VALUES ($1, $2, true)
       ON CONFLICT (tool_id) DO UPDATE SET price = EXCLUDED.price, active = true`,
      [tool.id, tool.market_price],
    );
  }

  await pool.query(
    `INSERT INTO audit_log (event_type, account_id, payload)
     VALUES ('ownership_transfer', NULL, $1::jsonb)`,
    [
      JSON.stringify({
        from_account_id: null,
        to_account_id: null,
        ipv6: '2001:db8:1:7::seed',
        reason: 'seed_test_event',
      }),
    ],
  );

  const bootstrap = await bootstrapWorld();
  if (!bootstrap.skipped) {
    console.log(`Bootstrapped ${bootstrap.created} machines for subnet ${bootstrap.subnetId}.`);
  }

  const backfilled = await backfillMachineSecurity();
  if (backfilled > 0) {
    console.log(`Backfilled security components for ${backfilled} machines.`);
  }

  const backfilledLocations = await backfillMachineLocation();
  if (backfilledLocations > 0) {
    console.log(`Backfilled geographic coordinates for ${backfilledLocations} machines.`);
  }

  const backfilledPasswords = await backfillMachinePasswords({ regenerateAll: true });
  if (backfilledPasswords > 0) {
    console.log(`Regenerated root passwords for ${backfilledPasswords} machines.`);
  }
}

export async function seedTestAuditEvent(accountId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO audit_log (event_type, account_id, payload)
     VALUES ('ownership_transfer', $1, $2::jsonb)`,
    [
      accountId,
      JSON.stringify({
        from_account_id: null,
        to_account_id: accountId,
        ipv6: '2001:db8:1:7::test',
        reason: 'seed_test_event',
      }),
    ],
  );
}

if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .then(() => {
      console.log('Seed completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
