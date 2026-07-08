export const MIN_W = 280;
export const MIN_H = 180;

export const REFERENCE_SIZE = { w: 1280, h: 700 };

export interface LayoutWindow {
  id: string;
  title: string;
  component: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  closed: boolean;
  restoreRect?: { x: number; y: number; width: number; height: number };
}

export const DEFAULT_WINDOWS: LayoutWindow[] = [
  { id: 'world',    title: 'WORLD MAP',          component: 'WorldMap',    x: 10,   y: 10,  width: 400, height: 340, zIndex: 1, minimized: false, maximized: false, closed: false },
  { id: 'servers',  title: 'SERVER LIST',        component: 'ServerList',  x: 420,  y: 10,  width: 430, height: 340, zIndex: 2, minimized: false, maximized: false, closed: false },
  { id: 'terminal', title: 'TERMINAL',            component: 'Terminal',    x: 10,   y: 360, width: 490, height: 340, zIndex: 3, minimized: false, maximized: false, closed: false },
  { id: 'hardware', title: 'HARDWARE // RIG',     component: 'Hardware',    x: 860,  y: 10,  width: 420, height: 460, zIndex: 4, minimized: false, maximized: false, closed: false },
  { id: 'email',    title: 'EMAIL // CONTRACTS',  component: 'Email',       x: 510,  y: 360, width: 340, height: 340, zIndex: 5, minimized: false, maximized: false, closed: false },
  { id: 'vault',    title: 'PASSWORD VAULT',      component: 'PasswordVault', x: 860, y: 480, width: 420, height: 380, zIndex: 6, minimized: false, maximized: false, closed: true },
];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

function minScaleForMins(reference: LayoutWindow[]): number {
  let minScale = 0;
  for (const w of reference) {
    minScale = Math.max(minScale, MIN_W / w.width, MIN_H / w.height);
  }
  return minScale;
}

export function clampRect(rect: Rect, vpW: number, vpH: number): Rect {
  let { x, y, width, height } = rect;
  width = Math.max(MIN_W, Math.min(width, vpW));
  height = Math.max(MIN_H, Math.min(height, vpH));
  x = Math.max(0, Math.min(x, vpW - width));
  y = Math.max(0, Math.min(y, vpH - height));
  return { x, y, width, height };
}

export function fitWindowsToViewport<T extends LayoutWindow>(
  windows: T[],
  reference: LayoutWindow[],
  vpW: number,
  vpH: number,
): T[] {
  if (vpW <= 0 || vpH <= 0) return windows;

  const scaleByW = vpW / REFERENCE_SIZE.w;
  const scaleByH = vpH / REFERENCE_SIZE.h;
  let scale = Math.min(1, scaleByW, scaleByH);
  scale = Math.max(scale, minScaleForMins(reference));

  const layoutW = REFERENCE_SIZE.w * scale;
  const layoutH = REFERENCE_SIZE.h * scale;
  const offsetX = Math.max(0, (vpW - layoutW) / 2);
  const offsetY = Math.max(0, (vpH - layoutH) / 2);

  const refById = new Map(reference.map(w => [w.id, w]));

  return windows.map(w => {
    if (w.maximized) {
      return { ...w, x: 0, y: 0, width: vpW, height: vpH };
    }
    const ref = refById.get(w.id);
    if (!ref) return w;

    return {
      ...w,
      x: offsetX + ref.x * scale,
      y: offsetY + ref.y * scale,
      width: ref.width * scale,
      height: ref.height * scale,
    };
  });
}

export function getDesktopBounds(el: HTMLElement): Viewport {
  const { width, height } = el.getBoundingClientRect();
  return { width: Math.floor(width), height: Math.floor(height) };
}
