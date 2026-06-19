import { describe, it, expect } from 'vitest';
import { isActionBlocked, blockedReason } from './accountStatus.js';

describe('account status gates', () => {
  it('allows active accounts', () => {
    expect(isActionBlocked('active', 'hack')).toBe(false);
    expect(isActionBlocked('active', 'scan')).toBe(false);
  });

  it('blocks hospital hacking and sieges', () => {
    expect(isActionBlocked('hospital', 'hack')).toBe(true);
    expect(isActionBlocked('hospital', 'siege_attack')).toBe(true);
    expect(isActionBlocked('hospital', 'scan')).toBe(false);
    expect(isActionBlocked('hospital', 'market')).toBe(false);
  });

  it('blocks prison scans and market purchases', () => {
    expect(isActionBlocked('prison', 'scan')).toBe(true);
    expect(isActionBlocked('prison', 'market_buy')).toBe(true);
    expect(isActionBlocked('prison', 'fleet_mgmt')).toBe(false);
  });

  it('returns readable blocked reason', () => {
    expect(blockedReason('prison', 'scan')).toContain('prison');
  });
});
