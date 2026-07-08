export function hashSeed(input: string): number {
  let seed = 5381;
  for (let i = 0; i < input.length; i += 1) {
    seed = ((seed * 33) ^ input.charCodeAt(i)) >>> 0;
  }
  return seed;
}

/** Stable semi-random crack estimate (10–15s band) from target IPv6. */
export function rollCrackEstimate(seed: string, serverSeconds?: number): number {
  if (serverSeconds !== undefined && serverSeconds > 0) {
    return Math.round(serverSeconds);
  }
  const h = hashSeed(seed.toLowerCase());
  const base = 10 + (h % 6);
  const jitter = ((h >>> 8) % 100) / 100 * 0.3 - 0.15;
  const raw = base * (1 + jitter);
  return Math.max(10, Math.min(15, Math.round(raw * 10) / 10));
}

export function formatDurationSeconds(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${s}s`;
}

export function formatEstimateDisplay(seconds: number): string {
  const low = Math.max(10, Math.floor(seconds - 1));
  const high = Math.min(15, Math.ceil(seconds + 1));
  if (high - low >= 3) {
    return `~${low}–${high}s`;
  }
  const rounded = Math.round(seconds);
  return `~${rounded}s`;
}

export function crackRemainingSeconds(durationSeconds: number, progressPercent: number): number {
  return Math.max(0, Math.ceil(durationSeconds * (100 - progressPercent) / 100));
}

export interface CrackRaceEstimate {
  crackRemainingSeconds: number;
  traceRemainingSeconds: number;
  unlikelyToFinish: boolean;
  marginSeconds: number;
}

export function estimateCrackRace(
  crackRemainingSeconds: number,
  tracing: boolean,
  traceRemainingSeconds: number,
): CrackRaceEstimate | null {
  if (!tracing) return null;
  const marginSeconds = traceRemainingSeconds - crackRemainingSeconds;
  return {
    crackRemainingSeconds,
    traceRemainingSeconds,
    unlikelyToFinish: crackRemainingSeconds > traceRemainingSeconds,
    marginSeconds,
  };
}

/** Fake throughput readout for cheap-tool flair (kH/s). */
export function fakeThroughputKh(progressPercent: number, seed: string): number {
  const h = hashSeed(seed) % 900;
  const base = 120 + h;
  const load = 0.4 + (progressPercent / 100) * 0.9;
  return Math.round(base * load);
}

export const ESTIMATE_CALC_DELAY_MS = 2500;
