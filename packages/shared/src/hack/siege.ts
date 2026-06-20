export interface SiegeBalance {
  resolveTicks: number;
  interactiveWindowMinutes: number;
  allowSiegeWithoutRecon: boolean;
  reconSuccessChance: number;
  reconMinConfidence: number;
  logAnalysisConfidence: number;
  escalateCpuCost: number;
  escalateAttackBonus: number;
  countermeasureMpCost: number;
  countermeasureDefenseBonus: number;
  virusStorageDamageBase: number;
  defenderPassiveFirewallWeight: number;
  defenderPassiveAntivirusWeight: number;
}

export interface VirusBalance {
  craftMinutes: number;
  uses: number;
  sourceCodeCraftTimeMultiplier: number;
}

export interface SiegeInteractiveState {
  attackerActions: string[];
  defenderActions: string[];
  virusDeployments: Array<{ virusId: string; targetIpv6: string; damage: number }>;
  isolatedNodes: string[];
  storageDamage: number;
  escalations: number;
  countermeasures: number;
}

export function emptySiegeState(): SiegeInteractiveState {
  return {
    attackerActions: [],
    defenderActions: [],
    virusDeployments: [],
    isolatedNodes: [],
    storageDamage: 0,
    escalations: 0,
    countermeasures: 0,
  };
}

export interface SiegeResolutionInput {
  attackerCpu: number;
  defenderCpu: number;
  defenderFirewall: number;
  defenderAntivirus: number;
  virusStorageDamage: number;
  escalations: number;
  countermeasures: number;
  defenderOffline: boolean;
  balance: SiegeBalance;
}

export interface SiegeResolutionResult {
  attackPower: number;
  defensePower: number;
  outcomeScore: number;
  winner: 'attacker' | 'defender';
}

export function computeSiegeResolution(input: SiegeResolutionInput): SiegeResolutionResult {
  const virusAttackBonus = Math.floor(input.virusStorageDamage / 5);
  const attackPower =
    input.attackerCpu +
    virusAttackBonus +
    input.escalations * input.balance.escalateAttackBonus;

  let defensePower =
    input.defenderCpu +
    input.defenderFirewall * input.balance.defenderPassiveFirewallWeight +
    input.countermeasures * input.balance.countermeasureDefenseBonus;

  if (input.defenderOffline) {
    defensePower +=
      input.defenderAntivirus * input.balance.defenderPassiveAntivirusWeight;
  }

  const hpPenalty = Math.floor(input.virusStorageDamage / 10);
  defensePower = Math.max(0, defensePower - hpPenalty);

  const outcomeScore = attackPower - defensePower;
  return {
    attackPower,
    defensePower,
    outcomeScore,
    winner: outcomeScore > 0 ? 'attacker' : 'defender',
  };
}

export function computeVirusStorageDamage(
  level: number,
  antivirusLevel: number,
  balance: SiegeBalance,
): number {
  const raw = balance.virusStorageDamageBase * level;
  const reduction = antivirusLevel * 3;
  return Math.max(1, raw - reduction);
}
