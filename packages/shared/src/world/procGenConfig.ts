import type { OsArchetypeId } from '../types/machine.js';

export interface ArchetypeWeight {
  id: OsArchetypeId;
  weight: number;
}

/** MVP proc-gen weights from plan 2.2 */
export const MVP_ARCHETYPE_WEIGHTS: ArchetypeWeight[] = [
  { id: 'cheap_server', weight: 60 },
  { id: 'generic_linux', weight: 30 },
  { id: 'corp_workstation', weight: 7 },
  { id: 'mainframe', weight: 3 },
];

export const L1_COMPONENT_RANGE = { min: 1, max: 2 } as const;

export const RESOURCE_RANGES: Record<
  OsArchetypeId,
  { cpu: [number, number]; ram: [number, number]; storage: [number, number] }
> = {
  cheap_server: { cpu: [1, 2], ram: [2, 4], storage: [20, 50] },
  generic_linux: { cpu: [2, 4], ram: [4, 8], storage: [50, 100] },
  corp_workstation: { cpu: [4, 8], ram: [8, 16], storage: [100, 250] },
  mainframe: { cpu: [8, 16], ram: [16, 32], storage: [250, 500] },
};

/** Default seed for dev/staging reproducibility */
export const DEFAULT_WORLD_SEED = 0x7ead7070;
