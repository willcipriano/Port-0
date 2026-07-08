import { describe, expect, it } from 'vitest';
import { mockPasswordLevelForNode, passwordLevelSummary } from './passwordLevelLabel.js';

describe('passwordLevelSummary', () => {
  it('maps levels 1–5 to expected labels', () => {
    expect(passwordLevelSummary(1)).toBe('L1 weak');
    expect(passwordLevelSummary(2)).toBe('L2 mixed');
    expect(passwordLevelSummary(3)).toBe('L3 hardened');
    expect(passwordLevelSummary(4)).toBe('L4 hardened');
    expect(passwordLevelSummary(5)).toBe('L5 hardened');
  });

  it('clamps out-of-range values', () => {
    expect(passwordLevelSummary(0)).toBe('L1 weak');
    expect(passwordLevelSummary(9)).toBe('L5 hardened');
  });
});

describe('mockPasswordLevelForNode', () => {
  it('returns archetype defaults for non-tier-1 types', () => {
    expect(mockPasswordLevelForNode('2001:db8:1:7::2', 'corp_workstation')).toBe(3);
    expect(mockPasswordLevelForNode('2001:db8:1:7::ac', 'mainframe')).toBe(3);
    expect(mockPasswordLevelForNode('2001:db8:1:7::a3', 'generic_linux')).toBe(2);
  });

  it('returns stable 1 or 2 for cheap_server', () => {
    const a = mockPasswordLevelForNode('2001:db8:1:7::a1', 'cheap_server');
    const b = mockPasswordLevelForNode('2001:db8:1:7::a1', 'cheap_server');
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(2);
    expect(a).toBe(b);
  });
});
