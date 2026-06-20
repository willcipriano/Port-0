import type { SiegeBalance } from './siege.js';

export interface ReconResult {
  ownerHint: string | null;
  confidence: number;
  source: 'recon_tool' | 'log_analysis';
}

export function rollReconProbe(
  ownerHandle: string | null,
  balance: SiegeBalance,
  roll: number,
): ReconResult {
  if (!ownerHandle) {
    return { ownerHint: 'unknown', confidence: 0.2, source: 'recon_tool' };
  }
  if (roll < balance.reconSuccessChance) {
    return {
      ownerHint: ownerHandle,
      confidence: Math.max(balance.reconMinConfidence, balance.reconSuccessChance),
      source: 'recon_tool',
    };
  }
  return { ownerHint: 'unknown', confidence: 0.25, source: 'recon_tool' };
}

export function analyzeOwnershipLogs(
  ownerHandle: string | null,
  osArchetypeId: string,
  balance: SiegeBalance,
): ReconResult | null {
  const tier2Plus = osArchetypeId !== 'cheap_server';
  if (!tier2Plus || !ownerHandle) {
    return null;
  }
  return {
    ownerHint: ownerHandle,
    confidence: balance.logAnalysisConfidence,
    source: 'log_analysis',
  };
}

export function formatReconOutput(result: ReconResult): string {
  if (result.ownerHint && result.ownerHint !== 'unknown') {
    return `Ownership fingerprint: ${result.ownerHint} (confidence ${Math.round(result.confidence * 100)}%)`;
  }
  return 'Ownership fingerprint: unknown (probe inconclusive)';
}

export function formatLogAnalysisOutput(result: ReconResult): string {
  return `auth.log: session opened by operator ${result.ownerHint} (confidence ${Math.round(result.confidence * 100)}%)`;
}
