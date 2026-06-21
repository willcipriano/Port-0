import { useState, useCallback, useRef } from 'react';

export interface WinState {
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
  /** position before maximize */
  restoreRect?: { x: number; y: number; width: number; height: number };
}

export type WinPatch = Partial<Pick<WinState, 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'minimized' | 'maximized' | 'restoreRect'>>;

const TASKBAR_H = 44;

const DEFAULT_WINDOWS: WinState[] = [
  { id: 'world',    title: 'WORLD MAP',          component: 'WorldMap',    x: 10,   y: 10,  width: 400, height: 340, zIndex: 1, minimized: false, maximized: false },
  { id: 'servers',  title: 'SERVER LIST',        component: 'ServerList',  x: 420,  y: 10,  width: 430, height: 340, zIndex: 2, minimized: false, maximized: false },
  { id: 'terminal', title: 'TERMINAL',            component: 'Terminal',    x: 10,   y: 360, width: 490, height: 340, zIndex: 3, minimized: false, maximized: false },
  { id: 'hardware', title: 'HARDWARE // RIG',     component: 'Hardware',    x: 860,  y: 10,  width: 420, height: 460, zIndex: 4, minimized: false, maximized: false },
  { id: 'email',    title: 'EMAIL // CONTRACTS',  component: 'Email',       x: 510,  y: 360, width: 340, height: 340, zIndex: 5, minimized: false, maximized: false },
];

let zTop = 10;

export function useWindowManager() {
  const [windows, setWindows] = useState<WinState[]>(DEFAULT_WINDOWS);
  const [activeId, setActiveId] = useState<string>('email');
  const viewportRef = useRef<HTMLElement | null>(null);

  const update = useCallback((id: string, patch: WinPatch) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  }, []);

  const focus = useCallback((id: string) => {
    zTop += 1;
    setActiveId(id);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: zTop, minimized: false } : w));
  }, []);

  const close = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: true } : w));
  }, []);

  const open = useCallback((id: string) => {
    zTop += 1;
    setActiveId(id);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: false, zIndex: zTop } : w));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.minimized) { zTop += 1; return { ...w, minimized: false, zIndex: zTop }; }
      return { ...w, minimized: true };
    }));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.maximized) {
        return { ...w, maximized: false, ...(w.restoreRect ?? {}) };
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight - TASKBAR_H;
      return {
        ...w,
        maximized: true,
        restoreRect: { x: w.x, y: w.y, width: w.width, height: w.height },
        x: 0, y: 0, width: vw, height: vh,
      };
    }));
  }, []);

  const move = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
  }, []);

  const resize = useCallback((id: string, patch: Pick<WinState, 'x' | 'y' | 'width' | 'height'>) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  }, []);

  return { windows, activeId, focus, close, open, toggleMinimize, toggleMaximize, move, resize, update };
}
