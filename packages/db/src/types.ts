import type { AccountStatus, OAuthProvider, RigStats } from '@port0/shared';

export interface DbAccount {
  id: string;
  oauth_provider: OAuthProvider;
  oauth_sub: string;
  display_handle: string | null;
  crypto_balance: number;
  status: AccountStatus;
  status_expires_at: Date | null;
  created_at: Date;
}

export interface DbAccountWithRig extends DbAccount {
  cpu: number;
  ram: number;
  storage: number;
  bandwidth: number;
  cyberware: unknown;
}

export interface CreateAccountInput {
  oauthProvider: OAuthProvider;
  oauthSub: string;
  displayHandle?: string;
  cryptoBalance: number;
  rigStats: RigStats;
}
