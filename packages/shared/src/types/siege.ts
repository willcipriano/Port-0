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
  | { type: 'deploy_virus'; virusId: string }
  | { type: 'defend_action'; action: string };

export type SiegeServerMessage =
  | { type: 'siege_state'; siege: Siege }
  | { type: 'phase_change'; status: SiegeStatus }
  | { type: 'outcome'; outcome: SiegeOutcome }
  | { type: 'error'; message: string };
