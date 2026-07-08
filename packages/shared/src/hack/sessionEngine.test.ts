import { describe, it, expect, beforeEach } from 'vitest';
import {
  connectSession,
  tickSession,
  handleRunTool,
  handleShellCommand,
  handleClaim,
  advanceSessionTime,
  resetTraceBalanceCache,
  type HackSessionState,
  type TargetMachineContext,
} from './sessionEngine.js';
import { loadToolsCatalog, loadTraceBalance } from './balanceLoader.js';

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
    handleRunTool(session, 'cracker_l1', tools, session.createdAtMs, balance);
    handleRunTool(session, 'port_opener_l1', tools, session.createdAtMs + 1, balance);
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
