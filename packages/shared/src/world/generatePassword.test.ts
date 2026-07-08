import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';
import { deriveRootPasswordFromIpv6, generateRootPassword } from './generatePassword.js';

describe('generateRootPassword', () => {
  it('is deterministic for the same rng sequence', () => {
    const a = generateRootPassword(createRng(42), 1);
    const b = generateRootPassword(createRng(42), 1);
    expect(a).toBe(b);
  });

  it('scales length with security level', () => {
    const low = generateRootPassword(createRng(99), 1);
    const high = generateRootPassword(createRng(99), 4);
    expect(low.length).toBeGreaterThanOrEqual(12);
    expect(low.length).toBeLessThanOrEqual(16);
    expect(high.length).toBeGreaterThanOrEqual(24);
    expect(high.length).toBeLessThanOrEqual(38);
  });

  it('derives stable password from ipv6', () => {
    const p1 = deriveRootPasswordFromIpv6('2001:db8:1:7::3', 2);
    const p2 = deriveRootPasswordFromIpv6('2001:db8:1:7::3', 2);
    expect(p1).toBe(p2);
    expect(p1.length).toBeGreaterThan(0);
  });
});
