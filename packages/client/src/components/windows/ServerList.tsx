import { useState, useEffect, useCallback } from 'react';
import { passwordLevelSummary } from '@port0/shared/world/passwordLevelLabel';
import { useApi } from '../../hooks/useApi';
import type { ConnectionPhase } from '../../hooks/useHackSession';

interface Machine {
  ipv6: string;
  osArchetypeId: string;
  securitySummary: string;
  passwordLevel: number;
  isLandmark: boolean;
  status?: 'unknown' | 'online' | 'owned';
}

interface WorldNode {
  ipv6: string;
  osArchetypeId: string;
  isLandmark: boolean;
  passwordLevel: number;
}

function securityColor(passwordLevel: number): string {
  if (passwordLevel >= 3) return 'var(--accent-red)';
  if (passwordLevel === 2) return 'var(--accent-orange)';
  return 'var(--accent-green)';
}

function mapNode(node: WorldNode, owned: string[]): Machine {
  const isOwned = owned.includes(node.ipv6);
  return {
    ipv6: node.ipv6,
    osArchetypeId: node.osArchetypeId,
    securitySummary: passwordLevelSummary(node.passwordLevel),
    passwordLevel: node.passwordLevel,
    isLandmark: node.isLandmark,
    status: isOwned ? 'owned' : 'online',
  };
}

interface Props {
  accountId: string;
  onConnect?: (ipv6: string) => void;
  connectedIpv6?: string | null;
  connectingIpv6?: string | null;
  connectionPhase?: ConnectionPhase;
}

export function ServerList({
  accountId,
  onConnect,
  connectedIpv6,
  connectingIpv6,
  connectionPhase = 'idle',
}: Props) {
  const { get } = useApi(accountId);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      get<{ nodes: WorldNode[] }>('/world/nodes'),
      get<{ machines: string[] }>('/fleet').catch(() => ({ machines: [] as string[] })),
    ])
      .then(([nodesRes, fleetRes]) => {
        if (cancelled) return;
        const fleet = fleetRes.machines ?? [];
        setOwned(fleet);
        setMachines((nodesRes.nodes ?? []).map(n => mapNode(n, fleet)));
      })
      .catch(() => {
        if (!cancelled) setMachines([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [get]);

  const handleConnect = useCallback((ipv6: string) => {
    onConnect?.(ipv6);
  }, [onConnect]);

  const connectButtonState = (ipv6: string) => {
    const normalized = ipv6.toLowerCase();
    const connected = connectedIpv6?.toLowerCase() ?? null;
    const connecting = connectingIpv6?.toLowerCase() ?? null;

    if (connectionPhase === 'connecting' && connecting === normalized) {
      return { label: 'CONNECTING...', disabled: true, style: {} };
    }

    if (connectionPhase === 'connected' && connected === normalized) {
      return {
        label: 'CONNECTED',
        disabled: true,
        style: { color: 'var(--accent-green)', borderColor: 'var(--accent-green)' },
      };
    }

    if (
      connectionPhase === 'connected'
      || connectionPhase === 'disconnecting'
      || connectionPhase === 'connecting'
    ) {
      return { label: 'CONNECT', disabled: true, style: {} };
    }

    return { label: 'CONNECT', disabled: false, style: {} };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          DISCOVERED <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{machines.length}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          OWNED <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{owned.length}</span>
        </div>
      </div>

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
              {machines.map(m => {
                const btn = connectButtonState(m.ipv6);
                return (
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
                        color: securityColor(m.passwordLevel),
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
                        disabled={btn.disabled}
                        style={{ fontSize: '9px', padding: '1px 8px', letterSpacing: '0.1em', ...btn.style }}
                      >
                        {btn.label}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
