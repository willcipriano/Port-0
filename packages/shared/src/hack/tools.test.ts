import { describe, expect, it } from 'vitest';
import { loadToolsCatalog } from './balanceLoader.js';
import { computeToolDurationMs } from './tools.js';

describe('computeToolDurationMs', () => {
  const tools = loadToolsCatalog();
  const cracker = tools.find(t => t.id === 'cracker_l1')!;

  it('cracker L1 completes in about 12 wall-clock seconds', () => {
    expect(computeToolDurationMs(cracker, 1)).toBe(12_000);
  });
});
