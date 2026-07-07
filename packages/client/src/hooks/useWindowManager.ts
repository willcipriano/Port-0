import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DEFAULT_WINDOWS,
  clampRect,
  fitWindowsToViewport,
  type Viewport,
} from '../utils/windowLayout';

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
  closed: boolean;
  /** position before maximize */
  restoreRect?: { x: number; y: number; width: number; height: number };
}

export type WinPatch = Partial<Pick<WinState, 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'minimized' | 'maximized' | 'closed' | 'restoreRect'>>;

let zTop = 10;

export function useWindowManager(viewport: Viewport | null) {
  const referenceLayout = useRef(DEFAULT_WINDOWS);
  const [windows, setWindows] = useState<WinState[]>(DEFAULT_WINDOWS);
  const [activeId, setActiveId] = useState<string>('email');

  useEffect(() => {
    if (!viewport) return;
    setWindows(prev =>
      fitWindowsToViewport(prev, referenceLayout.current, viewport.width, viewport.height),
    );
  }, [viewport?.width, viewport?.height]);

  const update = useCallback((id: string, patch: WinPatch) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  }, []);

  const focus = useCallback((id: string) => {
    zTop += 1;
    setActiveId(id);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: zTop, minimized: false } : w));
  }, []);

  const close = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, closed: true, minimized: true } : w));
  }, []);

  const open = useCallback((id: string) => {
    zTop += 1;
    setActiveId(id);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, closed: false, minimized: false, zIndex: zTop } : w));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.minimized) { zTop += 1; return { ...w, minimized: false, zIndex: zTop }; }
      return { ...w, minimized: true };
    }));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    if (!viewport) return;
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.maximized) {
        const restored = { ...w, maximized: false, ...(w.restoreRect ?? {}) };
        return { ...restored, ...clampRect(restored, viewport.width, viewport.height) };
      }
      return {
        ...w,
        maximized: true,
        restoreRect: { x: w.x, y: w.y, width: w.width, height: w.height },
        x: 0, y: 0, width: viewport.width, height: viewport.height,
      };
    }));
  }, [viewport]);

  const move = useCallback((id: string, x: number, y: number) => {
    if (!viewport) return;
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      return { ...w, ...clampRect({ x, y, width: w.width, height: w.height }, viewport.width, viewport.height) };
    }));
  }, [viewport]);

  const resize = useCallback((id: string, patch: Pick<WinState, 'x' | 'y' | 'width' | 'height'>) => {
    if (!viewport) return;
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      return { ...w, ...clampRect({ ...patch }, viewport.width, viewport.height) };
    }));
  }, [viewport]);

  return { windows, activeId, viewport, focus, close, open, toggleMinimize, toggleMaximize, move, resize, update };
}
