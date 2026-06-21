import { useState } from 'react';
import type { WinState } from '../hooks/useWindowManager';

export interface AppDef {
  id: string;
  title: string;
  shortTitle: string;
  icon: string;
  description: string;
}

export const APP_REGISTRY: AppDef[] = [
  { id: 'world',    title: 'WORLD MAP',         shortTitle: 'WORLD',    icon: '[MAP]', description: 'Subnet topology & scan targets' },
  { id: 'servers',  title: 'SERVER LIST',        shortTitle: 'SERVERS',  icon: '[SRV]', description: 'Discovered & owned machines' },
  { id: 'terminal', title: 'TERMINAL',            shortTitle: 'TERM',     icon: '[>_ ]', description: 'Remote shell session' },
  { id: 'hardware', title: 'HARDWARE // RIG',     shortTitle: 'RIG',      icon: '[CPU]', description: 'Rig stats & process manager' },
  { id: 'email',    title: 'EMAIL // CONTRACTS',  shortTitle: 'EMAIL',    icon: '[MSG]', description: 'NPC jobs & contract inbox' },
];

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
}

export function Taskbar({
  windows, onOpen, onFocus, onToggleMinimize,
  tracePercent, traceActive, displayHandle, balance, onLogout,
  tickTime, traceCountdown, traceLevel,
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
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '320px',
            background: 'rgba(8,12,18,0.97)',
            border: '1px solid var(--border-bright)',
            borderBottom: 'none',
            borderRadius: '4px 4px 0 0',
            pointerEvents: 'all',
            animation: 'slide-in-left 0.15s ease',
            boxShadow: '0 -4px 32px rgba(0,229,255,0.1)',
            overflow: 'hidden',
          }}>
            {/* Menu header */}
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--bg-panel-3)',
            }}>
              <div style={{
                width: '28px', height: '28px',
                background: 'rgba(0,229,255,0.1)',
                border: '1px solid var(--accent-cyan)44',
                borderRadius: '2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: 'var(--accent-cyan)',
                textShadow: 'var(--glow-cyan)', fontWeight: 700,
              }}>P:0</div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700, letterSpacing: '0.1em' }}>
                  {displayHandle || 'OPERATOR'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  ₿{balance.toLocaleString()} · ACTIVE
                </div>
              </div>
            </div>

            {/* Section label */}
            <div style={{ padding: '8px 14px 4px', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>
              Applications
            </div>

            {/* App grid */}
            <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {APP_REGISTRY.map(app => {
                const win = windows.find(w => w.id === app.id);
                const isOpen = win && !win.minimized;
                return (
                  <button
                    key={app.id}
                    onClick={() => {
                      if (win) {
                        if (win.minimized) onOpen(app.id);
                        else onFocus(app.id);
                      } else {
                        onOpen(app.id);
                      }
                      setMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 8px',
                      background: isOpen ? 'rgba(0,229,255,0.06)' : 'transparent',
                      border: '1px solid transparent',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.1s',
                      fontFamily: 'var(--font-mono)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.08)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = isOpen ? 'rgba(0,229,255,0.06)' : 'transparent';
                      (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }}
                  >
                    <span style={{
                      width: '36px',
                      fontSize: '9px',
                      color: isOpen ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                      textShadow: isOpen ? 'var(--glow-cyan)' : 'none',
                    }}>
                      {app.icon}
                    </span>
                    <div>
                      <div style={{ fontSize: '11px', color: isOpen ? 'var(--text-bright)' : 'var(--text-primary)', fontWeight: isOpen ? 600 : 400, letterSpacing: '0.08em' }}>
                        {app.title}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.04em', marginTop: '1px' }}>
                        {app.description}
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{
                        marginLeft: 'auto',
                        width: '5px', height: '5px',
                        borderRadius: '50%',
                        background: 'var(--accent-cyan)',
                        boxShadow: 'var(--glow-cyan)',
                        flexShrink: 0,
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider + system actions */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px' }}>
              <button
                onClick={() => { setMenuOpen(false); onLogout(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 8px', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  color: 'var(--accent-red)', letterSpacing: '0.12em',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,34,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ textShadow: 'var(--glow-red)' }}>✕</span>
                DISCONNECT SESSION
              </button>
            </div>
          </div>
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

        {/* Open window buttons */}
        <div style={{ display: 'flex', gap: '4px', flex: 1, overflow: 'hidden' }}>
          {windows.map(win => {
            const app = APP_REGISTRY.find(a => a.id === win.id);
            const isActive = !win.minimized;
            return (
              <button
                key={win.id}
                onClick={() => onToggleMinimize(win.id)}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  background: isActive ? 'rgba(0,229,255,0.08)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--accent-cyan)44' : 'var(--border)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-dim)',
                  textShadow: isActive ? 'var(--glow-cyan)' : 'none',
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
                {app?.shortTitle ?? win.title}
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
