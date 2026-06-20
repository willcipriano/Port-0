import { describe, expect, it } from 'vitest';
import {
  computeSiegeResolution,
  computeVirusStorageDamage,
  type SiegeBalance,
} from './siege.js';
import { loadSiegeBalance } from './balanceLoader.js';

const balance: SiegeBalance = {
  resolveTicks: 1,
  interactiveWindowMinutes: 5,
  allowSiegeWithoutRecon: true,
  reconSuccessChance: 0.65,
  reconMinConfidence: 0.4,
  logAnalysisConfidence: 0.85,
  escalateCpuCost: 2,
  escalateAttackBonus: 3,
  countermeasureMpCost: 2,
  countermeasureDefenseBonus: 4,
  virusStorageDamageBase: 15,
  defenderPassiveFirewallWeight: 2,
  defenderPassiveAntivirusWeight: 1,
};

describe('computeSiegeResolution', () => {
  it('attacker wins when attack power exceeds defense', () => {
    const result = computeSiegeResolution({
      attackerCpu: 20,
      defenderCpu: 2,
      defenderFirewall: 1,
      defenderAntivirus: 0,
      virusStorageDamage: 30,
      escalations: 2,
      countermeasures: 0,
      defenderOffline: true,
      balance,
    });
    expect(result.winner).toBe('attacker');
    expect(result.outcomeScore).toBeGreaterThan(0);
  });

  it('defender wins when defense exceeds attack', () => {
    const result = computeSiegeResolution({
      attackerCpu: 2,
      defenderCpu: 10,
      defenderFirewall: 3,
      defenderAntivirus: 2,
      virusStorageDamage: 0,
      escalations: 0,
      countermeasures: 3,
      defenderOffline: false,
      balance,
    });
    expect(result.winner).toBe('defender');
    expect(result.outcomeScore).toBeLessThanOrEqual(0);
  });
});

describe('computeVirusStorageDamage', () => {
  it('reduces damage based on antivirus level', () => {
    const raw = computeVirusStorageDamage(2, 0, balance);
    const reduced = computeVirusStorageDamage(2, 3, balance);
    expect(reduced).toBeLessThan(raw);
    expect(reduced).toBeGreaterThanOrEqual(1);
  });
});

describe('loadSiegeBalance', () => {
  it('loads siege config from content', () => {
    const loaded = loadSiegeBalance();
    expect(loaded.interactiveWindowMinutes).toBeGreaterThan(0);
    expect(loaded.virusStorageDamageBase).toBeGreaterThan(0);
  });
});
