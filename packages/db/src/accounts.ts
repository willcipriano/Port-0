import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RigStats } from '@port0/shared';
import { getPool } from './pool.js';
import type { CreateAccountInput, DbAccount, DbAccountWithRig } from './types.js';
import { ensureStarterTools } from './rigTools.js';

function contentRoot(): string {
  if (process.env.CONTENT_DIR) return resolve(process.env.CONTENT_DIR);
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../content');
}

export async function findAccountByOAuth(
  provider: string,
  sub: string,
): Promise<DbAccountWithRig | null> {
  const pool = getPool();
  const result = await pool.query<DbAccountWithRig>(
    `SELECT a.*, r.cpu, r.ram, r.storage, r.bandwidth, r.cyberware
     FROM accounts a
     JOIN rigs r ON r.account_id = a.id
     WHERE a.oauth_provider = $1 AND a.oauth_sub = $2`,
    [provider, sub],
  );
  return result.rows[0] ?? null;
}

export async function findAccountById(accountId: string): Promise<DbAccountWithRig | null> {
  const pool = getPool();
  const result = await pool.query<DbAccountWithRig>(
    `SELECT a.*, r.cpu, r.ram, r.storage, r.bandwidth, r.cyberware
     FROM accounts a
     JOIN rigs r ON r.account_id = a.id
     WHERE a.id = $1`,
    [accountId],
  );
  return result.rows[0] ?? null;
}

export async function createAccount(input: CreateAccountInput): Promise<DbAccountWithRig> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const accountResult = await client.query<DbAccount>(
      `INSERT INTO accounts (oauth_provider, oauth_sub, display_handle, crypto_balance, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [input.oauthProvider, input.oauthSub, input.displayHandle ?? null, input.cryptoBalance],
    );
    const account = accountResult.rows[0];
    await client.query(
      `INSERT INTO rigs (account_id, cpu, ram, storage, bandwidth, cyberware)
       VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)`,
      [
        account.id,
        input.rigStats.cpu,
        input.rigStats.ram,
        input.rigStats.storage,
        input.rigStats.bandwidth,
      ],
    );
    await client.query('COMMIT');
    await ensureStarterTools(account.id);
    const created = await findAccountById(account.id);
    if (!created) throw new Error('Failed to load created account');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrCreateDevAccount(accountId: string): Promise<DbAccountWithRig> {
  const byId = await findAccountById(accountId);
  if (byId) {
    await ensureStarterTools(byId.id);
    return byId;
  }

  const byOAuth = await findAccountByOAuth('github', `dev:${accountId}`);
  if (byOAuth) {
    await ensureStarterTools(byOAuth.id);
    return byOAuth;
  }

  const defaults = loadDefaultRigAndBalance();
  return createAccount({
    oauthProvider: 'github',
    oauthSub: `dev:${accountId}`,
    displayHandle: 'dev_operator',
    cryptoBalance: defaults.starterCrypto,
    rigStats: defaults.rigStats,
  });
}

export function loadDefaultRigAndBalance(): { rigStats: RigStats; starterCrypto: number } {
  const root = contentRoot();
  const rig = JSON.parse(readFileSync(resolve(root, 'balance/rig.json'), 'utf8')) as RigStats & {
    balance_version: string;
  };
  const economy = JSON.parse(readFileSync(resolve(root, 'balance/economy.json'), 'utf8')) as {
    starter_crypto: number;
  };
  return {
    rigStats: {
      cpu: rig.cpu,
      ram: rig.ram,
      storage: rig.storage,
      bandwidth: rig.bandwidth,
    },
    starterCrypto: economy.starter_crypto,
  };
}

export async function storeRefreshSession(
  accountId: string,
  refreshTokenHash: string,
  expiresAt: Date,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO auth_sessions (account_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [accountId, refreshTokenHash, expiresAt],
  );
}

export async function findValidRefreshSession(
  refreshTokenHash: string,
): Promise<{ id: string; account_id: string } | null> {
  const pool = getPool();
  const result = await pool.query<{ id: string; account_id: string }>(
    `SELECT id, account_id FROM auth_sessions
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [refreshTokenHash],
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshSession(sessionId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId],
  );
}

export async function revokeAllAccountSessions(accountId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE account_id = $1 AND revoked_at IS NULL`,
    [accountId],
  );
}

export async function clearExpiredAccountStatus(accountId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE accounts
     SET status = 'active', status_expires_at = NULL
     WHERE id = $1 AND status_expires_at IS NOT NULL AND status_expires_at <= NOW()`,
    [accountId],
  );
}
