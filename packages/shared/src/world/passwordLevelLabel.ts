/** Human-readable password security label for server list / recon UI. */
export function passwordLevelSummary(level: number): string {
  const n = Math.max(1, Math.min(5, Math.floor(level)));
  if (n >= 3) return `L${n} hardened`;
  if (n === 2) return 'L2 mixed';
  return 'L1 weak';
}

/** Stable tier-1 password level roll (1–2) from IPv6 for mock/dev data. */
export function mockPasswordLevelForNode(ipv6: string, osArchetypeId: string): number {
  if (osArchetypeId === 'corp_workstation' || osArchetypeId === 'mainframe') return 3;
  if (osArchetypeId === 'generic_linux') return 2;
  let hash = 0;
  for (let i = 0; i < ipv6.length; i += 1) {
    hash = ((hash * 33) ^ ipv6.charCodeAt(i)) >>> 0;
  }
  return (hash % 2) + 1;
}
