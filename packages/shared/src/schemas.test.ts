import { describe, it, expect } from 'vitest';
import { MVP_SUBNET_PREFIX, formatMachineAddress } from './constants/ipv6.ts';
import { toolsFileSchema } from './content/schemas.ts';

describe('shared constants', () => {
  it('formats MVP subnet prefix', () => {
    expect(MVP_SUBNET_PREFIX).toBe('2001:db8:1:7');
    expect(formatMachineAddress('1', '7', 'a1')).toBe('2001:db8:1:7::a1');
  });
});

describe('toolsFileSchema', () => {
  it('accepts minimum MVP tool set shape', () => {
    const result = toolsFileSchema.safeParse({
      balance_version: 'balance-v0',
      tools: [
        {
          id: 'scanner_l1',
          name: 'Scanner',
          category: 'scanner',
          max_security_level: 1,
          ram_cost: 1,
          cpu_cost: 1,
          duration_seconds: 1,
          target_type: 'subnet',
          market_price: 50,
          description: 'test',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
