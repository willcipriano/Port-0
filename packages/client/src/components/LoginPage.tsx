import { useState, useEffect } from 'react';

interface Props {
  onLogin: (handle: string, password: string) => void;
  connecting: boolean;
  error?: string;
}

const BOOT_LINES = [
  'PORT 0 UPLINK TERMINAL v2.1.4',
  '──────────────────────────────────',
  'Initializing secure tunnel...',
  'Loading encryption modules... [OK]',
  'Establishing darknet handshake...',
  'Routing through anonymous relay... [OK]',
  'Checking operator credentials...',
  '──────────────────────────────────',
  'AUTHENTICATION REQUIRED',
];

export function LoginPage({ onLogin, connecting, error }: Props) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [visibleLines, setVisibleLines] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const advance = (i: number) => {
      if (i >= BOOT_LINES.length) {
        setTimeout(() => setReady(true), 300);
        return;
      }
      setVisibleLines(i + 1);
      setTimeout(() => advance(i + 1), 80 + Math.random() * 120);
    };
    advance(0);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (connecting || !handle) return;
    onLogin(handle, password);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      animation: 'fade-in 0.4s ease',
    }}>
      <div style={{
        width: '440px',
        animation: 'slide-in-left 0.5s ease',
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <pre style={{
            color: 'var(--accent-cyan)',
            fontSize: '11px',
            lineHeight: 1.2,
            textShadow: 'var(--glow-cyan)',
            fontFamily: 'var(--font-mono)',
            display: 'inline-block',
          }}>
{`██████╗  ██████╗ ██████╗ ████████╗     ██████╗
██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝    ██╔═████╗
██████╔╝██║   ██║██████╔╝   ██║       ██║██╔██║
██╔═══╝ ██║   ██║██╔══██╗   ██║       ████╔╝██║
██║     ╚██████╔╝██║  ██║   ██║    ██╗╚██████╔╝
╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═╝ ╚═════╝`}
          </pre>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.3em', marginTop: '4px' }}>
            UNDERGROUND NETWORK OPERATIONS
          </div>
        </div>

        {/* Boot log */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderTop: '2px solid var(--accent-cyan)',
          padding: '12px 16px',
          marginBottom: '16px',
          minHeight: '160px',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: '-1px', left: '0', right: '0',
            height: '1px',
            background: 'linear-gradient(to right, transparent, var(--accent-cyan), transparent)',
            boxShadow: 'var(--glow-cyan)',
          }} />
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div key={i} style={{
              fontSize: '11px',
              lineHeight: '1.6',
              color: line.startsWith('PORT') || line.startsWith('AUTH') ? 'var(--accent-cyan)' :
                     line.startsWith('──')  ? 'var(--border-bright)' :
                     line.endsWith('[OK]')  ? 'var(--accent-green)' : 'var(--text-primary)',
              textShadow: line.endsWith('[OK]') ? 'var(--glow-green)' : 'none',
            }}>
              {line}
            </div>
          ))}
          {visibleLines < BOOT_LINES.length && (
            <span className="cursor" />
          )}
        </div>

        {/* Login form */}
        {ready && (
          <form onSubmit={submit} style={{ animation: 'fade-in 0.3s ease' }}>
            <div style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div className="label" style={{ color: 'var(--accent-green)', textShadow: 'var(--glow-green)', marginBottom: '4px' }}>
                OPERATOR CREDENTIALS
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="label">Handle</label>
                <input
                  type="text"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  placeholder="ghost_operator"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={connecting}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="label">Access Key</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={connecting}
                />
              </div>

              {error && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--accent-red)',
                  textShadow: 'var(--glow-red)',
                  padding: '6px 8px',
                  background: 'rgba(255,34,68,0.08)',
                  border: '1px solid var(--accent-red)44',
                  animation: 'fade-in 0.2s ease',
                }}>
                  ✗ {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={connecting || !handle}
                style={{ marginTop: '4px', padding: '8px', fontSize: '11px', letterSpacing: '0.2em' }}
              >
                {connecting ? (
                  <span>CONNECTING<span style={{ animation: 'blink 0.8s step-start infinite' }}>_</span></span>
                ) : (
                  'ESTABLISH UPLINK'
                )}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
              ALL CONNECTIONS ENCRYPTED • UNAUTHORIZED ACCESS IS PROHIBITED
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
