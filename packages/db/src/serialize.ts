import type { DbAccountWithRig } from './types.js';
import type { Account, RigStats } from '@port0/shared';

export function toAccountResponse(row: DbAccountWithRig): Account {
  const rigStats: RigStats = {
    cpu: row.cpu,
    ram: row.ram,
    storage: row.storage,
    bandwidth: row.bandwidth,
  };

  return {
    id: row.id,
    oauthProvider: row.oauth_provider,
    oauthSub: row.oauth_sub,
    displayHandle: row.display_handle ?? undefined,
    cryptoBalance: row.crypto_balance,
    rigStats,
    cyberware: Array.isArray(row.cyberware) ? (row.cyberware as Account['cyberware']) : [],
    status: row.status,
    statusExpiresAt: row.status_expires_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}
