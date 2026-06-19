export type OsArchetypeId =
  | 'cheap_server'
  | 'generic_linux'
  | 'corp_workstation'
  | 'mainframe';

export interface SecurityComponents {
  password: number;
  firewall: number;
  alarm: number;
  encryption: number;
  antivirus: number;
}

export interface MachineResources {
  cpu: number;
  ram: number;
  storage: number;
}

export interface Machine {
  ipv6: string;
  osArchetypeId: OsArchetypeId;
  securityComponents: SecurityComponents;
  resources: MachineResources;
  ownerAccountId?: string;
  claimedAt?: string;
  isLandmark: boolean;
  landmarkId?: string;
}

/** Public fingerprint returned before full recon */
export interface MachineFingerprint {
  ipv6: string;
  osArchetypeId: OsArchetypeId;
  securitySummary: string;
  isLandmark: boolean;
}
