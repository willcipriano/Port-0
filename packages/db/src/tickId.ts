export const TICK_INTERVAL_SECONDS = Number(process.env.TICK_INTERVAL_MINUTES ?? 15) * 60;

export function currentTickId(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TICK_INTERVAL_SECONDS);
}
