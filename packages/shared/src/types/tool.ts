export type ToolCategory =
  | 'scanner'
  | 'cracker'
  | 'exploit'
  | 'trace_blocker'
  | 'log_cleaner'
  | 'recon'
  | 'anti_firewall';

export type ToolTargetType =
  | 'password'
  | 'firewall'
  | 'service'
  | 'subnet'
  | 'ownership'
  | 'logs';

export interface Tool {
  id: string;
  name: string;
  category: ToolCategory;
  maxSecurityLevel: number;
  ramCost: number;
  cpuCost: number;
  durationSeconds: number;
  targetType: ToolTargetType;
  marketPrice: number;
  description: string;
}
