import { describe, it, expect } from 'vitest';
import { layoutTreemap, sumTreemapAreas, sumTreemapValues, type TreemapItem } from './treemap';

function item(partial: Partial<TreemapItem> & Pick<TreemapItem, 'id' | 'value'>): TreemapItem {
  return {
    label: partial.label ?? partial.id,
    category: partial.category ?? 'tool',
    heat: partial.heat ?? 'cold',
    path: partial.path ?? `/${partial.id}`,
    nodeType: partial.nodeType ?? 'file',
    ...partial,
  };
}

describe('layoutTreemap', () => {
  it('covers the full canvas area for positive values', () => {
    const items = [
      item({ id: 'a', value: 90 }),
      item({ id: 'b', value: 12 }),
      item({ id: 'c', value: 8 }),
      item({ id: 'd', value: 15 }),
    ];
    const rects = layoutTreemap(items, 100, 100);
    expect(rects.length).toBe(4);
    expect(sumTreemapValues(rects)).toBe(90 + 12 + 8 + 15);
    expect(sumTreemapAreas(rects)).toBeCloseTo(100 * 100, 0);
  });

  it('returns empty for zero-size canvas or empty input', () => {
    expect(layoutTreemap([], 100, 100)).toEqual([]);
    expect(layoutTreemap([item({ id: 'a', value: 10 })], 0, 100)).toEqual([]);
  });

  it('scales block area with QGB weight', () => {
    const rects = layoutTreemap(
      [item({ id: 'big', value: 90 }), item({ id: 'small', value: 10 })],
      100,
      100,
    );
    const big = rects.find((r) => r.id === 'big')!;
    const small = rects.find((r) => r.id === 'small')!;
    expect(big.width * big.height).toBeGreaterThan(small.width * small.height);
  });
});
