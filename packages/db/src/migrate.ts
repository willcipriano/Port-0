import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../migrations');

export async function runMigrations(): Promise<string[]> {
  const pool = getPool();
  const applied: string[] = [];

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const existing = await pool.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      await client.query('COMMIT');
      applied.push(version);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return applied;
}

if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then((applied) => {
      if (applied.length === 0) {
        console.log('No new migrations.');
      } else {
        console.log(`Applied migrations: ${applied.join(', ')}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
