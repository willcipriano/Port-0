import { describe, it, expect } from 'vitest';
import { loadEconomyBalance, loadHeatBalance } from './balanceLoader.js';

describe('economy balance loader', () => {
  it('loads economy tick rates from content', () => {
    const economy = loadEconomyBalance();
    expect(economy.passiveIncomePerDronePerTick).toBe(10);
    expect(economy.upkeepPerDronePerTick).toBe(5);
    expect(economy.machinesPerScan).toBe(5);
    expect(economy.lootSellPrice).toBe(25);
  });

  it('loads heat decay settings from content', () => {
    const heat = loadHeatBalance();
    expect(heat.heatPerCaughtHack).toBe(5);
    expect(heat.decayPerTick).toBe(1);
    expect(heat.floorBaseline).toBe(0);
  });
});
