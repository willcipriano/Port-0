export type AccountStatus = 'active' | 'hospital' | 'prison';

export type OAuthProvider = 'github' | 'google';

export interface RigStats {
  cpu: number;
  ram: number;
  storage: number;
  bandwidth: number;
}

export interface CyberwareUpgrade {
  id: string;
  name: string;
  cpuBonus?: number;
  ramBonus?: number;
  storageBonus?: number;
}

export interface Account {
  id: string;
  oauthProvider: OAuthProvider;
  oauthSub: string;
  displayHandle?: string;
  cryptoBalance: number;
  rigStats: RigStats;
  cyberware: CyberwareUpgrade[];
  status: AccountStatus;
  statusExpiresAt?: string;
  createdAt: string;
}

export interface AccountPublic {
  id: string;
  displayHandle?: string;
}
