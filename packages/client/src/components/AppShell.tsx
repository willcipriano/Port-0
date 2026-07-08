import { useCallback, useState, useRef, useEffect } from 'react';
import { useWindowManager, type WinState } from '../hooks/useWindowManager';
import { useHackSession } from '../hooks/useHackSession';
import { FloatingWindow } from './FloatingWindow';
import { Taskbar } from './Taskbar';
import { ConnectionStatus } from './ConnectionStatus';
import { SessionNotification } from './SessionNotification';
import { WorldMap } from './windows/WorldMap';
import { ServerList } from './windows/ServerList';
import { Terminal } from './windows/Terminal';
import { EmailContracts } from './windows/EmailContracts';
import { PasswordVault } from './windows/PasswordVault';
import { Hardware } from './windows/Hardware';
import { BruteForceTool } from './windows/tools/BruteForceTool';
import { TOOL_REGISTRY, type ToolRegistryKey } from '../tools/registry';
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
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const wm = useWindowManager(viewport);
  const session = useHackSession(account.id);
  const prevPhaseRef = useRef(session.phase);

  const tickTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const traceActive = session.phase === 'connected' && session.tracing;
  const tracedToolIds = traceActive
    ? new Set(session.runningTools.map(tool => tool.toolId))
    : new Set<string>();

  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === 'connecting' && session.phase === 'connected') {
      wm.open('terminal');
      wm.focus('terminal');
    }
    prevPhaseRef.current = session.phase;
  }, [session.phase, wm.open, wm.focus]);

  const focusToolWindow = useCallback((toolId: string) => {
    const existing = wm.windows.find(w => w.toolId === toolId && !w.closed);
    if (existing) {
      wm.open(existing.id);
      wm.focus(existing.id);
    }
  }, [wm]);

  const renderWindow = useCallback((win: WinState) => {
    switch (win.component) {
      case 'WorldMap':
        return <WorldMap accountId={account.id} />;
      case 'ServerList':
        return (
          <ServerList
            accountId={account.id}
            onConnect={session.connect}
            connectedIpv6={session.connectedIpv6}
            connectingIpv6={session.connectingIpv6}
            connectionPhase={session.phase}
          />
        );
      case 'Terminal':   return <Terminal session={session} />;
      case 'Hardware':
        return (
          <Hardware
            account={account}
            session={session}
            onFocusToolWindow={focusToolWindow}
          />
        );
      case 'Email': return <EmailContracts />;
      case 'PasswordVault':
        return (
          <PasswordVault
            accountId={account.id}
            session={session}
            onConnect={session.connect}
            connectedIpv6={session.connectedIpv6}
          />
        );
      case 'BruteForceTool':
        return (
          <BruteForceTool
            session={session}
            toolId={win.toolId ?? 'cracker_l1'}
            runId={win.runId}
            onRunLinked={(runId) => wm.update(win.id, { runId: runId || undefined })}
          />
        );
      default:      return null;
    }
  }, [account, session, wm.update, focusToolWindow]);

  const handleLaunchTool = useCallback((key: ToolRegistryKey) => {
    const def = TOOL_REGISTRY[key];
    const existing = wm.windows.find(w => w.toolId === def.toolId && !w.closed);
    if (existing) {
      wm.open(existing.id);
      wm.focus(existing.id);
      return;
    }
    const id = wm.spawnToolWindow({
      title: def.windowTitle,
      component: def.component,
      toolId: def.toolId,
    });
    wm.focus(id);
  }, [wm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div ref={desktopRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <DesktopBackground />
        <ConnectionStatus session={session} />
        <SessionNotification session={session} />

        {wm.windows.map(win => (
          <FloatingWindow
            key={win.id}
            win={win}
            bounds={viewport ?? { width: 0, height: 0 }}
            isActive={wm.activeId === win.id}
            traceGlow={Boolean(win.toolId && tracedToolIds.has(win.toolId))}
            onFocus={() => wm.focus(win.id)}
            onClose={() => wm.close(win.id)}
            onMinimize={() => wm.toggleMinimize(win.id)}
            onMaximize={() => wm.toggleMaximize(win.id)}
            onMove={(x, y) => wm.move(win.id, x, y)}
            onResize={patch => wm.resize(win.id, patch)}
          >
            {renderWindow(win)}
          </FloatingWindow>
        ))}
      </div>

      <Taskbar
        windows={wm.windows}
        onOpen={wm.open}
        onFocus={wm.focus}
        onToggleMinimize={wm.toggleMinimize}
        tracePercent={session.tracePercent}
        traceActive={traceActive}
        traceLevel={session.traceLevel}
        traceCountdown={fmt(session.traceRemainingSeconds)}
        displayHandle={account.displayHandle}
        balance={account.cryptoBalance}
        onLogout={onLogout}
        tickTime={tickTime}
        connected={session.phase === 'connected'}
        onLaunchTool={handleLaunchTool}
        tracedToolIds={tracedToolIds}
      />
    </div>
  );
}

function DesktopBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(var(--border)40 1px, transparent 1px),
          linear-gradient(90deg, var(--border)40 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(var(--border)18 1px, transparent 1px),
          linear-gradient(90deg, var(--border)18 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(0,229,255,0.03) 0%, transparent 70%)',
      }} />
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
