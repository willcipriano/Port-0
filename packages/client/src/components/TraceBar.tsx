import type { TraceState } from '../hooks/useTrace';
import type { Account } from '../hooks/useAuth';

interface Props {
  trace: TraceState;
  account: Account;
  onLogout: () => void;
  tickTime: string;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function TraceBar({ trace, account, onLogout, tickTime }: Props) {
  const dangerColor = trace.level === 'caught' || trace.level === 'critical'
    ? 'var(--accent-red)' : trace.level === 'warning'
    ? 'var(--accent-orange)' : 'var(--accent-green)';

  const progressColor = trace.level === 'critical' || trace.level === 'caught'
    ? 'danger' : trace.level === 'warning' ? 'warning' : '';

  return (
    <header style={{
      height: 'var(--header-h)',
      background: 'var(--bg-panel-3)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: '16px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        fontWeight: 700,
        fontSize: '13px',
        letterSpacing: '0.25em',
        color: 'var(--accent-cyan)',
        textShadow: 'var(--glow-cyan)',
        marginRight: '8px',
        userSelect: 'none',
      }}>
        PORT:0
      </div>

      {/* Separator */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

      {/* Trace section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <span style={{
          fontSize: '10px',
          letterSpacing: '0.15em',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: trace.active ? dangerColor : 'var(--text-dim)',
          textShadow: trace.active && trace.level !== 'safe' ? `0 0 8px ${dangerColor}` : 'none',
          animation: trace.level === 'critical' || trace.level === 'caught'
            ? 'pulse-orange 0.6s ease infinite' : 'none',
          minWidth: '50px',
        }}>
          {trace.active ? 'TRACE' : 'IDLE'}
        </span>

        {trace.active ? (
          <>
            <div style={{ width: '120px', position: 'relative' }}>
              <div className="progress-wrap">
                <div
                  className={`progress-fill ${progressColor}`}
                  style={{ width: `${trace.percent}%` }}
                />
              </div>
            </div>
            <span style={{
              fontSize: '10px',
              letterSpacing: '0.1em',
              color: dangerColor,
              textShadow: `0 0 8px ${dangerColor}`,
              minWidth: '36px',
              fontWeight: 700,
            }}>
              {Math.round(trace.percent)}%
            </span>
            <span style={{
              fontSize: '10px',
              color: dangerColor,
              opacity: 0.8,
              animation: trace.level === 'critical' ? 'blink 0.5s step-start infinite' : 'none',
            }}>
              T–{fmt(trace.secondsLeft)}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'normal' }}>
            NO ACTIVE SESSION
          </span>
        )}
      </div>

      {/* Right side: tick + operator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
          TICK <span style={{ color: 'var(--text-muted)' }}>{tickTime}</span>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--text-dim)' }}>OP//</span>
            <span style={{ color: 'var(--accent-green)', textShadow: 'var(--glow-green)', fontWeight: 700 }}>
              {account.displayHandle}
            </span>
          </span>
          <span style={{
            fontSize: '10px',
            color: 'var(--accent-cyan)',
            fontWeight: 600,
          }}>
            ₿{account.cryptoBalance.toLocaleString()}
          </span>
          <button
            className="btn btn-sm"
            onClick={onLogout}
            style={{ fontSize: '9px', padding: '1px 6px', letterSpacing: '0.1em' }}
          >
            DISC
          </button>
        </div>
      </div>

      {/* Bottom glow line */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '1px',
        background: trace.active && trace.level !== 'safe'
          ? `linear-gradient(to right, transparent, ${dangerColor}, transparent)`
          : 'linear-gradient(to right, transparent, var(--accent-cyan)44, transparent)',
        boxShadow: trace.active ? `0 0 8px ${dangerColor}` : 'none',
        transition: 'all 0.5s ease',
      }} />
    </header>
  );
}
