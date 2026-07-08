import { describe, expect, it } from 'vitest';
import type { TraceBalance } from './balanceLoader.js';
import type { HackSessionState } from './sessionTypes.js';
import { connectSession, tickSession } from './sessionEngine.js';
import {
  canRollTraceProbe,
  computeTraceProbeChance,
  hasActiveProbeTools,
  rollTraceProbe,
} from './traceProbe.js';
import type { Tool } from '../types/tool.js';

const TEST_BALANCE: TraceBalance = {
  baseSeconds: 180,
  heatMultiplierPerLevel: 0.05,
  blockerExtensionSeconds: 120,
  failedExploitBumpSeconds: 15,
  idleTimeoutMinutes: 30,
  commandRateLimitPerSecond: 5,
  factionMultipliers: { shady: 1.2, criminal: 1.0, government: 0.85 },
  punishment: {
    hospitalBaseMinutes: 5,
    hospitalFine: 50,
    prisonBaseMinutes: 10,
    prisonFine: 200,
    escalationMultiplier: 1.5,
    confiscateIllegalOnPrison: true,
  },
  illegalToolCategories: ['cracker', 'port_opener', 'trace_blocker', 'log_cleaner'],
  probeBasePerTick: 0.02,
  probeAlarmLevelMultiplier: 0.25,
};

function baseSession(overrides: Partial<HackSessionState> = {}): HackSessionState {
  return {
    id: 'sess-1',
    accountId: 'acct-1',
    target: {
      id: 'machine-1',
      ipv6: '2001:db8:1:7::2',
      osArchetypeId: 'corp_workstation',
      securityComponents: {
        password: 3,
        firewall: 3,
        alarm: 3,
        encryption: 2,
        antivirus: 2,
      },
      faction: 'criminal',
      alarmActive: true,
      isLandmark: true,
      rootPassword: 's3cr3t',
    },
    lifecycle: 'connected',
    shellAccessLevel: 'guest',
    tracing: false,
    traceExpiresAtMs: null,
    traceStartedAtMs: null,
    blockerExtensionsMs: 0,
    passwordCracked: false,
    firewallOpened: false,
    alarmDisabled: false,
    runningTools: [],
    installedToolIds: ['cracker_l1'],
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
    ...overrides,
  };
}

const CRACKER_RUN: HackSessionState['runningTools'][number] = {
  runId: 'run-1',
  toolId: 'cracker_l1',
  category: 'cracker',
  startedAtMs: 1_000,
  durationMs: 60_000,
  progressMs: 0,
  ramCost: 2,
  cpuCost: 2,
  completed: false,
  cancelled: false,
  effectApplied: false,
};

const MOCK_TOOLS: Tool[] = [
  {
    id: 'cracker_l1',
    name: 'Auth Cracker L1',
    category: 'cracker',
    maxSecurityLevel: 3,
    ramCost: 2,
    cpuCost: 2,
    durationSeconds: 60,
    targetType: 'password',
    marketPrice: 75,
    description: 'test',
  },
];

describe('rollTraceProbe', () => {
  it('does not roll when no active hacking tools', () => {
    const session = baseSession();
    expect(hasActiveProbeTools(session)).toBe(false);
    expect(canRollTraceProbe(session)).toBe(false);
    expect(rollTraceProbe(session, TEST_BALANCE, () => 0)).toBe(false);
  });

  it('does not roll when already tracing', () => {
    const session = baseSession({
      tracing: true,
      runningTools: [CRACKER_RUN],
    });
    expect(canRollTraceProbe(session)).toBe(false);
  });

  it('does not roll when alarm is disabled', () => {
    const session = baseSession({
      alarmDisabled: true,
      runningTools: [CRACKER_RUN],
    });
    expect(canRollTraceProbe(session)).toBe(false);
  });

  it('ignores trace_blocker-only runs for probe eligibility', () => {
    const session = baseSession({
      runningTools: [{
        ...CRACKER_RUN,
        toolId: 'trace_blocker_l1',
        category: 'trace_blocker',
      }],
    });
    expect(hasActiveProbeTools(session)).toBe(false);
  });

  it('higher alarm level increases probe chance', () => {
    const low = baseSession({
      target: {
        ...baseSession().target,
        securityComponents: {
          password: 1,
          firewall: 1,
          alarm: 1,
          encryption: 1,
          antivirus: 1,
        },
      },
      runningTools: [CRACKER_RUN],
    });
    const high = baseSession({ runningTools: [CRACKER_RUN] });
    expect(computeTraceProbeChance(high, TEST_BALANCE))
      .toBeGreaterThan(computeTraceProbeChance(low, TEST_BALANCE));
  });

  it('succeeds when rng is below computed chance', () => {
    const session = baseSession({ runningTools: [CRACKER_RUN] });
    const chance = computeTraceProbeChance(session, TEST_BALANCE);
    expect(rollTraceProbe(session, TEST_BALANCE, () => chance - 0.001)).toBe(true);
    expect(rollTraceProbe(session, TEST_BALANCE, () => chance + 0.001)).toBe(false);
  });
});

describe('connectSession', () => {
  it('never traces immediately on corp_workstation connect', () => {
    const result = connectSession({
      sessionId: 'sess-1',
      accountId: 'acct-1',
      target: {
        id: 'machine-1',
        ipv6: '2001:db8:1:7::2',
        osArchetypeId: 'corp_workstation',
        securityComponents: {
          password: 3,
          firewall: 3,
          alarm: 3,
          encryption: 2,
          antivirus: 2,
        },
        faction: 'criminal',
        alarmActive: true,
        isLandmark: true,
        rootPassword: 's3cr3t',
      },
      rig: { cpu: 4, ram: 8, installedToolIds: ['cracker_l1'] },
      subnetHeatLevel: 0,
      nowMs: 1_000,
    }, TEST_BALANCE);

    expect(result.state.tracing).toBe(false);
    const started = result.messages.find(m => m.type === 'session_started');
    expect(started && started.type === 'session_started' && started.tracing).toBe(false);
  });
});

describe('tickSession catch', () => {
  it('cancels incomplete tools when trace expires', () => {
    const session = baseSession({
      tracing: true,
      traceStartedAtMs: 0,
      traceExpiresAtMs: 1_000,
      runningTools: [CRACKER_RUN],
    });

    const result = tickSession(session, 2_000, MOCK_TOOLS, TEST_BALANCE, () => 1);

    expect(result.caught).toBe(true);
    expect(session.runningTools[0]?.cancelled).toBe(true);
    expect(result.messages.some(m => m.type === 'tool_cancelled')).toBe(true);
  });
});
