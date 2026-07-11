import { describe, it, expect } from 'vitest';
import { loadWorldContent, type WorldContent } from './contentLoader.js';
import { generateSubnet } from './generateSubnet.js';
import { createIpv6Allocator, formatHostAddress } from './ipv6Allocator.js';
import { DEFAULT_WORLD_SEED } from './procGenConfig.js';

function fixtureContent(overrides: Partial<WorldContent> = {}): WorldContent {
  const base = loadWorldContent();
  return {
    subnet: { ...base.subnet, machine_count: 10, ...overrides.subnet },
    archetypes: overrides.archetypes ?? base.archetypes,
    landmarks: overrides.landmarks ?? base.landmarks,
  };
}

describe('ipv6Allocator', () => {
  it('reserves landmark addresses before allocating proc-gen slots', () => {
    const prefix = '2001:db8:1:7::/64';
    const allocator = createIpv6Allocator(prefix, [
      '2001:db8:1:7::1',
      '2001:db8:1:7::2',
      '2001:db8:1:7::3',
    ]);

    expect(allocator.allocateNext()).toBe('2001:db8:1:7::4');
    expect(allocator.allocateNext()).toBe('2001:db8:1:7::5');
    expect(allocator.reservedCount()).toBe(3);
    expect(allocator.allocatedCount()).toBe(2);
  });

  it('formats host addresses within prefix', () => {
    expect(formatHostAddress('2001:db8:1:7::/64', 10)).toBe('2001:db8:1:7::a');
  });
});

describe('generateSubnet', () => {
  it('generates configured proc-gen count plus landmarks', () => {
    const content = fixtureContent({ subnet: { machine_count: 20 } as WorldContent['subnet'] });
    const result = generateSubnet({ content, seed: 42 });

    expect(result.procGenCount).toBe(20);
    expect(result.landmarkCount).toBe(content.landmarks.length);
    expect(result.machines).toHaveLength(20 + content.landmarks.length);
  });

  it('assigns unique IPv6 addresses', () => {
    const content = fixtureContent({ subnet: { machine_count: 50 } as WorldContent['subnet'] });
    const result = generateSubnet({ content, seed: 99 });
    const addresses = result.machines.map((m) => m.ipv6);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('preserves landmark slots at fixed addresses', () => {
    const content = fixtureContent({ subnet: { machine_count: 30 } as WorldContent['subnet'] });
    const result = generateSubnet({ content, seed: 1 });

    for (const landmark of content.landmarks) {
      const match = result.machines.find((m) => m.landmarkId === landmark.id);
      expect(match).toBeDefined();
      expect(match!.ipv6).toBe(landmark.ipv6.toLowerCase());
      expect(match!.isLandmark).toBe(true);
      expect(match!.osArchetypeId).toBe(landmark.os_archetype_id);
    }

    const procGen = result.machines.filter((m) => !m.isLandmark);
    for (const machine of procGen) {
      expect(content.landmarks.some((l) => l.ipv6.toLowerCase() === machine.ipv6)).toBe(false);
    }
  });

  it('is deterministic for the same seed', () => {
    const content = fixtureContent({ subnet: { machine_count: 25 } as WorldContent['subnet'] });
    const a = generateSubnet({ content, seed: DEFAULT_WORLD_SEED });
    const b = generateSubnet({ content, seed: DEFAULT_WORLD_SEED });
    expect(a.machines.map((m) => m.ipv6)).toEqual(b.machines.map((m) => m.ipv6));
    expect(a.machines.map((m) => m.osArchetypeId)).toEqual(b.machines.map((m) => m.osArchetypeId));
  });

  it('varies output when seed changes', () => {
    const content = fixtureContent({ subnet: { machine_count: 40 } as WorldContent['subnet'] });
    const a = generateSubnet({ content, seed: 1 });
    const b = generateSubnet({ content, seed: 2 });
    const aProc = a.machines.filter((m) => !m.isLandmark).map((m) => m.osArchetypeId);
    const bProc = b.machines.filter((m) => !m.isLandmark).map((m) => m.osArchetypeId);
    expect(aProc).not.toEqual(bProc);
  });

  it('respects L1 component range for cheap_server targets', () => {
    const content = fixtureContent({ subnet: { machine_count: 100 } as WorldContent['subnet'] });
    const result = generateSubnet({ content, seed: 7 });
    const cheap = result.machines.filter((m) => !m.isLandmark && m.osArchetypeId === 'cheap_server');
    expect(cheap.length).toBeGreaterThan(0);
    for (const machine of cheap) {
      expect(machine.securityComponents.password).toBeGreaterThanOrEqual(1);
      expect(machine.securityComponents.password).toBeLessThanOrEqual(2);
      expect(machine.securityComponents.firewall).toBeGreaterThanOrEqual(0);
      expect(machine.securityComponents.firewall).toBeLessThanOrEqual(2);
      expect(machine.securityComponents.alarm).toBeGreaterThanOrEqual(1);
      expect(machine.securityComponents.alarm).toBeLessThanOrEqual(2);
    }
  });

  it('generates full MVP subnet with 300 proc-gen machines', () => {
    const result = generateSubnet({ seed: DEFAULT_WORLD_SEED });
    expect(result.procGenCount).toBe(300);
    expect(result.landmarkCount).toBe(3);
    expect(result.machines).toHaveLength(303);
    expect(new Set(result.machines.map((m) => m.ipv6)).size).toBe(303);
  });

  it('generated ICE stays within 0-5', () => {
    const result = generateSubnet({ seed: DEFAULT_WORLD_SEED });
    for (const machine of result.machines) {
      const ice = machine.securityComponents.ice ?? 0;
      expect(ice).toBeGreaterThanOrEqual(0);
      expect(ice).toBeLessThanOrEqual(5);
    }
  });

  it('tier-1 cheap_server ICE stays within 0-1', () => {
    const content = fixtureContent({ subnet: { machine_count: 100 } as WorldContent['subnet'] });
    const result = generateSubnet({ content, seed: 7 });
    const cheap = result.machines.filter((m) => !m.isLandmark && m.osArchetypeId === 'cheap_server');
    expect(cheap.length).toBeGreaterThan(0);
    for (const machine of cheap) {
      const ice = machine.securityComponents.ice ?? 0;
      expect(ice).toBeGreaterThanOrEqual(0);
      expect(ice).toBeLessThanOrEqual(1);
    }
  });

  it('community_hub landmark has ICE 0', () => {
    const result = generateSubnet({ seed: DEFAULT_WORLD_SEED });
    const hub = result.machines.find((m) => m.landmarkId === 'community_hub');
    expect(hub).toBeDefined();
    expect(hub!.securityComponents.ice ?? 0).toBe(0);
  });
});
