export interface AppDef {
  id: string;
  title: string;
  shortTitle: string;
  icon: string;
  description: string;
}

export const APP_REGISTRY: AppDef[] = [
  { id: 'world',    title: 'WORLD MAP',         shortTitle: 'WORLD',    icon: '[MAP]', description: 'Subnet topology & scan targets' },
  { id: 'servers',  title: 'SERVER LIST',        shortTitle: 'SERVERS',  icon: '[SRV]', description: 'Discovered & owned machines' },
  { id: 'terminal', title: 'TERMINAL',            shortTitle: 'TERM',     icon: '[>_ ]', description: 'Remote shell session' },
  { id: 'hardware', title: 'HARDWARE // RIG',     shortTitle: 'RIG',      icon: '[CPU]', description: 'Rig stats & process manager' },
  { id: 'filesystem', title: 'LOCAL RIG // FS',   shortTitle: 'FS',       icon: '[DISK]', description: 'Local rig storage map & files' },
  { id: 'email',    title: 'EMAIL // CONTRACTS',  shortTitle: 'EMAIL',    icon: '[MSG]', description: 'NPC jobs & contract inbox' },
  { id: 'vault',    title: 'PASSWORD VAULT',      shortTitle: 'VAULT',    icon: '[KEY]', description: 'Stored cracked credentials' },
];
