import { describe, expect, it } from 'vitest';
import { loadToolsCatalog } from './balanceLoader.js';
import type { HackSessionState } from './sessionTypes.js';
import {
  computeToolDurationMs,
  firewallPenaltyMultiplier,
  getEffectiveFirewallLevel,
} from './tools.js';
import {
  iceDisruptionChancePerSecond,
  shouldIceDisrupt,
} from './ice.js';

describe('computeToolDurationMs', () => {
  const tools = loadToolsCatalog();
  const cracker = tools.find(t => t.id === 'cracker_l1')!;

  it('cracker L1 completes in about 12 wall-clock seconds', () => {
    expect(computeToolDurationMs(cracker, 1)).toBe(12_000);
  });
});

describe('firewallPenaltyMultiplier', () => {
  it('level -1 adds no penalty', () => {
    expect(firewallPenaltyMultiplier(-1)).toBe(1);
  });

  it('level 0 adds 10%', () => {
    expect(firewallPenaltyMultiplier(0)).toBe(1.1);
  });

  it('level 5 adds 60%', () => {
    expect(firewallPenaltyMultiplier(5)).toBe(1.6);
  });
});

describe('getEffectiveFirewallLevel', () => {
  function sessionWith(
    firewall: number,
    runs: HackSessionState['runningTools'] = [],
  ): HackSessionState {
    return {
      id: 'sess-1',
      accountId: 'acct-1',
      target: {
        id: 'machine-1',
        ipv6: '2001:db8:1:7::10',
        osArchetypeId: 'cheap_server',
        securityComponents: {
          password: 1,
          firewall,
          alarm: 1,
          encryption: 0,
          antivirus: 0,
        },
        faction: 'shady',
        alarmActive: true,
        isLandmark: false,
        rootPassword: 'h4ckm3',
      },
      lifecycle: 'connected',
      shellAccessLevel: 'guest',
      tracing: false,
      traceExpiresAtMs: null,
      traceStartedAtMs: null,
      blockerExtensionsMs: 0,
      passwordCracked: false,
      alarmDisabled: false,
      runningTools: runs,
      installedToolIds: ['anti_firewall_l1'],
      rigCpu: 4,
      rigRam: 8,
      rigCpuUsed: 0,
      rigRamUsed: 0,
      subnetHeatLevel: 0,
      lastActivityAtMs: 1_000,
      commandTimestampsMs: [],
      commandLog: [],
      lootCollected: [],
      createdAtMs: 1_000,
      lastTickMs: 1_000,
    };
  }

  it('returns raw level when no dampener is active', () => {
    expect(getEffectiveFirewallLevel(sessionWith(3))).toBe(3);
  });

  it('returns raw level when dampener is still warming', () => {
    const session = sessionWith(3, [{
      runId: 'run-1',
      toolId: 'anti_firewall_l1',
      category: 'anti_firewall',
      startedAtMs: 1_000,
      durationMs: 12_000,
      progressMs: 6_000,
      ramCost: 2,
      cpuCost: 2,
      completed: false,
      cancelled: false,
      effectApplied: false,
      warmedUp: false,
    }]);
    expect(getEffectiveFirewallLevel(session)).toBe(3);
  });

  it('reduces level by 1 when dampener is warmed up', () => {
    const session = sessionWith(3, [{
      runId: 'run-1',
      toolId: 'anti_firewall_l1',
      category: 'anti_firewall',
      startedAtMs: 1_000,
      durationMs: 12_000,
      progressMs: 12_000,
      ramCost: 2,
      cpuCost: 2,
      completed: false,
      cancelled: false,
      effectApplied: true,
      warmedUp: true,
    }]);
    expect(getEffectiveFirewallLevel(session)).toBe(2);
  });

  it('can reach effective level -1 on firewall 0 targets', () => {
    const session = sessionWith(0, [{
      runId: 'run-1',
      toolId: 'anti_firewall_l1',
      category: 'anti_firewall',
      startedAtMs: 1_000,
      durationMs: 4_000,
      progressMs: 4_000,
      ramCost: 2,
      cpuCost: 2,
      completed: false,
      cancelled: false,
      effectApplied: true,
      warmedUp: true,
    }]);
    expect(getEffectiveFirewallLevel(session)).toBe(-1);
    expect(firewallPenaltyMultiplier(getEffectiveFirewallLevel(session))).toBe(1);
  });
});

describe('iceDisruptionChancePerSecond', () => {
  it('returns 0 for ICE level 0', () => {
    expect(iceDisruptionChancePerSecond(0)).toBe(0);
  });

  it('increases chance with ICE level', () => {
    const l1 = iceDisruptionChancePerSecond(1);
    const l3 = iceDisruptionChancePerSecond(3);
    const l5 = iceDisruptionChancePerSecond(5);
    expect(l1).toBeGreaterThan(0);
    expect(l3).toBeGreaterThan(l1);
    expect(l5).toBeGreaterThan(l3);
  });
});

describe('shouldIceDisrupt', () => {
  it('never disrupts at ICE level 0', () => {
    expect(shouldIceDisrupt(0, 1, () => 0)).toBe(false);
  });

  it('succeeds when rng is below computed chance', () => {
    const chance = 1 - Math.pow(1 - iceDisruptionChancePerSecond(3), 1);
    expect(shouldIceDisrupt(3, 1, () => chance - 0.001)).toBe(true);
    expect(shouldIceDisrupt(3, 1, () => chance + 0.001)).toBe(false);
  });
});
