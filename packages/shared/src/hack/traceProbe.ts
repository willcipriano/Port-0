import type { TraceBalance } from './balanceLoader.js';
import type { HackSessionState } from './sessionTypes.js';
import { factionMultiplier, heatMultiplier } from './trace.js';

const PROBE_CATEGORIES = new Set([
  'cracker',
  'port_opener',
  'recon',
  'log_cleaner',
  'exploit',
]);

export function hasActiveProbeTools(session: HackSessionState): boolean {
  return session.runningTools.some(
    (run) => !run.completed && !run.cancelled && PROBE_CATEGORIES.has(run.category),
  );
}

export function computeTraceProbeChance(
  session: HackSessionState,
  balance: TraceBalance,
): number {
  const alarmLevel = session.target.securityComponents.alarm;
  const heat = heatMultiplier(session.subnetHeatLevel, balance);
  const faction = factionMultiplier(session.target.faction, balance);
  const levelFactor = 1 + balance.probeAlarmLevelMultiplier * Math.max(0, alarmLevel - 1);
  const raw = balance.probeBasePerTick * levelFactor * heat * faction;
  return Math.min(1, Math.max(0, raw));
}

export function canRollTraceProbe(session: HackSessionState): boolean {
  return (
    !session.tracing
    && session.target.alarmActive
    && !session.alarmDisabled
    && hasActiveProbeTools(session)
  );
}

export function rollTraceProbe(
  session: HackSessionState,
  balance: TraceBalance,
  rng: () => number,
): boolean {
  if (!canRollTraceProbe(session)) return false;
  const chance = computeTraceProbeChance(session, balance);
  return rng() < chance;
}
