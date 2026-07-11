import { useEffect, useState, useCallback } from 'react';
import type { HackSession } from '../hooks/useHackSession';

interface Toast {
  id: number;
  message: string;
  detail?: string;
  tone: 'success' | 'error' | 'warning';
}

interface Props {
  session: HackSession;
}

let toastId = 0;

export function SessionNotification({ session }: Props) {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((next: Omit<Toast, 'id'>) => {
    toastId += 1;
    setToast({ ...next, id: toastId });
  }, []);

  useEffect(() => {
    return session.subscribe((event) => {
      if (event.type === 'password_saved') {
        const suffix = event.targetIpv6.slice(-8);
        showToast({
          tone: 'success',
          message: 'PASSWORD SAVED TO VAULT',
          detail: event.targetIpv6.slice(0, -8) + suffix,
        });
      }
      if (event.type === 'tool_disrupted') {
        showToast({
          tone: 'warning',
          message: event.message.toUpperCase(),
        });
      }
    });
  }, [session, showToast]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const accent = toast.tone === 'success'
    ? 'var(--accent-green)'
    : toast.tone === 'warning'
      ? 'var(--accent-orange)'
      : 'var(--accent-red)';

  return (
    <div
      className="session-notification"
      key={toast.id}
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 250,
        minWidth: '280px',
        maxWidth: '420px',
        padding: '10px 14px',
        background: 'var(--bg-panel-3)',
        border: `1px solid ${accent}`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: toast.tone === 'success'
          ? 'var(--glow-green)'
          : toast.tone === 'warning'
            ? '0 0 12px rgba(255, 140, 0, 0.35)'
            : 'var(--glow-red)',
        animation: 'fade-in 0.25s ease, session-toast-out 0.3s ease 4.2s forwards',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: accent,
        marginBottom: toast.detail ? '4px' : 0,
      }}>
        {toast.message}
      </div>
      {toast.detail && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {toast.detail}
        </div>
      )}
    </div>
  );
}
