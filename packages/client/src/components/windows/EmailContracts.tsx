import { useState } from 'react';

interface Contract {
  id: string;
  from: string;
  subject: string;
  preview: string;
  reward: number;
  status: 'new' | 'active' | 'completed' | 'failed';
  body: string;
  deadline?: string;
}

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c001',
    from: 'CLIENT::PHANTOM',
    subject: 'Retrieve file from Nexus Corp subnet',
    preview: 'Extract config.db from target 2001:db8:1:7::a1. Do not leave traces.',
    reward: 250,
    status: 'new',
    body: `Operator,

I require a file retrieved from a target inside the Shady Hollow subnet.

Target: 2001:db8:1:7::a1
File: /root/config.db

You must extract this file cleanly. Any trace-back to this account will void payment.

Payment: ₿250 on delivery. No partial payment.

— PHANTOM`,
    deadline: '2026-06-22',
  },
  {
    id: 'c002',
    from: 'CLIENT::IRON_BROKER',
    subject: 'Disable logging on ISP landmark',
    preview: 'Temporarily disable the access log daemon on the ISP landmark node.',
    reward: 400,
    status: 'active',
    body: `Operator,

Our window is narrow. I need the logging daemon on the landmark node (2001:db8:1:7::1) taken offline for at least 30 minutes.

This is a surgical op — do NOT damage the node or alter configs permanently.

Payment: ₿400. Bonus ₿100 if completed within the hour.

— IRON_BROKER`,
    deadline: '2026-06-20',
  },
  {
    id: 'c003',
    from: 'SYSTEM::AUTHORITY',
    subject: '[NOTICE] Warrant — Account Review',
    preview: 'Your account has been flagged for review. Continued activity may result in enforcement.',
    reward: 0,
    status: 'new',
    body: `NOTICE OF REVIEW

Account flagged by automated security sweep.

Evidence of unauthorized access logged from your subnet. A 48-hour grace period is in effect.

Cease activity to avoid enforcement action.

— NETWORK AUTHORITY`,
  },
  {
    id: 'c004',
    from: 'CLIENT::VOIDRUNNER',
    subject: 'Simple delivery: plant virus',
    preview: 'Plant a dormant virus payload on a target node. Timer-activated.',
    reward: 180,
    status: 'completed',
    body: `Completed. Payment transferred.`,
  },
];

const STATUS_STYLE: Record<Contract['status'], { color: string; label: string }> = {
  new:       { color: 'var(--accent-cyan)',   label: 'NEW' },
  active:    { color: 'var(--accent-orange)', label: 'ACTIVE' },
  completed: { color: 'var(--text-dim)',       label: 'DONE' },
  failed:    { color: 'var(--accent-red)',     label: 'FAILED' },
};

export function EmailContracts() {
  const [selected, setSelected] = useState<string | null>('c001');
  const [contracts, setContracts] = useState(MOCK_CONTRACTS);

  const current = contracts.find(c => c.id === selected);

  const accept = (id: string) => {
    setContracts(prev => prev.map(c => c.id === id ? { ...c, status: 'active' as const } : c));
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '1px' }}>
      {/* Inbox list */}
      <div style={{
        width: '220px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}>
          INBOX — {contracts.filter(c => c.status === 'new').length} UNREAD
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {contracts.map(c => {
            const s = STATUS_STYLE[c.status];
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c.id)}
                style={{
                  padding: '8px',
                  borderBottom: '1px solid var(--border)44',
                  cursor: 'pointer',
                  background: selected === c.id ? 'rgba(0,229,255,0.06)' : 'transparent',
                  borderLeft: selected === c.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                    {c.from}
                  </span>
                  <span style={{ fontSize: '9px', color: s.color, fontWeight: 700 }}>
                    {s.label}
                  </span>
                </div>
                <div style={{
                  fontSize: '11px',
                  color: c.status === 'new' ? 'var(--text-bright)' : 'var(--text-primary)',
                  fontWeight: c.status === 'new' ? 600 : 400,
                  marginBottom: '2px',
                  lineHeight: 1.3,
                }}>
                  {c.subject}
                </div>
                {c.reward > 0 && (
                  <div style={{ fontSize: '10px', color: 'var(--accent-green)', fontWeight: 700 }}>
                    ₿{c.reward}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px' }}>
        {current ? (
          <>
            <div style={{
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border)',
              marginBottom: '10px',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: '13px', color: 'var(--text-bright)', fontWeight: 700, marginBottom: '6px' }}>
                {current.subject}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>FROM: <span style={{ color: 'var(--accent-cyan)' }}>{current.from}</span></span>
                {current.deadline && <span>DEADLINE: <span style={{ color: 'var(--accent-orange)' }}>{current.deadline}</span></span>}
                {current.reward > 0 && <span>REWARD: <span style={{ color: 'var(--accent-green)', fontWeight: 700, textShadow: 'var(--glow-green)' }}>₿{current.reward}</span></span>}
              </div>
            </div>

            <div style={{
              flex: 1,
              overflow: 'auto',
              fontSize: '11px',
              lineHeight: '1.7',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}>
              {current.body}
            </div>

            {(current.status === 'new') && (
              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button className="btn btn-primary btn-sm" onClick={() => accept(current.id)}>
                  ACCEPT CONTRACT
                </button>
                <button className="btn btn-danger btn-sm">
                  DECLINE
                </button>
              </div>
            )}
            {current.status === 'active' && (
              <div style={{
                paddingTop: '10px', borderTop: '1px solid var(--border)', flexShrink: 0,
                fontSize: '10px', color: 'var(--accent-orange)', letterSpacing: '0.1em',
              }}>
                ▸ CONTRACT IN PROGRESS
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
            SELECT MESSAGE
          </div>
        )}
      </div>
    </div>
  );
}
