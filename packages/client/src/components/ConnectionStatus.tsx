import { useEffect } from 'react';
import type { HackSession } from '../hooks/useHackSession';

interface Props {
  session: HackSession;
}

function fmtTrace(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `T–${m}:${sec.toString().padStart(2, '0')}`;
}

export function ConnectionStatus({ session }: Props) {
  const {
    phase,
    connectedIpv6,
    tracing,
    tracePercent,
    traceRemainingSeconds,
    traceLevel,
    lastError,
    disconnect,
    clearError,
  } = session;

  const visible = phase === 'connecting' || phase === 'connected' || phase === 'disconnecting';
  if (!visible) return null;

  const dangerColor = traceLevel === 'critical' || traceLevel === 'caught'
    ? 'var(--accent-red)'
    : traceLevel === 'warning'
      ? 'var(--accent-orange)'
      : 'var(--accent-green)';

  const isConnected = phase === 'connected';
  const dotColor = isConnected ? 'var(--accent-green)' : 'var(--accent-orange)';

  useEffect(() => {
    if (!lastError) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [lastError, clearError]);

  const ipv6 = connectedIpv6 ?? '…';

  return (
    <div style={{
      position: 'absolute',
      top: '8px',
      right: '8px',
      zIndex: 200,
      minWidth: '240px',
      maxWidth: '360px',
      background: 'var(--bg-panel-3)',
      border: '1px solid var(--border-bright)',
      borderRadius: '2px',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      animation: 'fade-in 0.2s ease',
    }}>
      {/* Connection row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          flexShrink: 0,
          background: dotColor,
          boxShadow: isConnected ? 'var(--glow-green)' : 'var(--glow-orange)',
          animation: isConnected ? 'pulse-orange 2s ease infinite' : 'blink 0.8s step-start infinite',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '9px',
            letterSpacing: '0.12em',
            color: 'var(--text-dim)',
            marginBottom: '2px',
          }}>
            {phase === 'connecting' ? 'CONNECTING' : phase === 'disconnecting' ? 'DISCONNECTING' : 'CONNECTED'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ color: 'var(--accent-green)' }}>{ipv6.slice(0, -8)}</span>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{ipv6.slice(-8)}</span>
          </div>
        </div>
        <button
          className="btn btn-sm"
          onClick={disconnect}
          disabled={phase === 'disconnecting' || phase === 'connecting'}
          style={{
            fontSize: '9px',
            padding: '2px 8px',
            letterSpacing: '0.1em',
            flexShrink: 0,
            opacity: phase === 'connected' ? 1 : 0.5,
          }}
        >
          DISCONNECT
        </button>
      </div>

      {/* Trace row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 6px',
        background: tracing ? `${dangerColor}11` : 'var(--bg-panel-2)',
        border: `1px solid ${tracing ? `${dangerColor}44` : 'var(--border)'}`,
        borderRadius: '1px',
      }}>
        <span style={{
          fontSize: '9px',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tracing ? dangerColor : 'var(--text-dim)',
          minWidth: '52px',
          animation: traceLevel === 'critical' || traceLevel === 'caught'
            ? 'pulse-orange 0.6s ease infinite'
            : 'none',
        }}>
          {tracing ? 'TRACE' : 'TRACE //'}
        </span>

        {tracing ? (
          <>
            <div style={{
              flex: 1,
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
              color: dangerColor,
              fontWeight: 700,
              minWidth: '28px',
              textAlign: 'right',
            }}>
              {Math.round(tracePercent)}%
            </span>
            <span style={{
              fontSize: '9px',
              color: dangerColor,
              animation: traceLevel === 'critical' ? 'blink 0.5s step-start infinite' : 'none',
            }}>
              {fmtTrace(traceRemainingSeconds)}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '9px', color: 'var(--accent-green)', opacity: 0.7, letterSpacing: '0.08em' }}>
            CLEAR
          </span>
        )}
      </div>

      {/* Error toast */}
      {lastError && (
        <div style={{
          fontSize: '9px',
          color: 'var(--accent-red)',
          letterSpacing: '0.06em',
          borderTop: '1px solid var(--border)',
          paddingTop: '6px',
        }}>
          {lastError}
        </div>
      )}
    </div>
  );
}
