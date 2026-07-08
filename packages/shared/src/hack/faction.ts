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

export function defaultFilesystem(
  osArchetypeId: string,
  rootPassword?: string,
): Record<string, unknown> {
  const base = {
    motd: 'Welcome.',
    files: [] as string[],
    credentials: rootPassword ? { root_password: rootPassword } : undefined,
  };
  if (osArchetypeId === 'cheap_server') {
    return {
      ...base,
      motd: 'CheapServer OS 1.0 — "Security through simplicity"',
      files: ['credentials.txt', 'payroll.csv', 'source.zip'],
      credentials: { root_password: rootPassword ?? 'guest' },
    };
  }
  if (osArchetypeId === 'corp_workstation') {
    return {
      ...base,
      motd: 'Corp Workstation — authorized access only',
      files: ['audit.log', 'credentials.db', 'finance_report.xlsx'],
      credentials: { root_password: rootPassword ?? 'admin' },
    };
  }
  return {
    ...base,
    files: ['notes.txt', 'config.bak'],
    credentials: { root_password: rootPassword ?? 'root' },
  };
}

export function readRootPasswordFromFilesystem(filesystem: Record<string, unknown>): string {
  const creds = filesystem.credentials;
  if (creds && typeof creds === 'object' && creds !== null && 'root_password' in creds) {
    const pw = (creds as { root_password?: unknown }).root_password;
    if (typeof pw === 'string' && pw.length > 0) return pw;
  }
  return 'changeme';
}
