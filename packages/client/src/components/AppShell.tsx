import { useCallback, useState } from 'react';
import { useWindowManager } from '../hooks/useWindowManager';
import { useTrace } from '../hooks/useTrace';
import { FloatingWindow } from './FloatingWindow';
import { Taskbar } from './Taskbar';
import { WorldMap } from './windows/WorldMap';
import { ServerList } from './windows/ServerList';
import { Terminal } from './windows/Terminal';
import { EmailContracts } from './windows/EmailContracts';
import { Hardware } from './windows/Hardware';
import type { Account } from '../hooks/useAuth';

interface Props {
  account: Account;
  onLogout: () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `T-${m}:${sec.toString().padStart(2, '0')}`;
}

export function AppShell({ account, onLogout }: Props) {
  const wm = useWindowManager();
  const [traceActive, setTraceActive] = useState(false);
  const [connectTarget, setConnectTarget] = useState<string | undefined>();
  const trace = useTrace(traceActive);

  const tickTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  const renderWindow = useCallback((component: string) => {
    switch (component) {
      case 'WorldMap':   return <WorldMap />;
      case 'ServerList': return <ServerList onConnect={ip => setConnectTarget(ip)} />;
      case 'Terminal':   return <Terminal target={connectTarget} />;
      case 'Hardware':
        return (
          <Hardware
            account={account}
            traceActive={traceActive}
            onStartTrace={() => setTraceActive(true)}
            onStopTrace={() => setTraceActive(false)}
          />
        );
      case 'Email': return <EmailContracts />;
      default:      return null;
    }
  }, [account, traceActive, connectTarget]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Desktop */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Background */}
        <DesktopBackground />

        {/* Floating windows */}
        {wm.windows.map(win => (
          <FloatingWindow
            key={win.id}
            win={win}
            isActive={wm.activeId === win.id}
            onFocus={() => wm.focus(win.id)}
            onClose={() => wm.close(win.id)}
            onMinimize={() => wm.toggleMinimize(win.id)}
            onMaximize={() => wm.toggleMaximize(win.id)}
            onMove={(x, y) => wm.move(win.id, x, y)}
            onResize={patch => wm.resize(win.id, patch)}
          >
            {renderWindow(win.component)}
          </FloatingWindow>
        ))}
      </div>

      {/* Taskbar */}
      <Taskbar
        windows={wm.windows}
        onOpen={wm.open}
        onFocus={wm.focus}
        onToggleMinimize={wm.toggleMinimize}
        tracePercent={trace.percent}
        traceActive={trace.active}
        traceLevel={trace.level}
        traceCountdown={fmt(trace.secondsLeft)}
        displayHandle={account.displayHandle}
        balance={account.cryptoBalance}
        onLogout={onLogout}
        tickTime={tickTime}
      />
    </div>
  );
}

function DesktopBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Large grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(var(--border)40 1px, transparent 1px),
          linear-gradient(90deg, var(--border)40 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />
      {/* Fine grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(var(--border)18 1px, transparent 1px),
          linear-gradient(90deg, var(--border)18 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }} />
      {/* Radial glow centre */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(0,229,255,0.03) 0%, transparent 70%)',
      }} />
      {/* Corner vignettes */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 40% 40% at 0% 0%, rgba(0,229,255,0.04) 0%, transparent 60%),
          radial-gradient(ellipse 40% 40% at 100% 100%, rgba(0,255,159,0.03) 0%, transparent 60%)
        `,
      }} />
    </div>
  );
}
