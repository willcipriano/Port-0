import type { TraceBalance } from './balanceLoader.js';
import type { TargetFaction } from './sessionTypes.js';

export function heatMultiplier(heatLevel: number, balance: TraceBalance): number {
  return 1 + heatLevel * balance.heatMultiplierPerLevel;
}

export function factionMultiplier(faction: TargetFaction, balance: TraceBalance): number {
  return balance.factionMultipliers[faction] ?? 1;
}

/** Initial trace duration in milliseconds after alarm triggers. */
export function computeInitialTraceMs(
  faction: TargetFaction,
  heatLevel: number,
  balance: TraceBalance,
): number {
  const seconds =
    balance.baseSeconds * heatMultiplier(heatLevel, balance) * factionMultiplier(faction, balance);
  return Math.max(1, Math.round(seconds * 1000));
}

export function traceProgressSeconds(
  traceStartedAtMs: number,
  nowMs: number,
  traceExpiresAtMs: number,
): number {
  const totalMs = traceExpiresAtMs - traceStartedAtMs;
  if (totalMs <= 0) return 0;
  const elapsedMs = Math.max(0, nowMs - traceStartedAtMs);
  return Math.min(totalMs / 1000, elapsedMs / 1000);
}

export function traceRemainingSeconds(traceExpiresAtMs: number, nowMs: number): number {
  return Math.max(0, (traceExpiresAtMs - nowMs) / 1000);
}

export function isTraceExpired(traceExpiresAtMs: number | null, nowMs: number): boolean {
  return traceExpiresAtMs !== null && nowMs >= traceExpiresAtMs;
}

export function extendTraceDeadline(
  traceExpiresAtMs: number,
  extensionMs: number,
  nowMs: number,
): number {
  return Math.max(traceExpiresAtMs, nowMs) + extensionMs;
}

export function accelerateTrace(
  traceExpiresAtMs: number,
  bumpMs: number,
  nowMs: number,
): number {
  const floor = nowMs + 1000;
  return Math.max(floor, traceExpiresAtMs - bumpMs);
}
