export interface TreemapItem {
  id: string;
  label: string;
  value: number;
  category: string;
  heat: string;
  path: string;
  nodeType: 'directory' | 'file';
}

export interface TreemapRect extends TreemapItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Squarified treemap. Input values are absolute weights (e.g. QGB). */
export function layoutTreemap(
  items: TreemapItem[],
  width: number,
  height: number,
): TreemapRect[] {
  const filtered = items.filter((i) => i.value > 0);
  if (filtered.length === 0 || width <= 0 || height <= 0) return [];

  const total = filtered.reduce((s, i) => s + i.value, 0);
  const scale = (width * height) / total;
  const sized = filtered
    .map((i) => ({ ...i, area: i.value * scale }))
    .sort((a, b) => b.area - a.area);

  const out: TreemapRect[] = [];
  squarify(sized, [], width, height, 0, 0, out);
  return out;
}

interface Sized extends TreemapItem {
  area: number;
}

function worstAspect(row: Sized[], length: number): number {
  if (row.length === 0 || length <= 0) return Infinity;
  const sum = row.reduce((s, i) => s + i.area, 0);
  let min = Infinity;
  let max = -Infinity;
  for (const item of row) {
    min = Math.min(min, item.area);
    max = Math.max(max, item.area);
  }
  const s2 = sum * sum;
  const l2 = length * length;
  return Math.max((l2 * max) / s2, s2 / (l2 * min));
}

function layoutRow(
  row: Sized[],
  x: number,
  y: number,
  w: number,
  h: number,
  horizontal: boolean,
  out: TreemapRect[],
): void {
  const sum = row.reduce((s, i) => s + i.area, 0);
  if (sum <= 0) return;
  let cursor = 0;
  for (const item of row) {
    if (horizontal) {
      const rw = (item.area / sum) * w;
      out.push({
        id: item.id,
        label: item.label,
        value: item.value,
        category: item.category,
        heat: item.heat,
        path: item.path,
        nodeType: item.nodeType,
        x: x + cursor,
        y,
        width: rw,
        height: h,
      });
      cursor += rw;
    } else {
      const rh = (item.area / sum) * h;
      out.push({
        id: item.id,
        label: item.label,
        value: item.value,
        category: item.category,
        heat: item.heat,
        path: item.path,
        nodeType: item.nodeType,
        x,
        y: y + cursor,
        width: w,
        height: rh,
      });
      cursor += rh;
    }
  }
}

function squarify(
  children: Sized[],
  row: Sized[],
  w: number,
  h: number,
  x: number,
  y: number,
  out: TreemapRect[],
): void {
  if (children.length === 0) {
    if (row.length > 0) {
      layoutRow(row, x, y, w, h, w >= h, out);
    }
    return;
  }

  const length = Math.min(w, h);
  const next = children[0];
  const trial = [...row, next];

  if (row.length === 0 || worstAspect(trial, length) <= worstAspect(row, length)) {
    squarify(children.slice(1), trial, w, h, x, y, out);
    return;
  }

  // Flush row into the shorter side, then recurse on remaining rectangle
  const rowSum = row.reduce((s, i) => s + i.area, 0);
  if (w >= h) {
    const rowHeight = rowSum / w;
    layoutRow(row, x, y, w, rowHeight, true, out);
    squarify(children, [], w, h - rowHeight, x, y + rowHeight, out);
  } else {
    const rowWidth = rowSum / h;
    layoutRow(row, x, y, rowWidth, h, false, out);
    squarify(children, [], w - rowWidth, h, x + rowWidth, y, out);
  }
}

export function sumTreemapAreas(rects: TreemapRect[]): number {
  return rects.reduce((s, r) => s + r.width * r.height, 0);
}

export function sumTreemapValues(rects: TreemapRect[]): number {
  return rects.reduce((s, r) => s + r.value, 0);
}
