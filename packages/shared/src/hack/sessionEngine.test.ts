import { describe, it, expect, beforeEach } from 'vitest';
import {
  connectSession,
  tickSession,
  handleRunTool,
  handleShellCommand,
  handleCancelTool,
  handleClaim,
  advanceSessionTime,
  resetTraceBalanceCache,
  type HackSessionState,
  type TargetMachineContext,
} from './sessionEngine.js';
import { loadToolsCatalog, loadTraceBalance } from './balanceLoader.js';
import { getEffectiveFirewallLevel } from './tools.js';

const tools = loadToolsCatalog();
const balance = loadTraceBalance();

function makeTarget(overrides: Partial<TargetMachineContext> = {}): TargetMachineContext {
  return {
    id: 'machine-1',
    ipv6: '2001:db8:1:7::10',
    osArchetypeId: 'corp_workstation',
    securityComponents: {
      password: 1,
      firewall: 1,
      alarm: 2,
      encryption: 0,
      antivirus: 0,
    },
    faction: 'government',
    alarmActive: true,
    isLandmark: false,
    rootPassword: 'h4ckm3',
    ...overrides,
  };
}

function connect(target: TargetMachineContext, nowMs = 1_000_000): HackSessionState {
  resetTraceBalanceCache();
  return connectSession(
    {
      sessionId: 'sess-1',
      accountId: 'acct-1',
      target,
      rig: { cpu: 4, ram: 8, installedToolIds: tools.map((t) => t.id) },
      subnetHeatLevel: 0,
      nowMs,
    },
    balance,
  ).state;
}

function triggerTrace(session: HackSessionState, nowMs = session.lastTickMs + 1_000): void {
  tickSession(session, nowMs, tools, balance, () => 0);
}

describe('hack session engine', () => {
  beforeEach(() => {
    resetTraceBalanceCache();
  });

  it('does not trace immediately on connect', () => {
    const session = connect(makeTarget());
    expect(session.tracing).toBe(false);
    expect(session.lifecycle).toBe('connected');
  });

  it('rejects insufficient tool level', () => {
    const session = connect(makeTarget({ securityComponents: { password: 3, firewall: 1, alarm: 2, encryption: 0, antivirus: 0 } }));
    const result = handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    expect(result.messages[0]).toMatchObject({
      type: 'error',
      code: 'insufficient_tool_level',
      message: 'Insufficient tool level',
    });
  });

  it('rejects second tool when RAM exhausted', () => {
    const session = connect(
      makeTarget({
        osArchetypeId: 'cheap_server',
        faction: 'shady',
        securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 },
      }),
    );
    session.rigRam = 4;
    session.rigCpu = 8;
    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    handleRunTool(session, 'anti_firewall_l1', tools, session.createdAtMs + 1, balance);
    const third = handleRunTool(session, 'log_cleaner_l1', tools, session.createdAtMs + 2, balance);
    expect(third.messages[0]).toMatchObject({
      type: 'error',
      code: 'insufficient_resources',
      message: 'Insufficient RAM',
    });
  });

  it('happy path: backdoor, disable alarm, claim', () => {
    const session = connect(
      makeTarget({
        osArchetypeId: 'cheap_server',
        faction: 'shady',
        securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 },
      }),
    );

    const backdoor = handleShellCommand(session, 'assume superuser backdoor', session.createdAtMs, balance);
    expect(backdoor.messages[0]).toMatchObject({ type: 'shell_output', output: expect.stringContaining('Access granted') });

    handleShellCommand(session, 'disable alarm', session.lastTickMs, balance);
    const claim = handleClaim(session, session.lastTickMs, balance);
    expect(claim.messages[0]).toMatchObject({ type: 'claim_result', success: true });
  });

  it('extends trace deadline while trace blocker is running', () => {
    const session = connect(
      makeTarget({
        osArchetypeId: 'cheap_server',
        faction: 'shady',
        securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 },
      }),
    );
    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    triggerTrace(session);
    const blocker = handleRunTool(session, 'trace_blocker_l1', tools, session.createdAtMs + 1, balance);
    expect(blocker.messages[0]?.type).toBe('tool_started');
    expect(session.tracing).toBe(true);
    expect(session.runningTools.some((r) => r.category === 'trace_blocker')).toBe(true);

    const initialExpiry = session.traceExpiresAtMs!;
    tickSession(session, session.lastTickMs + 5_000, tools, balance);
    expect(session.traceExpiresAtMs).toBeGreaterThan(initialExpiry);
  });

  it('spec worked example: blocker extends trace before cracker finishes', () => {
    const session = connect(
      makeTarget({
        osArchetypeId: 'cheap_server',
        faction: 'shady',
        securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 },
      }),
    );
    expect(session.tracing).toBe(false);

    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    triggerTrace(session);
    expect(session.tracing).toBe(true);
    const initialExpiry = session.traceExpiresAtMs!;

    const blocker = handleRunTool(session, 'trace_blocker_l1', tools, session.createdAtMs + 1, balance);
    expect(blocker.messages[0]?.type).toBe('tool_started');

    advanceSessionTime(session, 110_000, tools, balance);
    expect(session.traceExpiresAtMs).toBeGreaterThan(initialExpiry);

    advanceSessionTime(session, 400_000, tools, balance);
    expect(session.traceExpiresAtMs).toBeGreaterThan(initialExpiry);
    expect(session.passwordCracked).toBe(true);

    handleShellCommand(session, 'assume superuser backdoor', session.lastTickMs, balance);
    handleShellCommand(session, 'disable alarm', session.lastTickMs, balance);
    expect(session.tracing).toBe(false);

    const caught = tickSession(session, session.traceExpiresAtMs! - 1, tools, balance);
    expect(caught.caught).toBeFalsy();
  });

  it('trace expiry marks session caught', () => {
    const session = connect(makeTarget({ faction: 'shady' }));
    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    triggerTrace(session);
    const result = tickSession(session, session.traceExpiresAtMs! + 1, tools, balance);
    expect(result.caught).toBe(true);
    expect(session.lifecycle).toBe('caught');
  });

  it('cheap_server backdoor grants root without password tool', () => {
    const session = connect(
      makeTarget({
        osArchetypeId: 'cheap_server',
        faction: 'shady',
        securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 },
      }),
    );
    expect(session.tracing).toBe(false);
    handleShellCommand(session, 'assume superuser backdoor', session.createdAtMs, balance);
    expect(session.shellAccessLevel).toBe('root');
  });

  it('includes target firewall level on session start', () => {
    const session = connect(makeTarget({ securityComponents: { password: 1, firewall: 3, alarm: 1, encryption: 0, antivirus: 0 } }));
    const result = connectSession(
      {
        sessionId: 'sess-fw',
        accountId: 'acct-1',
        target: makeTarget({ securityComponents: { password: 1, firewall: 3, alarm: 1, encryption: 0, antivirus: 0 } }),
        rig: { cpu: 4, ram: 8, installedToolIds: tools.map((t) => t.id) },
        subnetHeatLevel: 0,
        nowMs: 1_000_000,
      },
      balance,
    );
    const started = result.messages.find(m => m.type === 'session_started');
    expect(started).toMatchObject({ targetFirewallLevel: 3 });
    expect(session.target.securityComponents.firewall).toBe(3);
  });

  it('anti-firewall warms up without completing', () => {
    const session = connect(makeTarget({ securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 } }));
    handleRunTool(session, 'anti_firewall_l1', tools, session.createdAtMs, balance);
    const run = session.runningTools[0]!;
    tickSession(session, session.lastTickMs + 5_000, tools, balance);
    expect(run.warmedUp).toBe(true);
    expect(run.completed).toBe(false);
  });

  it('rejects duplicate anti-firewall runs', () => {
    const session = connect(makeTarget({ securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 } }));
    handleRunTool(session, 'anti_firewall_l1', tools, session.createdAtMs, balance);
    const second = handleRunTool(session, 'anti_firewall_l1', tools, session.createdAtMs + 1, balance);
    expect(second.messages[0]).toMatchObject({
      type: 'error',
      code: 'already_running',
    });
  });

  it('cracker duration increases with firewall level and drops when dampener is active', () => {
    const session = connect(makeTarget({ securityComponents: { password: 1, firewall: 2, alarm: 1, encryption: 0, antivirus: 0 } }));
    const withoutDampener = handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    const withoutSeconds = withoutDampener.messages.find(m => m.type === 'tool_started')?.durationSeconds;

    const dampened = connect(makeTarget({ securityComponents: { password: 1, firewall: 2, alarm: 1, encryption: 0, antivirus: 0 } }));
    handleRunTool(dampened, 'anti_firewall_l1', tools, dampened.createdAtMs, balance);
    tickSession(dampened, dampened.lastTickMs + 10_000, tools, balance);
    expect(dampened.runningTools[0]?.warmedUp).toBe(true);

    const withDampener = handleRunTool(dampened, 'cracker_l1', tools, dampened.createdAtMs + 1, balance);
    const withSeconds = withDampener.messages.find(m => m.type === 'tool_started')?.durationSeconds;
    expect(withoutSeconds).toBeDefined();
    expect(withSeconds).toBeDefined();
    expect(withoutSeconds!).toBeGreaterThan(withSeconds!);
  });

  it('cancelling dampener restores firewall penalty on next tool start', () => {
    const session = connect(makeTarget({ securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 } }));
    handleRunTool(session, 'anti_firewall_l1', tools, session.createdAtMs, balance);
    tickSession(session, session.lastTickMs + 10_000, tools, balance);
    const runId = session.runningTools[0]!.runId;
    handleCancelTool(session, runId, session.lastTickMs + 1, balance);

    const penalized = handleRunTool(session, 'cracker_l1', tools, session.lastTickMs + 2, balance);
    const baseline = connect(makeTarget({ securityComponents: { password: 1, firewall: 1, alarm: 1, encryption: 0, antivirus: 0 } }));
    const baselineStart = handleRunTool(baseline, 'cracker_l1', tools, baseline.createdAtMs, balance);
    const penalizedSeconds = penalized.messages.find(m => m.type === 'tool_started')?.durationSeconds;
    const baselineSeconds = baselineStart.messages.find(m => m.type === 'tool_started')?.durationSeconds;
    expect(penalizedSeconds).toBe(baselineSeconds);
  });
});

describe('ICE disruption', () => {
  function iceTarget(ice: number, overrides: Partial<TargetMachineContext> = {}): TargetMachineContext {
    return makeTarget({
      alarmActive: false,
      securityComponents: {
        password: 1,
        firewall: 1,
        alarm: 1,
        encryption: 0,
        antivirus: 0,
        ice,
      },
      ...overrides,
    });
  }

  it('ICE level 0 never disrupts', () => {
    const session = connect(iceTarget(0));
    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    const initialDuration = session.runningTools[0]!.durationMs;
    for (let i = 0; i < 20; i += 1) {
      tickSession(session, session.lastTickMs + 1_000, tools, balance, () => 0);
    }
    expect(session.runningTools[0]!.durationMs).toBe(initialDuration);
    expect(session.runningTools[0]!.iceDisruptionCount ?? 0).toBe(0);
  });

  it('includes targetIceLevel on session start', () => {
    const result = connectSession(
      {
        sessionId: 'sess-ice',
        accountId: 'acct-1',
        target: iceTarget(3),
        rig: { cpu: 4, ram: 8, installedToolIds: tools.map((t) => t.id) },
        subnetHeatLevel: 0,
        nowMs: 1_000_000,
      },
      balance,
    );
    const started = result.messages.find(m => m.type === 'session_started');
    expect(started).toMatchObject({ targetIceLevel: 3 });
  });

  it('ICE disconnects a warmed-up Firewall Dampener', () => {
    const session = connect(iceTarget(5));
    handleRunTool(session, 'anti_firewall_l1', tools, session.createdAtMs, balance);
    tickSession(session, session.lastTickMs + 10_000, tools, balance, () => 1);
    expect(session.runningTools[0]!.warmedUp).toBe(true);
    expect(getEffectiveFirewallLevel(session)).toBe(0);

    const result = tickSession(session, session.lastTickMs + 1_000, tools, balance, () => 0);
    const disrupted = result.messages.find(m => m.type === 'tool_disrupted');
    expect(disrupted).toMatchObject({
      type: 'tool_disrupted',
      toolId: 'anti_firewall_l1',
      reason: 'ice',
      disruptionKind: 'disconnect',
    });
    expect(session.runningTools[0]!.cancelled).toBe(true);
    expect(getEffectiveFirewallLevel(session)).toBe(1);
  });

  it('player can run dampener again after ICE disruption', () => {
    const session = connect(iceTarget(5));
    handleRunTool(session, 'anti_firewall_l1', tools, session.createdAtMs, balance);
    tickSession(session, session.lastTickMs + 10_000, tools, balance, () => 1);
    tickSession(session, session.lastTickMs + 1_000, tools, balance, () => 0);
    expect(session.runningTools[0]!.cancelled).toBe(true);

    const retry = handleRunTool(session, 'anti_firewall_l1', tools, session.lastTickMs + 1, balance);
    expect(retry.messages[0]?.type).toBe('tool_started');
  });

  it('ICE disruption of cracker adds delay without completing or cancelling', () => {
    const session = connect(iceTarget(3));
    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    const run = session.runningTools[0]!;
    const initialDuration = run.durationMs;

    const result = tickSession(session, session.lastTickMs + 1_000, tools, balance, () => 0);
    const disrupted = result.messages.find(m => m.type === 'tool_disrupted');
    expect(disrupted).toMatchObject({
      type: 'tool_disrupted',
      toolId: 'cracker_l1',
      reason: 'ice',
      disruptionKind: 'bad_character',
    });
    expect(run.durationMs).toBeGreaterThan(initialDuration);
    expect(run.completed).toBe(false);
    expect(run.cancelled).toBe(false);
  });

  it('disruption cooldown prevents repeated disruptions every tick', () => {
    const session = connect(iceTarget(5));
    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    const run = session.runningTools[0]!;

    tickSession(session, session.lastTickMs + 1_000, tools, balance, () => 0);
    expect(run.iceDisruptionCount).toBe(1);

    tickSession(session, session.lastTickMs + 1_000, tools, balance, () => 0);
    expect(run.iceDisruptionCount).toBe(1);

    tickSession(session, session.lastTickMs + 5_000, tools, balance, () => 0);
    expect(run.iceDisruptionCount).toBe(2);
  });
});

describe('trace balance', () => {
  it('government targets trace faster than shady once probe triggers', () => {
    const shady = connect(makeTarget({ faction: 'shady', securityComponents: { password: 1, firewall: 1, alarm: 2, encryption: 0, antivirus: 0 } }));
    const gov = connect(makeTarget({ faction: 'government' }));
    handleRunTool(shady, 'cracker_l1', tools, shady.createdAtMs, balance);
    handleRunTool(gov, 'cracker_l1', tools, gov.createdAtMs, balance);
    triggerTrace(shady);
    triggerTrace(gov);
    const shadyDuration = shady.traceExpiresAtMs! - shady.traceStartedAtMs!;
    const govDuration = gov.traceExpiresAtMs! - gov.traceStartedAtMs!;
    expect(govDuration).toBeLessThan(shadyDuration);
  });
});

describe('punishment mapping', () => {
  it('uses hospital for shady and prison for government factions', async () => {
    const { punishmentForFaction } = await import('./faction.js');
    expect(punishmentForFaction('shady')).toBe('hospital');
    expect(punishmentForFaction('government')).toBe('prison');
  });
});
