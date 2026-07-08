import { describe, expect, it } from 'vitest';
import {
  crackRemainingSeconds,
  estimateCrackRace,
  formatEstimateDisplay,
  rollCrackEstimate,
} from './crackTiming.js';

describe('crackTiming', () => {
  it('computes remaining crack time from progress', () => {
    expect(crackRemainingSeconds(12, 0)).toBe(12);
    expect(crackRemainingSeconds(12, 50)).toBe(6);
    expect(crackRemainingSeconds(12, 100)).toBe(0);
  });

  it('flags unlikely finish when crack ETA exceeds trace', () => {
    const race = estimateCrackRace(15, true, 10)!;
    expect(race.unlikelyToFinish).toBe(true);
    expect(race.marginSeconds).toBe(-5);
  });

  it('reports positive margin when trace outlasts crack', () => {
    const race = estimateCrackRace(8, true, 45)!;
    expect(race.unlikelyToFinish).toBe(false);
    expect(race.marginSeconds).toBe(37);
  });

  it('rollCrackEstimate is stable for the same ipv6', () => {
    const a = rollCrackEstimate('2001:db8:1:7::3');
    const b = rollCrackEstimate('2001:db8:1:7::3');
    expect(a).toBe(b);
  });

  it('rollCrackEstimate stays in 10–15s band', () => {
    for (let i = 0; i < 50; i += 1) {
      const est = rollCrackEstimate(`2001:db8:1:7::${i}`);
      expect(est).toBeGreaterThanOrEqual(10);
      expect(est).toBeLessThanOrEqual(15);
    }
  });

  it('prefers serverSeconds when provided', () => {
    expect(rollCrackEstimate('2001:db8::1', 12)).toBe(12);
  });

  it('formatEstimateDisplay shows range or single value', () => {
    expect(formatEstimateDisplay(11)).toMatch(/~11s|~10–/);
  });
});
