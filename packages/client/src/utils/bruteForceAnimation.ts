const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';

export type CrackCharPhase = 'chaotic' | 'locked' | 'scrambling';

export interface CrackDisplayChar {
  char: string;
  phase: CrackCharPhase;
}

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)]!;
}

/** Fast-changing char for unrevealed suffix positions. */
function scramblingChar(index: number, tick: number, length: number): string {
  const seed = (index * 7919 + tick * 2_654_435_761 + length * 997) >>> 0;
  return CHARS[seed % CHARS.length]!;
}

/**
 * Build the on-screen crack display using server-authoritative revealed prefix.
 * Fixed width once passwordLength is known; unrevealed slots scramble in place.
 */
export function buildCrackDisplay(
  progressPercent: number,
  passwordLength: number,
  revealedPrefix: string,
  crackedPassword: string | null,
  tick = 0,
): CrackDisplayChar[] {
  if (crackedPassword) {
    return crackedPassword.split('').map(char => ({ char, phase: 'locked' }));
  }

  const len = Math.max(passwordLength, revealedPrefix.length, 4);

  // Brief warm-up: variable-length noise before we lock onto target length.
  if (progressPercent < 5 && revealedPrefix.length === 0) {
    return randomCandidate(3, len).split('').map(char => ({ char, phase: 'chaotic' }));
  }

  const suffixScrambling = progressPercent >= 15 || revealedPrefix.length > 0;
  const out: CrackDisplayChar[] = [];

  for (let i = 0; i < len; i += 1) {
    if (i < revealedPrefix.length) {
      out.push({ char: revealedPrefix[i]!, phase: 'locked' });
    } else if (suffixScrambling) {
      out.push({ char: scramblingChar(i, tick, len), phase: 'scrambling' });
    } else {
      out.push({ char: randomChar(), phase: 'chaotic' });
    }
  }
  return out;
}

function randomCandidate(minLen = 3, maxLen = 14): string {
  const lo = Math.max(1, minLen);
  const hi = Math.max(lo, maxLen);
  const len = lo + Math.floor(Math.random() * (hi - lo + 1));
  let s = '';
  for (let i = 0; i < len; i += 1) {
    s += randomChar();
  }
  return s;
}

/** Interval ms — faster overall, accelerates with progress. */
export function crackTickInterval(progressPercent: number): number {
  return Math.max(18, 90 - progressPercent * 0.75);
}

/** Scrambling suffix ticks faster than the locked prefix. */
export function crackScrambleInterval(progressPercent: number): number {
  if (progressPercent < 70) return crackTickInterval(progressPercent);
  return Math.max(12, 40 - progressPercent * 0.25);
}

export function parseCrackedPassword(output: string): string | null {
  const match = output.match(/Password cracked:\s*(\S+)/);
  return match?.[1] ?? null;
}
