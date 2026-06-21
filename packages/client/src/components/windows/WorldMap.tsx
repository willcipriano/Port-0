import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';

interface SubnetInfo {
  zoneId: string;
  zoneName: string;
  subnetId: string;
  prefix: string;
  machineCount: number;
  landmarkCount: number;
  theme: string;
}

const HEAT_LABELS = ['COLD', 'WARM', 'HOT', 'CRITICAL'];
const HEAT_COLORS = ['var(--accent-green)', 'var(--accent-yellow)', 'var(--accent-orange)', 'var(--accent-red)'];

function HexGrid({ seed }: { seed: number }) {
  const nodes = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    active: (i * 7 + seed) % 13 < 5,
    landmark: (i * 11 + seed) % 47 === 0,
    hot: (i * 3 + seed) % 23 < 2,
  }));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(10, 1fr)',
      gap: '3px',
      padding: '4px',
      flex: 1,
    }}>
      {nodes.map(n => (
        <div
          key={n.id}
          title={n.landmark ? 'LANDMARK' : `NODE::${n.id.toString(16).padStart(4, '0').toUpperCase()}`}
          style={{
            aspectRatio: '1',
            background: n.landmark
              ? 'rgba(0, 229, 255, 0.15)'
              : n.hot
              ? 'rgba(255, 34, 68, 0.12)'
              : n.active
              ? 'rgba(0, 255, 159, 0.08)'
              : 'rgba(255,255,255,0.02)',
            border: `1px solid ${
              n.landmark ? 'var(--accent-cyan)66'
              : n.hot ? 'var(--accent-red)55'
              : n.active ? 'var(--accent-green)33'
              : 'var(--border)44'
            }`,
            borderRadius: '1px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: n.landmark
              ? '0 0 4px var(--accent-cyan)44'
              : n.hot ? '0 0 4px var(--accent-red)33' : 'none',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)';
            (e.currentTarget as HTMLElement).style.zIndex = '10';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = '';
            (e.currentTarget as HTMLElement).style.zIndex = '';
          }}
        />
      ))}
    </div>
  );
}

export function WorldMap() {
  const { get } = useApi();
  const [subnet, setSubnet] = useState<SubnetInfo | null>(null);
  const [heat, setHeat] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  useEffect(() => {
    get<{ subnet: SubnetInfo; heatLevel: number }>('/world/subnet')
      .then(d => { setSubnet(d.subnet); setHeat(d.heatLevel); })
      .catch(() => {});
  }, [get]);

  const startScan = async () => {
    setScanning(true);
    setScanStatus('SCAN INITIATED...');
    try {
      await new Promise(r => setTimeout(r, 800));
      setScanStatus('PROBING SUBNET...');
      await new Promise(r => setTimeout(r, 600));
      setScanStatus('SCAN COMPLETE — 2 HOSTS DISCOVERED');
      setTimeout(() => setScanStatus(''), 3000);
    } finally {
      setScanning(false);
    }
  };

  const heatColor = HEAT_COLORS[Math.min(heat, 3)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '8px' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700, letterSpacing: '0.15em' }}>
            {subnet?.zoneName ?? '...'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: '1px' }}>
            {subnet?.prefix ?? '—'}  ·  {subnet?.machineCount ?? 0} NODES
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: heatColor,
            textShadow: `0 0 6px ${heatColor}`,
          }}>
            HEAT: {HEAT_LABELS[Math.min(heat, 3)]}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={startScan}
            disabled={scanning}
          >
            {scanning ? 'SCAN...' : 'SCAN'}
          </button>
        </div>
      </div>

      {/* Status line */}
      {scanStatus && (
        <div style={{
          fontSize: '10px',
          color: 'var(--accent-green)',
          textShadow: 'var(--glow-green)',
          animation: 'fade-in 0.2s ease',
          letterSpacing: '0.08em',
          flexShrink: 0,
        }}>
          ▸ {scanStatus}
        </div>
      )}

      {/* Hex node grid */}
      <div style={{
        flex: 1,
        background: 'var(--bg-panel-2)',
        border: '1px solid var(--border)',
        borderRadius: '2px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(var(--border)22 1px, transparent 1px),
            linear-gradient(90deg, var(--border)22 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          pointerEvents: 'none',
        }} />
        <HexGrid seed={subnet ? parseInt(subnet.subnetId.slice(-4), 16) || 42 : 42} />
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexShrink: 0,
        fontSize: '9px',
        color: 'var(--text-dim)',
        letterSpacing: '0.08em',
      }}>
        <span style={{ color: 'var(--accent-green)33', borderBottom: '1px solid var(--accent-green)33' }}>◆ NODE</span>
        <span style={{ color: 'var(--accent-cyan)66' }}>◆ LANDMARK</span>
        <span style={{ color: 'var(--accent-red)66' }}>◆ HOT</span>
      </div>
    </div>
  );
}
