/** Strip CIDR suffix and normalize prefix base (e.g. 2001:db8:1:7::/64 → 2001:db8:1:7::). */
export function normalizePrefix(prefix: string): string {
  const base = prefix.replace(/\/\d+$/, '').toLowerCase();
  return base.endsWith('::') ? base : `${base}::`;
}

/** Format host id within a /64 prefix (host id is numeric; rendered as lowercase hex). */
export function formatHostAddress(prefix: string, hostId: number): string {
  if (hostId < 0 || hostId > 0xffffffffffff) {
    throw new Error(`Host id out of range: ${hostId}`);
  }
  const base = normalizePrefix(prefix);
  return `${base}${hostId.toString(16)}`;
}

export function parseHostId(ipv6: string, prefix: string): number | null {
  const base = normalizePrefix(prefix);
  const normalized = ipv6.toLowerCase();
  if (!normalized.startsWith(base)) return null;
  const suffix = normalized.slice(base.length);
  if (!/^[0-9a-f]+$/.test(suffix)) return null;
  return parseInt(suffix, 16);
}

export interface Ipv6Allocator {
  reserve(ipv6: string): void;
  allocateNext(): string;
  reservedCount(): number;
  allocatedCount(): number;
}

export function createIpv6Allocator(prefix: string, reservedAddresses: string[] = []): Ipv6Allocator {
  const used = new Set<string>();
  for (const addr of reservedAddresses) {
    used.add(addr.toLowerCase());
  }

  let nextHostId = 1;

  function findNextHostId(): number {
    while (used.has(formatHostAddress(prefix, nextHostId).toLowerCase())) {
      nextHostId += 1;
    }
    const id = nextHostId;
    nextHostId += 1;
    return id;
  }

  let allocated = 0;

  return {
    reserve(ipv6: string): void {
      used.add(ipv6.toLowerCase());
    },
    allocateNext(): string {
      const hostId = findNextHostId();
      const addr = formatHostAddress(prefix, hostId);
      used.add(addr.toLowerCase());
      allocated += 1;
      return addr;
    },
    reservedCount(): number {
      return used.size - allocated;
    },
    allocatedCount(): number {
      return allocated;
    },
  };
}
