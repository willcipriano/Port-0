import { describe, expect, it } from 'vitest';
import { parseCrackedPassword } from './bruteForceAnimation';

describe('parseCrackedPassword', () => {
  it('extracts password without trailing punctuation', () => {
    const output = 'Password cracked: abc!@#123 — Access upgraded to user.';
    expect(parseCrackedPassword(output)).toBe('abc!@#123');
  });

  it('returns null for unrelated output', () => {
    expect(parseCrackedPassword('Firewall bypassed.')).toBeNull();
  });
});
