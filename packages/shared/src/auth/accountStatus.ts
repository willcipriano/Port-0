import type { AccountStatus } from '../types/account.js';

export type ActionCategory =
  | 'hack'
  | 'siege_attack'
  | 'virus_deploy'
  | 'scan'
  | 'market_buy'
  | 'market'
  | 'fleet_offensive'
  | 'fleet_mgmt'
  | 'read_only';

const HOSPITAL_BLOCKED: ActionCategory[] = ['hack', 'siege_attack', 'virus_deploy'];

const PRISON_BLOCKED: ActionCategory[] = [
  'hack',
  'scan',
  'siege_attack',
  'virus_deploy',
  'fleet_offensive',
  'market_buy',
];

export function isActionBlocked(status: AccountStatus, action: ActionCategory): boolean {
  if (status === 'active') return false;
  if (status === 'hospital') return HOSPITAL_BLOCKED.includes(action);
  if (status === 'prison') return PRISON_BLOCKED.includes(action);
  return false;
}

export function blockedReason(status: AccountStatus, action: ActionCategory): string {
  return `Action '${action}' is blocked while account status is '${status}'`;
}
