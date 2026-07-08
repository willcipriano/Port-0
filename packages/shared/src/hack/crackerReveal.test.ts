import { describe, expect, it } from 'vitest';
import {
  computeCrackerRevealCount,
  computeCrackerRevealedPrefix,
} from './crackerReveal.js';

describe('crackerReveal', () => {
  const password = 'abcdefghijklmnop'; // 16 chars

  it('reveals nothing before 5%', () => {
    expect(computeCrackerRevealCount(0, 16)).toBe(0);
    expect(computeCrackerRevealCount(4, 16)).toBe(0);
    expect(computeCrackerRevealedPrefix(password, 4)).toBe('');
  });

  it('reveals at least one char after 5%', () => {
    expect(computeCrackerRevealCount(5, 16)).toBeGreaterThanOrEqual(1);
    expect(computeCrackerRevealedPrefix(password, 5).length).toBeGreaterThanOrEqual(1);
  });

  it('reveals full password at 95%+', () => {
    expect(computeCrackerRevealCount(95, 16)).toBe(16);
    expect(computeCrackerRevealedPrefix(password, 100)).toBe(password);
  });

  it('prefix is always a substring of the real password', () => {
    for (let p = 0; p <= 100; p += 5) {
      const prefix = computeCrackerRevealedPrefix(password, p);
      expect(password.startsWith(prefix)).toBe(true);
    }
  });

  it('reveal count never decreases as progress increases', () => {
    let prev = 0;
    for (let p = 0; p <= 100; p += 1) {
      const count = computeCrackerRevealCount(p, 24);
      expect(count).toBeGreaterThanOrEqual(prev);
      prev = count;
    }
  });
});
