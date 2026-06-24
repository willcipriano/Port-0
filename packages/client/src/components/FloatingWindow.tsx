import React, { useRef, useCallback } from 'react';
import type { WinState } from '../hooks/useWindowManager';

interface Props {
  win: WinState;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (patch: Pick<WinState, 'x' | 'y' | 'width' | 'height'>) => void;
  children: React.ReactNode;
}

const MIN_W = 280;
const MIN_H = 180;

type Dir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const RESIZE_CURSORS: Record<Dir, string> = {
  n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize',
  s: 's-resize', sw: 'sw-resize', w: 'w-resize', nw: 'nw-resize',
};

const RESIZE_HANDLES: { dir: Dir; style: React.CSSProperties }[] = [
  { dir: 'n',  style: { top: 0,    left: 4,   right: 4,   height: 4, cursor: 'n-resize' } },
  { dir: 's',  style: { bottom: 0, left: 4,   right: 4,   height: 4, cursor: 's-resize' } },
  { dir: 'e',  style: { right: 0,  top: 4,    bottom: 4,  width: 4,  cursor: 'e-resize' } },
  { dir: 'w',  style: { left: 0,   top: 4,    bottom: 4,  width: 4,  cursor: 'w-resize' } },
  { dir: 'nw', style: { top: 0,    left: 0,   width: 8,   height: 8, cursor: 'nw-resize' } },
  { dir: 'ne', style: { top: 0,    right: 0,  width: 8,   height: 8, cursor: 'ne-resize' } },
  { dir: 'sw', style: { bottom: 0, left: 0,   width: 8,   height: 8, cursor: 'sw-resize' } },
  { dir: 'se', style: { bottom: 0, right: 0,  width: 8,   height: 8, cursor: 'se-resize' } },
];

export function FloatingWindow({ win, isActive, onFocus, onClose, onMinimize, onMaximize, onMove, onResize, children }: Props) {
  const dragging = useRef(false);
  const resizing = useRef(false);

  const startDrag = useCallback((e: React.MouseEvent) => {
    if (win.maximized) return;
    if ((e.target as HTMLElement).closest('[data-winctrls]')) return;
    e.preventDefault();
    dragging.current = true;

    const ox = e.clientX - win.x;
    const oy = e.clientY - win.y;

    const onMove_ = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const nx = Math.max(0, ev.clientX - ox);
      const ny = Math.max(0, ev.clientY - oy);
      onMove(nx, ny);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove_);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
  }, [win, onMove]);

  const startResize = useCallback((dir: Dir) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const { x: startX, y: startY, width: startW, height: startH } = win;

    const onMove_ = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const dx = ev.clientX - startMouseX;
      const dy = ev.clientY - startMouseY;

      let x = startX, y = startY, w = startW, h = startH;

      if (dir.includes('e')) w = Math.max(MIN_W, startW + dx);
      if (dir.includes('s')) h = Math.max(MIN_H, startH + dy);
      if (dir.includes('w')) { w = Math.max(MIN_W, startW - dx); x = startX + (startW - w); }
      if (dir.includes('n')) { h = Math.max(MIN_H, startH - dy); y = startY + (startH - h); }

      onResize({ x, y, width: w, height: h });
    };

    const onUp = () => {
      resizing.current = false;
      window.removeEventListener('mousemove', onMove_);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
  }, [win, onResize]);

  return (
    <div
      onMouseDown={onFocus}
      style={{
        position: 'absolute',
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        display: win.minimized || win.closed ? 'none' : 'flex',
        flexDirection: 'column',
        zIndex: win.zIndex,
        background: 'var(--bg-panel)',
        border: isActive ? '1px solid var(--accent-cyan)66' : '1px solid var(--border)',
        borderRadius: '3px',
        boxShadow: isActive
          ? `0 0 0 1px rgba(0,229,255,0.15), 0 12px 40px rgba(0,0,0,0.7), 0 0 32px rgba(0,229,255,0.08)`
          : `0 4px 20px rgba(0,0,0,0.5)`,
        overflow: 'hidden',
        userSelect: dragging.current ? 'none' : 'auto',
        transition: win.maximized ? 'left 0.15s ease, top 0.15s ease, width 0.15s ease, height 0.15s ease' : 'none',
      }}
    >
      {/* Resize handles */}
      {!win.maximized && RESIZE_HANDLES.map(h => (
        <div
          key={h.dir}
          onMouseDown={startResize(h.dir)}
          style={{
            position: 'absolute',
            ...h.style,
            zIndex: 10,
          }}
        />
      ))}

      {/* Title bar */}
      <div
        onMouseDown={startDrag}
        onDoubleClick={onMaximize}
        style={{
          height: '30px',
          minHeight: '30px',
          background: isActive ? 'var(--bg-panel-3)' : 'var(--bg-panel-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          cursor: win.maximized ? 'default' : 'grab',
          flexShrink: 0,
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {/* Left accent */}
        <div style={{
          width: '2px',
          height: '14px',
          background: isActive ? 'var(--accent-cyan)' : 'var(--text-dim)',
          boxShadow: isActive ? 'var(--glow-cyan)' : 'none',
          marginRight: '8px',
          flexShrink: 0,
        }} />

        {/* Title */}
        <span style={{
          flex: 1,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: isActive ? 'var(--accent-cyan)' : 'var(--text-dim)',
          textShadow: isActive ? 'var(--glow-cyan)' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {win.title}
        </span>

        {/* Window controls */}
        <div data-winctrls="1" style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          <WinBtn color="var(--accent-green)" title="Minimize" onClick={e => { e.stopPropagation(); onMinimize(); }} />
          <WinBtn color="var(--accent-yellow)" title="Maximize" onClick={e => { e.stopPropagation(); onMaximize(); }} />
          <WinBtn color="var(--accent-red)" title="Close" onClick={e => { e.stopPropagation(); onClose(); }} />
        </div>
      </div>

      {/* Window body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

function WinBtn({ color, title, onClick }: { color: string; title: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: color,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        boxShadow: `0 0 4px ${color}`,
        transition: 'transform 0.1s, box-shadow 0.1s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8px',
        color: 'rgba(0,0,0,0.5)',
        fontWeight: 700,
        lineHeight: 1,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${color}`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 4px ${color}`;
      }}
    />
  );
}
