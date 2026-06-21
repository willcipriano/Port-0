import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';

interface Machine {
  ipv6: string;
  osArchetypeId: string;
  securitySummary: string;
  isLandmark: boolean;
  status?: 'unknown' | 'online' | 'owned';
}

const MOCK_MACHINES: Machine[] = [
  { ipv6: '2001:db8:1:7::a1', osArchetypeId: 'cheap_server', securitySummary: 'L1 mixed', isLandmark: false, status: 'online' },
  { ipv6: '2001:db8:1:7::b2', osArchetypeId: 'cheap_server', securitySummary: 'L1 auth', isLandmark: false, status: 'unknown' },
  { ipv6: '2001:db8:1:7::1',  osArchetypeId: 'landmark_isp', securitySummary: 'L3 hardened', isLandmark: true, status: 'online' },
  { ipv6: '2001:db8:1:7::c4', osArchetypeId: 'cheap_server', securitySummary: 'L1 weak', isLandmark: false, status: 'unknown' },
];

export function ServerList({ onConnect }: { onConnect?: (ipv6: string) => void }) {
  const { get } = useApi();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading, use mock data
    setTimeout(() => {
      setMachines(MOCK_MACHINES);
      setLoading(false);
    }, 400);
    get<{ machines: string[] }>('/fleet')
      .then(d => setOwned(d.machines ?? []))
      .catch(() => {});
  }, [get]);

  const handleConnect = useCallback((ipv6: string) => {
    onConnect?.(ipv6);
  }, [onConnect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '8px' }}>
      {/* Counts */}
      <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          DISCOVERED <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{machines.length}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          OWNED <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{owned.length}</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px', letterSpacing: '0.1em' }}>
            QUERYING SUBNET<span style={{ animation: 'blink 0.8s step-start infinite' }}>_</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>OS</th>
                <th>Security</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {machines.map(m => (
                <tr
                  key={m.ipv6}
                  className={selected === m.ipv6 ? 'selected' : ''}
                  onClick={() => setSelected(m.ipv6)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                    {m.isLandmark && (
                      <span style={{ color: 'var(--accent-cyan)', marginRight: '4px' }}>★</span>
                    )}
                    <span style={{ color: 'var(--accent-green)' }}>
                      {m.ipv6.slice(0, -8)}
                    </span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {m.ipv6.slice(-8)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    {m.osArchetypeId.replace(/_/g, ' ').toUpperCase()}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '10px',
                      color: m.securitySummary.includes('weak') ? 'var(--accent-green)'
                           : m.securitySummary.includes('hard') ? 'var(--accent-red)'
                           : 'var(--accent-orange)',
                    }}>
                      {m.securitySummary.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      m.status === 'owned' ? 'badge-ok'
                      : m.status === 'online' ? 'badge-info'
                      : 'badge-dim'
                    }`}>
                      {m.status ?? 'UNKNOWN'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={e => { e.stopPropagation(); handleConnect(m.ipv6); }}
                      style={{ fontSize: '9px', padding: '1px 8px', letterSpacing: '0.1em' }}
                    >
                      CONNECT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected machine detail */}
      {selected && (
        <div style={{
          flexShrink: 0,
          background: 'var(--bg-panel-2)',
          border: '1px solid var(--border)',
          borderLeft: '2px solid var(--accent-cyan)',
          padding: '6px 10px',
          fontSize: '10px',
          animation: 'fade-in 0.2s ease',
        }}>
          <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TARGET // </span>
          <span style={{ color: 'var(--accent-cyan)' }}>{selected}</span>
        </div>
      )}
    </div>
  );
}
