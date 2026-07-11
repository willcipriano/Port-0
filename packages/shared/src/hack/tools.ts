import type { SecurityComponents } from '../types/machine.js';
import type { Tool } from '../types/tool.js';
import type { HackSessionState } from './sessionTypes.js';

export function findTool(tools: Tool[], toolId: string): Tool | undefined {
  return tools.find((t) => t.id === toolId);
}

export function targetComponentLevel(session: HackSessionState, tool: Tool): number {
  const components = session.target.securityComponents;
  switch (tool.targetType) {
    case 'password':
      return components.password;
    case 'firewall':
      return components.firewall;
    case 'service':
      return components.alarm;
    case 'logs':
      return components.alarm;
    case 'ownership':
      return 1;
    case 'subnet':
      return 1;
    default:
      return 1;
  }
}

export function validateToolLevel(tool: Tool, targetLevel: number): string | null {
  if (tool.maxSecurityLevel < targetLevel) {
    return 'Insufficient tool level';
  }
  return null;
}

/** Wall-clock duration at full CPU share (rate = cpuCost / rigCpu when running). */
export function computeToolDurationMs(tool: Tool, targetLevel: number): number {
  const levelFactor = Math.max(1, targetLevel);
  return Math.max(1000, tool.durationSeconds * levelFactor * 1_000);
}

/** Time multiplier from firewall level: level -1 = 0%, level 0 = +10%, level N = +(N+1)*10%. */
export function firewallPenaltyMultiplier(effectiveLevel: number): number {
  return 1 + (effectiveLevel + 1) * 0.10;
}

export function getEffectiveFirewallLevel(session: HackSessionState): number {
  const raw = session.target.securityComponents.firewall;
  const dampenerActive = session.runningTools.some(
    (run) => run.category === 'anti_firewall' && !run.cancelled && run.warmedUp,
  );
  return dampenerActive ? raw - 1 : raw;
}

export function computeResourceUsage(
  session: HackSessionState,
): { cpuUsed: number; ramUsed: number } {
  let cpuUsed = 0;
  let ramUsed = 0;
  for (const run of session.runningTools) {
    if (run.completed || run.cancelled) continue;
    cpuUsed += run.cpuCost;
    ramUsed += run.ramCost;
  }
  return { cpuUsed, ramUsed };
}

export function canAffordTool(session: HackSessionState, tool: Tool): string | null {
  const { cpuUsed, ramUsed } = computeResourceUsage(session);
  if (cpuUsed + tool.cpuCost > session.rigCpu) {
    return 'Insufficient CPU';
  }
  if (ramUsed + tool.ramCost > session.rigRam) {
    return 'Insufficient RAM';
  }
  return null;
}

export function toolOwned(session: HackSessionState, toolId: string): boolean {
  return session.installedToolIds.includes(toolId);
}

export function advanceRunningTools(session: HackSessionState, deltaMs: number, _rigCpu: number): void {
  if (deltaMs <= 0) return;
  const active = session.runningTools.filter((r) => !r.completed && !r.cancelled);
  if (active.length === 0) return;
  const totalCpu = active.reduce((sum, run) => sum + run.cpuCost, 0);
  for (const run of active) {
    const share = run.cpuCost / Math.max(1, totalCpu);
    run.progressMs = Math.min(run.durationMs, run.progressMs + deltaMs * share);
    if (run.progressMs >= run.durationMs) {
      if (run.category === 'anti_firewall') {
        run.warmedUp = true;
      } else {
        run.completed = true;
      }
    }
  }
}

export function toolProgressPercent(run: HackSessionState['runningTools'][number]): number {
  if (run.durationMs <= 0) return 100;
  return Math.min(100, Math.round((run.progressMs / run.durationMs) * 100));
}

export function applyToolEffect(
  session: HackSessionState,
  tool: Tool,
): { output: string; traceBump?: boolean; reconComplete?: boolean } {
  switch (tool.category) {
    case 'cracker':
      session.passwordCracked = true;
      if (session.shellAccessLevel === 'guest') {
        session.shellAccessLevel = 'user';
      }
      return { output: `Password cracked: ${session.target.rootPassword} — Access upgraded to ${session.shellAccessLevel}.` };
    case 'anti_firewall':
      return { output: 'Firewall dampener online — effective firewall reduced by 1 while active.' };
    case 'trace_blocker':
      return { output: 'Trace countermeasure deployed. Trace deadline extended.' };
    case 'recon':
      return {
        output: 'Recon probe complete — awaiting fingerprint analysis.',
        reconComplete: true,
      };
    case 'log_cleaner':
      return { output: 'Target logs scrubbed.' };
    case 'scanner':
      return { output: 'Subnet scan queued (results on next tick).' };
    default:
      return { output: `${tool.name} completed.` };
  }
}

export function updateAccessLifecycle(session: HackSessionState): void {
  const hasAccess =
    session.shellAccessLevel === 'root' ||
    session.shellAccessLevel === 'user' ||
    session.passwordCracked;

  if (hasAccess && session.lifecycle !== 'secured' && session.lifecycle !== 'claimed') {
    session.lifecycle = session.alarmDisabled ? 'secured' : 'access_gained';
  }

  if (session.alarmDisabled && session.shellAccessLevel === 'root') {
    session.tracing = false;
    if (session.lifecycle !== 'claimed') {
      session.lifecycle = 'secured';
    }
  }
}
