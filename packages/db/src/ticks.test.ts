import { describe, it, expect } from 'vitest';
import { currentTickId, TICK_INTERVAL_SECONDS } from './ticks.js';

describe('tick idempotency helpers', () => {
  it('computes stable tick id for a window', () => {
    const tickSeconds = TICK_INTERVAL_SECONDS;
    const now = tickSeconds * 1000 * 5 + 1000;
    expect(currentTickId(now)).toBe(5);
    expect(currentTickId(now + tickSeconds * 1000 - 2000)).toBe(5);
    expect(currentTickId(now + tickSeconds * 1000)).toBe(6);
  });
});
