/** MVP IPv6 allocation: 2001:db8:<zone>:<subnet>::/64 game prefix (RFC 3849 documentation range) */
export const IPV6_GAME_PREFIX = '2001:db8';

export const MVP_ZONE_ID = 'shady_hollow';
export const MVP_SUBNET_ID = 'block_7';

export function formatMachineAddress(
  zoneHex: string,
  subnetHex: string,
  hostSuffix: string,
): string {
  return `${IPV6_GAME_PREFIX}:${zoneHex}:${subnetHex}::${hostSuffix}`;
}

/** MVP zone 0x0001, subnet 0x0007 → 2001:db8:1:7::<host> */
export const MVP_SUBNET_PREFIX = `${IPV6_GAME_PREFIX}:1:7`;
