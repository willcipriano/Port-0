import { loadEconomyBalance, loadHeatBalance } from '@port0/shared';
import type { PoolClient } from 'pg';
import { creditAccount, saveAccountTickSummary } from './economy.js';
import { deliverScansForTick } from './scans.js';
import { fluctuateMarketPrices } from './market.js';

export interface AccountTickDelta {
  balanceChange: number;
  passiveIncome: number;
  upkeep: number;
  scanResults?: Array<{ ipv6: string; osArchetypeId: string; zoneContext: string }>;
}

export interface TickStepContext {
  tickId: number;
  client: PoolClient;
  accountDeltas: Map<string, AccountTickDelta>;
}

export interface TickStep {
  name: string;
  run(ctx: TickStepContext): Promise<void>;
}

function ensureDelta(ctx: TickStepContext, accountId: string): AccountTickDelta {
  let delta = ctx.accountDeltas.get(accountId);
  if (!delta) {
    delta = { balanceChange: 0, passiveIncome: 0, upkeep: 0 };
    ctx.accountDeltas.set(accountId, delta);
  }
  return delta;
}

export const deliverScansStep: TickStep = {
  name: 'DeliverScans',
  async run(ctx) {
    const delivered = await deliverScansForTick(ctx.client, ctx.tickId);
    for (const [accountId, { results }] of delivered) {
      const delta = ensureDelta(ctx, accountId);
      delta.scanResults = results;
    }
  },
};

export const passiveIncomeStep: TickStep = {
  name: 'PassiveIncome',
  async run(ctx) {
    const economy = loadEconomyBalance();
    const rows = await ctx.client.query<{ owner_account_id: string; drone_count: string }>(
      `SELECT owner_account_id, COUNT(*)::text AS drone_count
       FROM machine_ownership
       GROUP BY owner_account_id`,
    );

    for (const row of rows.rows) {
      const income = Number(row.drone_count) * economy.passiveIncomePerDronePerTick;
      if (income <= 0) continue;
      const balance = await creditAccount(
        ctx.client,
        row.owner_account_id,
        income,
        'passive_income',
        ctx.tickId,
      );
      const delta = ensureDelta(ctx, row.owner_account_id);
      delta.passiveIncome += income;
      delta.balanceChange += income;
      void balance;
    }
  },
};

export const deductUpkeepStep: TickStep = {
  name: 'DeductUpkeep',
  async run(ctx) {
    const economy = loadEconomyBalance();
    const rows = await ctx.client.query<{ owner_account_id: string; drone_count: string }>(
      `SELECT owner_account_id, COUNT(*)::text AS drone_count
       FROM machine_ownership
       GROUP BY owner_account_id`,
    );

    for (const row of rows.rows) {
      const upkeep = Number(row.drone_count) * economy.upkeepPerDronePerTick;
      if (upkeep <= 0) continue;
      await creditAccount(ctx.client, row.owner_account_id, -upkeep, 'drone_upkeep', ctx.tickId);
      const delta = ensureDelta(ctx, row.owner_account_id);
      delta.upkeep += upkeep;
      delta.balanceChange -= upkeep;
    }
  },
};

export const updateMarketPricesStep: TickStep = {
  name: 'UpdateMarketPrices',
  async run(ctx) {
    const economy = loadEconomyBalance();
    await fluctuateMarketPrices(ctx.client, economy.marketPriceVolatility);
  },
};

export const decayHeatStep: TickStep = {
  name: 'DecayHeat',
  async run(ctx) {
    const heat = loadHeatBalance();
    await ctx.client.query(
      `UPDATE world_subnets
       SET heat_level = GREATEST($1, heat_level - $2)`,
      [heat.floorBaseline, heat.decayPerTick],
    );
  },
};

export const moveStocksStep: TickStep = {
  name: 'MoveStocks',
  async run() {
    // Stage 4.5 — stock random walk and price history
  },
};

export const generateMissionHooksStep: TickStep = {
  name: 'GenerateMissionHooks',
  async run() {
    // Stage 4.5/4.6 — contract hooks from stock drops
  },
};

export const resolveSiegesStep: TickStep = {
  name: 'ResolveSieges',
  async run() {
    // Stage 5 — siege resolution ticks
  },
};

export const TICK_STEPS: TickStep[] = [
  deliverScansStep,
  passiveIncomeStep,
  deductUpkeepStep,
  updateMarketPricesStep,
  moveStocksStep,
  decayHeatStep,
  generateMissionHooksStep,
  resolveSiegesStep,
];

export async function finalizeAccountSummaries(ctx: TickStepContext): Promise<void> {
  for (const [accountId, delta] of ctx.accountDeltas) {
    if (
      delta.balanceChange === 0 &&
      delta.passiveIncome === 0 &&
      delta.upkeep === 0 &&
      !delta.scanResults
    ) {
      continue;
    }
    await saveAccountTickSummary(ctx.client, accountId, ctx.tickId, {
      balanceChange: delta.balanceChange,
      passiveIncome: delta.passiveIncome,
      upkeep: delta.upkeep,
      scanResults: delta.scanResults ?? null,
    });
  }
}
