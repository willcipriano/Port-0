import type { OsArchetypeId } from '../types/machine.js';
import type { TargetFaction } from './sessionTypes.js';

const ARCHETYPE_FACTION: Record<OsArchetypeId, TargetFaction> = {
  cheap_server: 'shady',
  generic_linux: 'criminal',
  corp_workstation: 'government',
  mainframe: 'government',
};

export function factionFromArchetype(osArchetypeId: string): TargetFaction {
  return ARCHETYPE_FACTION[osArchetypeId as OsArchetypeId] ?? 'shady';
}

export function punishmentForFaction(faction: TargetFaction): 'hospital' | 'prison' {
  return faction === 'government' ? 'prison' : 'hospital';
}

export function defaultFilesystem(osArchetypeId: string): Record<string, unknown> {
  const base = {
    motd: 'Welcome.',
    files: [] as string[],
  };
  if (osArchetypeId === 'cheap_server') {
    return {
      ...base,
      motd: 'CheapServer OS 1.0 — "Security through simplicity"',
      files: ['credentials.txt', 'payroll.csv', 'source.zip'],
    };
  }
  if (osArchetypeId === 'corp_workstation') {
    return {
      ...base,
      motd: 'Corp Workstation — authorized access only',
      files: ['audit.log', 'credentials.db', 'finance_report.xlsx'],
    };
  }
  return {
    ...base,
    files: ['notes.txt', 'config.bak'],
  };
}
