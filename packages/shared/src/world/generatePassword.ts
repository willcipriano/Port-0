import type { Rng } from './rng.js';
import { createRng } from './rng.js';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%&*';

function charsetForLevel(securityLevel: number): string {
  if (securityLevel <= 1) return LOWER + DIGITS;
  if (securityLevel <= 2) return LOWER + UPPER + DIGITS;
  return LOWER + UPPER + DIGITS + SYMBOLS;
}

function lengthForLevel(securityLevel: number, rng: Rng): number {
  if (securityLevel <= 1) return rng.int(12, 16);
  if (securityLevel <= 2) return rng.int(16, 24);
  if (securityLevel <= 3) return rng.int(20, 30);
  return rng.int(24, 38);
}

export function generateRootPassword(rng: Rng, securityLevel: number): string {
  const level = Math.max(1, Math.min(5, securityLevel));
  const charset = charsetForLevel(level);
  const length = lengthForLevel(level, rng);
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += charset[rng.int(0, charset.length - 1)]!;
  }
  return password;
}

/** Deterministic password for backfill from IPv6 + security level. */
export function deriveRootPasswordFromIpv6(ipv6: string, securityLevel: number): string {
  let seed = 5381;
  for (let i = 0; i < ipv6.length; i++) {
    seed = ((seed * 33) ^ ipv6.charCodeAt(i)) >>> 0;
  }
  seed = (seed ^ (securityLevel * 9973)) >>> 0;
  return generateRootPassword(createRng(seed), securityLevel);
}
