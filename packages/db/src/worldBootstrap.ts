import { generateSubnet, DEFAULT_WORLD_SEED } from '@port0/shared';
import { getPool } from './pool.js';
import { insertMachineRow } from './machines.js';

export interface BootstrapWorldOptions {
  seed?: number;
  force?: boolean;
}

export interface BootstrapWorldResult {
  created: number;
  skipped: boolean;
  subnetId: string;
  seed: number;
}

export async function countMachines(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM machines');
  return Number(result.rows[0]?.count ?? 0);
}

export async function bootstrapWorld(options: BootstrapWorldOptions = {}): Promise<BootstrapWorldResult> {
  const pool = getPool();
  const seed = options.seed ?? DEFAULT_WORLD_SEED;
  const existing = await countMachines();

  if (existing > 0 && !options.force) {
    const subnetRow = await pool.query<{ id: string }>('SELECT id FROM world_subnets LIMIT 1');
    return {
      created: 0,
      skipped: true,
      subnetId: subnetRow.rows[0]?.id ?? 'unknown',
      seed,
    };
  }

  if (options.force && existing > 0) {
    await pool.query('DELETE FROM machines');
  }

  const generated = generateSubnet({ seed });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const machine of generated.machines) {
      await insertMachineRow(client, machine);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    created: generated.machines.length,
    skipped: false,
    subnetId: generated.subnetId,
    seed,
  };
}

if (process.argv[1]?.includes('worldBootstrap')) {
  const force = process.argv.includes('--force');
  const seedArg = process.argv.find((a) => a.startsWith('--seed='));
  const seed = seedArg ? Number(seedArg.split('=')[1]) : undefined;

  bootstrapWorld({ force, seed })
    .then((result) => {
      if (result.skipped) {
        console.log(`World bootstrap skipped (${result.subnetId} already has machines).`);
      } else {
        console.log(`World bootstrap complete: ${result.created} machines (seed=${result.seed}).`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
