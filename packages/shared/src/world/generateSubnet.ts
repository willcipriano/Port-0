import type { ArchetypeFileEntry, LandmarkFileEntry, SubnetFileEntry } from '../content/schemas.js';
import type { MachineResources, OsArchetypeId, SecurityComponents } from '../types/machine.js';
import { loadWorldContent, type WorldContent } from './contentLoader.js';
import { GEO_ANCHORS, GEO_ANCHOR_TOTAL_WEIGHT, type GeoAnchor } from './geoAnchors.js';
import { createIpv6Allocator } from './ipv6Allocator.js';
import {
  L1_COMPONENT_RANGE,
  MVP_ARCHETYPE_WEIGHTS,
  RESOURCE_RANGES,
  type ArchetypeWeight,
} from './procGenConfig.js';
import { DEFAULT_WORLD_SEED } from './procGenConfig.js';
import { createRng, type Rng } from './rng.js';

export interface GeneratedMachine {
  ipv6: string;
  osArchetypeId: OsArchetypeId;
  securityComponents: SecurityComponents;
  resources: MachineResources;
  isLandmark: boolean;
  landmarkId?: string;
  /** Physical geographic location — independent of subnet / IPv6 address */
  latitude: number;
  longitude: number;
}

export interface GenerateSubnetOptions {
  seed?: number;
  content?: WorldContent;
}

export interface GeneratedSubnet {
  subnetId: string;
  prefix: string;
  procGenCount: number;
  landmarkCount: number;
  machines: GeneratedMachine[];
  seed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pick a city anchor by weight, then jitter position within ~300 km.
 * Uses a Box-Muller approximation via two uniform draws from the seeded RNG
 * so the result is fully deterministic and independent of IPv6 allocation.
 * Jitter stddev ≈ 2.5° (~275 km); clamped to valid lat/lng ranges.
 */
function rollLocation(rng: Rng): { latitude: number; longitude: number } {
  // Weighted anchor pick
  let roll = rng.next() * GEO_ANCHOR_TOTAL_WEIGHT;
  let anchor: GeoAnchor = GEO_ANCHORS[GEO_ANCHORS.length - 1]!;
  for (const a of GEO_ANCHORS) {
    roll -= a.weight;
    if (roll <= 0) { anchor = a; break; }
  }
  // Box-Muller for Gaussian jitter (~2.5° stddev)
  const u1 = Math.max(1e-10, rng.next());
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const jitterScale = 2.5;
  return {
    latitude:  clamp(anchor.lat + z * jitterScale, -85, 85),
    longitude: clamp(anchor.lng + z * jitterScale, -180, 180),
  };
}

function weightedArchetypePick(rng: Rng, weights: ArchetypeWeight[]): OsArchetypeId {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng.next() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return weights[weights.length - 1]!.id;
}

function rollResources(rng: Rng, archetypeId: OsArchetypeId): MachineResources {
  const range = RESOURCE_RANGES[archetypeId];
  return {
    cpu: rng.int(range.cpu[0], range.cpu[1]),
    ram: rng.int(range.ram[0], range.ram[1]),
    storage: rng.int(range.storage[0], range.storage[1]),
  };
}

function rollSecurity(rng: Rng, archetype: ArchetypeFileEntry): SecurityComponents {
  const defaults = archetype.default_security;
  if (archetype.tier === 1) {
    return {
      password: rng.int(L1_COMPONENT_RANGE.min, L1_COMPONENT_RANGE.max),
      firewall: rng.int(L1_COMPONENT_RANGE.min, L1_COMPONENT_RANGE.max),
      alarm: rng.int(L1_COMPONENT_RANGE.min, L1_COMPONENT_RANGE.max),
      encryption: defaults.encryption,
      antivirus: defaults.antivirus,
    };
  }

  return {
    password: clamp(defaults.password + rng.int(-1, 1), 1, 5),
    firewall: clamp(defaults.firewall + rng.int(-1, 1), 1, 5),
    alarm: clamp(defaults.alarm + rng.int(-1, 1), 1, 5),
    encryption: clamp(defaults.encryption + rng.int(-1, 1), 0, 5),
    antivirus: clamp(defaults.antivirus + rng.int(-1, 1), 0, 5),
  };
}

function securityFromArchetype(archetype: ArchetypeFileEntry): SecurityComponents {
  return { ...archetype.default_security };
}

function buildLandmarkMachine(
  landmark: LandmarkFileEntry,
  archetypes: Map<string, ArchetypeFileEntry>,
  rng: Rng,
): GeneratedMachine {
  const archetype = archetypes.get(landmark.os_archetype_id);
  if (!archetype) {
    throw new Error(`Landmark ${landmark.id} references unknown archetype ${landmark.os_archetype_id}`);
  }
  // Use explicit coords from content if provided, otherwise roll from anchors
  const location =
    landmark.latitude !== undefined && landmark.longitude !== undefined
      ? { latitude: landmark.latitude, longitude: landmark.longitude }
      : rollLocation(rng);
  return {
    ipv6: landmark.ipv6.toLowerCase(),
    osArchetypeId: landmark.os_archetype_id,
    securityComponents: securityFromArchetype(archetype),
    resources: {
      cpu: RESOURCE_RANGES[landmark.os_archetype_id].cpu[1],
      ram: RESOURCE_RANGES[landmark.os_archetype_id].ram[1],
      storage: RESOURCE_RANGES[landmark.os_archetype_id].storage[1],
    },
    isLandmark: true,
    landmarkId: landmark.id,
    ...location,
  };
}

function buildProcGenMachine(
  rng: Rng,
  allocator: ReturnType<typeof createIpv6Allocator>,
  archetypes: Map<string, ArchetypeFileEntry>,
  weights: ArchetypeWeight[],
): GeneratedMachine {
  const osArchetypeId = weightedArchetypePick(rng, weights);
  const archetype = archetypes.get(osArchetypeId);
  if (!archetype) {
    throw new Error(`Missing archetype definition for ${osArchetypeId}`);
  }
  // Roll location after archetype/security so physical coords are independent
  const location = rollLocation(rng);
  return {
    ipv6: allocator.allocateNext().toLowerCase(),
    osArchetypeId,
    securityComponents: rollSecurity(rng, archetype),
    resources: rollResources(rng, osArchetypeId),
    isLandmark: false,
    ...location,
  };
}

export function generateSubnet(options: GenerateSubnetOptions = {}): GeneratedSubnet {
  const content = options.content ?? loadWorldContent();
  const seed = options.seed ?? DEFAULT_WORLD_SEED;
  const rng = createRng(seed);

  const { subnet, archetypes: archetypeList, landmarks } = content;
  const archetypes = new Map(archetypeList.map((a) => [a.id, a]));

  const landmarkAddresses = landmarks.map((l) => l.ipv6.toLowerCase());
  const allocator = createIpv6Allocator(subnet.ipv6_prefix, landmarkAddresses);

  const landmarkMachines = landmarks.map((l) => buildLandmarkMachine(l, archetypes, rng));
  const procGenMachines: GeneratedMachine[] = [];
  for (let i = 0; i < subnet.machine_count; i += 1) {
    procGenMachines.push(buildProcGenMachine(rng, allocator, archetypes, MVP_ARCHETYPE_WEIGHTS));
  }

  const machines = [...landmarkMachines, ...procGenMachines];

  return {
    subnetId: subnet.subnet_id,
    prefix: subnet.ipv6_prefix,
    procGenCount: procGenMachines.length,
    landmarkCount: landmarkMachines.length,
    machines,
    seed,
  };
}
