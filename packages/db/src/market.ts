import type { PoolClient } from 'pg';
import { getPool } from './pool.js';
import { debitAccount } from './economy.js';
import { installTool, listInstalledTools } from './rigTools.js';

export interface MarketItem {
  toolId: string;
  price: number;
}

export async function listMarketCatalog(): Promise<MarketItem[]> {
  const pool = getPool();
  const result = await pool.query<{ tool_id: string; price: number }>(
    `SELECT tool_id, price FROM market_catalog WHERE active = true ORDER BY tool_id`,
  );
  return result.rows.map((row) => ({ toolId: row.tool_id, price: row.price }));
}

export async function purchaseMarketItem(
  accountId: string,
  toolId: string,
): Promise<{ toolId: string; price: number; balance: number }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const catalog = await client.query<{ price: number }>(
      `SELECT price FROM market_catalog WHERE tool_id = $1 AND active = true FOR UPDATE`,
      [toolId],
    );
    const price = catalog.rows[0]?.price;
    if (price == null) {
      throw new MarketError('item_not_found', 'Tool not available in market');
    }

    const installed = await listInstalledTools(accountId);
    if (installed.includes(toolId)) {
      throw new MarketError('already_owned', 'Tool already installed on rig');
    }

    const account = await client.query<{ crypto_balance: number }>(
      `SELECT crypto_balance FROM accounts WHERE id = $1 FOR UPDATE`,
      [accountId],
    );
    const balance = account.rows[0]?.crypto_balance ?? 0;
    if (balance < price) {
      throw new MarketError('insufficient_funds', 'Not enough crypto for this purchase');
    }

    await debitAccount(client, accountId, price, `market_purchase:${toolId}`);
    await installTool(client, accountId, toolId);

    const updated = await client.query<{ crypto_balance: number }>(
      'SELECT crypto_balance FROM accounts WHERE id = $1',
      [accountId],
    );

    await client.query('COMMIT');
    return { toolId, price, balance: updated.rows[0]?.crypto_balance ?? 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function fluctuateMarketPrices(
  client: PoolClient,
  volatility: number,
): Promise<number> {
  const result = await client.query(
    `UPDATE market_catalog
     SET price = GREATEST(1, ROUND(price * (1 + ((random() * 2 - 1) * $1::float))))
     WHERE active = true`,
    [volatility],
  );
  return result.rowCount ?? 0;
}

export class MarketError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MarketError';
  }
}
