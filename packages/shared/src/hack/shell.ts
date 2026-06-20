import type { HackSessionState } from './sessionTypes.js';

export interface ShellResult {
  output: string;
  accessChanged?: boolean;
  alarmDisabled?: boolean;
  exfilLoot?: { label: string; lootType: 'data' | 'credentials' | 'source_code' };
  failedExploit?: boolean;
}

export function executeShellCommand(session: HackSessionState, rawCommand: string): ShellResult {
  const command = rawCommand.trim().toLowerCase();
  if (!command) {
    return { output: '' };
  }

  if (command === 'help') {
    return {
      output: buildHelp(session),
    };
  }

  if (command === 'ls') {
    return { output: '/home/guest\n/etc\n/var/log\n/opt/data' };
  }

  if (command.startsWith('cat ')) {
    const path = command.slice(4).trim();
    if (path === '/etc/motd' || path === 'etc/motd') {
      const motd =
        session.target.osArchetypeId === 'cheap_server'
          ? 'CheapServer OS 1.0 — "Security through simplicity"'
          : `${session.target.osArchetypeId} — keep out`;
      return { output: motd };
    }
    return { output: `cat: ${path}: No such file` };
  }

  if (command === 'assume superuser backdoor') {
    if (session.target.osArchetypeId !== 'cheap_server') {
      return { output: 'Unknown command.', failedExploit: true };
    }
    session.shellAccessLevel = 'root';
    return { output: 'Access granted. UID 0.', accessChanged: true };
  }

  if (command === 'disable alarm' || command === 'kill alarm_daemon') {
    if (session.shellAccessLevel !== 'root') {
      return { output: 'Permission denied.', failedExploit: true };
    }
    session.alarmDisabled = true;
    session.target.alarmActive = false;
    session.tracing = false;
    return { output: 'Alarm daemon stopped.', alarmDisabled: true };
  }

  if (command.startsWith('exfil ')) {
    if (session.shellAccessLevel === 'guest') {
      return { output: 'Permission denied.', failedExploit: true };
    }
    const file = command.slice(6).trim();
    if (!file) {
      return { output: 'Usage: exfil <filename>' };
    }
    const lootType = inferLootType(file);
    session.lootCollected.push(file);
    return {
      output: `Exfiltrated ${file} to rig storage.`,
      exfilLoot: { label: file, lootType },
    };
  }

  if (command === 'whoami') {
    return { output: session.shellAccessLevel };
  }

  return { output: `Unknown command: ${rawCommand.split(/\s+/)[0]}`, failedExploit: true };
}

function buildHelp(session: HackSessionState): string {
  const base = 'Available: help, ls, cat, whoami, exfil';
  if (session.target.osArchetypeId === 'cheap_server') {
    return `${base}, assume`;
  }
  if (session.shellAccessLevel === 'root') {
    return `${base}, disable alarm`;
  }
  return base;
}

function inferLootType(filename: string): 'data' | 'credentials' | 'source_code' {
  if (filename.includes('credential') || filename.endsWith('.db')) return 'credentials';
  if (filename.includes('source') || filename.endsWith('.zip')) return 'source_code';
  return 'data';
}

export function shellPrompt(session: HackSessionState): string {
  const host = session.target.ipv6;
  const user = session.shellAccessLevel === 'root' ? 'root' : 'guest';
  return `${user}@${host}> `;
}
