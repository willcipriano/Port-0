import type { ArchetypeFileEntry, LandmarkFileEntry, SubnetFileEntry } from '../content/schemas.js';
import type { MachineResources, OsArchetypeId, SecurityComponents } from '../types/machine.js';
import { loadWorldContent, type WorldContent } from './contentLoader.js';
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

function buildLandmarkMachine(landmark: LandmarkFileEntry, archetypes: Map<string, ArchetypeFileEntry>): GeneratedMachine {
  const archetype = archetypes.get(landmark.os_archetype_id);
  if (!archetype) {
    throw new Error(`Landmark ${landmark.id} references unknown archetype ${landmark.os_archetype_id}`);
  }
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
  return {
    ipv6: allocator.allocateNext().toLowerCase(),
    osArchetypeId,
    securityComponents: rollSecurity(rng, archetype),
    resources: rollResources(rng, osArchetypeId),
    isLandmark: false,
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

  const landmarkMachines = landmarks.map((l) => buildLandmarkMachine(l, archetypes));
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
