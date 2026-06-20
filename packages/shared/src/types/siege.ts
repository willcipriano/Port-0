export type SiegeStatus =
  | 'declared'
  | 'interactive'
  | 'resolving'
  | 'completed';

export type SiegeOutcome = 'attacker_win' | 'defender_win' | 'cancelled';

export interface Siege {
  id: string;
  targetIpv6: string;
  attackerAccountId: string;
  defenderAccountId?: string;
  status: SiegeStatus;
  declaredAt: string;
  interactiveWindowEndsAt?: string;
  resolveAt?: string;
  outcome?: SiegeOutcome;
}

/** WebSocket messages for /siege/:id */
export type SiegeClientMessage =
  | { type: 'join' }
  | { type: 'deploy_virus'; virusId: string; targetIpv6?: string }
  | { type: 'escalate' }
  | { type: 'target_drone'; targetIpv6: string }
  | { type: 'countermeasure' }
  | { type: 'isolate_node'; targetIpv6: string }
  | { type: 'defend_tool'; toolId: string };

export type SiegeServerMessage =
  | { type: 'siege_state'; siege: Siege; dashboard: SiegeDashboard }
  | { type: 'phase_change'; status: SiegeStatus }
  | { type: 'outcome'; outcome: SiegeOutcome; attackPower?: number; defensePower?: number }
  | { type: 'error'; message: string };

export interface SiegeDashboard {
  storageDamage: number;
  escalations: number;
  countermeasures: number;
  isolatedNodes: string[];
  virusDeployments: number;
  attackerActions: string[];
  defenderActions: string[];
}
