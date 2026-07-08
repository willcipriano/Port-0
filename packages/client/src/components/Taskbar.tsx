import { useState } from 'react';
import type { WinState } from '../hooks/useWindowManager';
import { StartMenu } from './StartMenu';
import { APP_REGISTRY } from '../apps/registry';
import type { ToolRegistryKey } from '../tools/registry';

export { APP_REGISTRY };
export type { AppDef } from '../apps/registry';

interface Props {
  windows: WinState[];
  onOpen: (id: string) => void;
  onFocus: (id: string) => void;
  onToggleMinimize: (id: string) => void;
  tracePercent: number;
  traceActive: boolean;
  displayHandle: string;
  balance: number;
  onLogout: () => void;
  tickTime: string;
  traceCountdown: string;
  traceLevel: string;
  connected: boolean;
  onLaunchTool: (key: ToolRegistryKey) => void;
  tracedToolIds: Set<string>;
}

export function Taskbar({
  windows, onOpen, onFocus, onToggleMinimize,
  tracePercent, traceActive, displayHandle, balance, onLogout,
  tickTime, traceCountdown, traceLevel,
  connected, onLaunchTool, tracedToolIds,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const dangerColor = traceLevel === 'critical' || traceLevel === 'caught'
    ? 'var(--accent-red)'
    : traceLevel === 'warning' ? 'var(--accent-orange)' : 'var(--accent-green)';

  return (
    <>
      {/* Start menu overlay */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            bottom: 44,
            zIndex: 9000,
            pointerEvents: 'none',
          }}
        >
          {/* Click-away backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'all' }}
          />

          {/* Menu panel */}
          <StartMenu
            windows={windows}
            displayHandle={displayHandle}
            balance={balance}
            connected={connected}
            onOpen={onOpen}
            onFocus={onFocus}
            onLaunchTool={onLaunchTool}
            onCloseMenu={() => setMenuOpen(false)}
            onLogout={onLogout}
          />
        </div>
      )}

      {/* Taskbar */}
      <div style={{
        height: '44px',
        background: 'rgba(6,10,15,0.96)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '6px',
        flexShrink: 0,
        zIndex: 8999,
        position: 'relative',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Glow line top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: traceActive
            ? `linear-gradient(to right, transparent, ${dangerColor}, transparent)`
            : 'linear-gradient(to right, transparent, var(--accent-cyan)33, transparent)',
          boxShadow: traceActive ? `0 0 8px ${dangerColor}` : 'none',
          transition: 'all 0.5s',
        }} />

        {/* Start button */}
        <button
          onClick={() => setMenuOpen(m => !m)}
          style={{
            width: '34px',
            height: '28px',
            background: menuOpen ? 'rgba(0,229,255,0.15)' : 'rgba(0,229,255,0.06)',
            border: `1px solid ${menuOpen ? 'var(--accent-cyan)' : 'var(--border-bright)'}`,
            borderRadius: '3px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
            boxShadow: menuOpen ? 'var(--glow-cyan)' : 'none',
          }}
          title="Applications"
        >
          <span style={{
            fontSize: '9px', fontWeight: 700, color: menuOpen ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
            textShadow: menuOpen ? 'var(--glow-cyan)' : 'none',
          }}>P:0</span>
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '22px', background: 'var(--border)', flexShrink: 0 }} />

        {/* Open / minimized window buttons (closed apps hidden — reopen from P:0 menu) */}
        <div style={{ display: 'flex', gap: '4px', flex: 1, overflow: 'hidden' }}>
          {windows.filter(win => !win.closed).map(win => {
            const app = APP_REGISTRY.find(a => a.id === win.id);
            const isActive = !win.minimized;
            const label = app?.shortTitle ?? win.title.split('//')[0]?.trim().slice(0, 8) ?? win.title;
            const traceSource = Boolean(win.toolId && tracedToolIds.has(win.toolId));
            return (
              <button
                key={win.id}
                onClick={() => onToggleMinimize(win.id)}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  background: traceSource
                    ? 'rgba(0,229,255,0.15)'
                    : isActive ? 'rgba(0,229,255,0.08)' : 'transparent',
                  border: traceSource
                    ? '1px solid var(--accent-cyan)'
                    : `1px solid ${isActive ? 'var(--accent-cyan)44' : 'var(--border)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: traceSource || isActive ? 'var(--accent-cyan)' : 'var(--text-dim)',
                  textShadow: traceSource || isActive ? 'var(--glow-cyan)' : 'none',
                  boxShadow: traceSource ? 'var(--glow-cyan)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.1s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget.style.color = 'var(--text-primary)');
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget.style.color = 'var(--text-dim)');
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Trace */}
          {traceActive && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              background: `${dangerColor}11`,
              border: `1px solid ${dangerColor}44`,
              borderRadius: '2px',
              animation: traceLevel === 'critical' ? 'pulse-orange 0.6s ease infinite' : 'none',
            }}>
              <div style={{
                width: '60px',
                height: '4px',
                background: 'var(--border)',
                borderRadius: '1px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${tracePercent}%`,
                  background: dangerColor,
                  boxShadow: `0 0 4px ${dangerColor}`,
                  transition: 'width 0.5s linear',
                }} />
              </div>
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: dangerColor,
                textShadow: `0 0 6px ${dangerColor}`,
                letterSpacing: '0.05em',
                animation: traceLevel === 'critical' ? 'blink 0.5s step-start infinite' : 'none',
              }}>
                {traceCountdown}
              </span>
            </div>
          )}

          {/* Divider */}
          <div style={{ width: '1px', height: '22px', background: 'var(--border)' }} />

          {/* Operator + balance */}
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em', lineHeight: 1.4 }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>OP// </span>
              <span style={{ color: 'var(--accent-green)', textShadow: 'var(--glow-green)', fontWeight: 700 }}>
                {displayHandle || 'OPERATOR'}
              </span>
            </div>
            <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '9px' }}>
              ₿{balance.toLocaleString()}
            </div>
          </div>

          {/* Clock */}
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.1em',
            minWidth: '42px',
            textAlign: 'center',
          }}>
            {tickTime}
          </div>
        </div>
      </div>
    </>
  );
}
