import { useState, useEffect } from 'react';
import type { Account } from '../../hooks/useAuth';

interface RunningTool {
  id: string;
  name: string;
  target: string;
  progress: number;
  ram: number;
  cpu: number;
  eta: number;
}

interface Props {
  account: Account;
  onStartTrace?: () => void;
  onStopTrace?: () => void;
  traceActive?: boolean;
}

const TOOL_CATALOG = [
  { id: 'scanner_l1',  name: 'Port Scanner L1',  ram: 1, cpu: 1,  duration: 30 },
  { id: 'cracker_l1',  name: 'Auth Cracker L1',   ram: 2, cpu: 2,  duration: 60 },
  { id: 'logger_l1',   name: 'Keylogger L1',      ram: 1, cpu: 1,  duration: 90 },
  { id: 'virus_v1',    name: 'Virus Payload v1',   ram: 3, cpu: 2,  duration: 45 },
];

let toolRunId = 0;

export function Hardware({ account, onStartTrace, onStopTrace, traceActive }: Props) {
  const [running, setRunning] = useState<RunningTool[]>([]);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedTool, setSelectedTool] = useState(TOOL_CATALOG[0].id);
  const [targetIp, setTargetIp] = useState('2001:db8:1:7::a1');
  const [toast, setToast] = useState('');

  // Animate progress bars
  useEffect(() => {
    if (running.length === 0) return;
    const interval = setInterval(() => {
      setRunning(prev => {
        const updated = prev.map(t => ({
          ...t,
          progress: Math.min(100, t.progress + (100 / t.eta)),
          eta: Math.max(0, t.eta - 1),
        }));
        return updated.filter(t => t.progress < 100);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running.length]);

  const usedRam = running.reduce((s, t) => s + t.ram, 0);
  const usedCpu = running.reduce((s, t) => s + t.cpu, 0);
  const totalRam = account.rigStats.ram;
  const totalCpu = account.rigStats.cpu;
  const freeRam = totalRam - usedRam;
  const freeCpu = totalCpu - usedCpu;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const startTool = () => {
    const tool = TOOL_CATALOG.find(t => t.id === selectedTool)!;
    if (tool.ram > freeRam) { showToast(`INSUFFICIENT RAM — need ${tool.ram} GB, have ${freeRam} GB`); return; }
    if (tool.cpu > freeCpu) { showToast(`INSUFFICIENT CPU — need ${tool.cpu} cores, have ${freeCpu}`); return; }
    if (!targetIp.trim()) { showToast('TARGET REQUIRED'); return; }

    setRunning(prev => [...prev, {
      id: `tool-${toolRunId++}`,
      name: tool.name,
      target: targetIp,
      progress: 0,
      ram: tool.ram,
      cpu: tool.cpu,
      eta: tool.duration,
    }]);
    setShowStartDialog(false);
    if (!traceActive) onStartTrace?.();
    showToast(`${tool.name} deployed to ${targetIp}`);
  };

  const killTool = (id: string) => {
    setRunning(prev => prev.filter(t => t.id !== id));
    showToast('PROCESS TERMINATED');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '8px', overflow: 'hidden' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute',
          top: '8px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-panel-3)',
          border: '1px solid var(--accent-orange)',
          padding: '6px 12px',
          fontSize: '10px',
          color: 'var(--accent-orange)',
          letterSpacing: '0.1em',
          zIndex: 50,
          animation: 'fade-in 0.2s ease',
          borderRadius: '1px',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Rig Stats */}
      <div style={{
        background: 'var(--bg-panel-2)',
        border: '1px solid var(--border)',
        padding: '8px',
        flexShrink: 0,
      }}>
        <div className="label" style={{ marginBottom: '8px', color: 'var(--accent-cyan)', textShadow: 'var(--glow-cyan)' }}>
          RIG HARDWARE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'CPU', used: usedCpu, total: totalCpu, unit: 'cores' },
            { label: 'RAM', used: usedRam, total: totalRam, unit: 'GB' },
            { label: 'STORAGE', used: 12, total: account.rigStats.storage, unit: 'GB' },
            { label: 'BANDWIDTH', used: 0.2, total: account.rigStats.bandwidth, unit: 'Gbps' },
          ].map(stat => {
            const pct = (stat.used / stat.total) * 100;
            const color = pct > 80 ? 'danger' : pct > 60 ? 'warning' : '';
            return (
              <div key={stat.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{stat.label}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-primary)' }}>
                    {stat.used}/{stat.total} {stat.unit}
                  </span>
                </div>
                <div className="progress-wrap">
                  <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Process Manager */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel-2)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div className="label" style={{ color: 'var(--accent-green)', textShadow: 'var(--glow-green)' }}>
            PROCESS MANAGER — {running.length} ACTIVE
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowStartDialog(true)}
          >
            + DEPLOY
          </button>
        </div>

        {/* Tool list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {running.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '0.1em' }}>
              NO ACTIVE PROCESSES
            </div>
          ) : (
            running.map(tool => (
              <div key={tool.id} style={{
                padding: '8px',
                borderBottom: '1px solid var(--border)44',
                animation: 'fade-in 0.2s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600 }}>{tool.name}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => killTool(tool.id)}>
                    KILL
                  </button>
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                  TARGET: {tool.target}  ·  RAM: {tool.ram}GB  ·  CPU: {tool.cpu}  ·  ETA: {tool.eta}s
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{ width: `${tool.progress}%` }} />
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--accent-green)', minWidth: '32px', textAlign: 'right', fontWeight: 700 }}>
                    {Math.round(tool.progress)}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resource summary bar */}
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '5px 8px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          fontSize: '9px',
          color: 'var(--text-dim)',
          letterSpacing: '0.08em',
        }}>
          <span>CPU FREE: <span style={{ color: freeCpu > 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>{freeCpu}/{totalCpu}</span></span>
          <span>RAM FREE: <span style={{ color: freeRam > 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>{freeRam}/{totalRam} GB</span></span>
        </div>
      </div>

      {/* Start tool dialog */}
      {showStartDialog && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5,8,16,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          animation: 'fade-in 0.15s ease',
        }}>
          <div style={{
            width: '280px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderTop: '2px solid var(--accent-green)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div className="label" style={{ color: 'var(--accent-green)', textShadow: 'var(--glow-green)' }}>
              DEPLOY TOOL
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="label">Tool</label>
              <select
                value={selectedTool}
                onChange={e => setSelectedTool(e.target.value)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-bright)',
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  borderRadius: '2px',
                  outline: 'none',
                }}
              >
                {TOOL_CATALOG.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} (RAM:{t.ram} CPU:{t.cpu})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="label">Target IPv6</label>
              <input
                type="text"
                value={targetIp}
                onChange={e => setTargetIp(e.target.value)}
                placeholder="2001:db8:1:7::a1"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={startTool}>
                DEPLOY
              </button>
              <button className="btn" onClick={() => setShowStartDialog(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
