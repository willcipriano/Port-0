import { useState, useEffect, useCallback } from 'react';

import type { Account } from '../../hooks/useAuth';

import type { HackSession } from '../../hooks/useHackSession';

import { useApi } from '../../hooks/useApi';



interface Props {

  account: Account;

  session: HackSession;

  onFocusToolWindow?: (toolId: string) => void;

}



const TOOL_NAMES: Record<string, string> = {

  cracker_l1: 'Auth Cracker L1',

  anti_firewall_l1: 'Firewall Dampener',

  trace_blocker_l1: 'Trace Blocker L1',

  log_cleaner_l1: 'Log Cleaner L1',

  recon_l1: 'Recon Probe L1',

};



export function Hardware({ account, session, onFocusToolWindow }: Props) {

  const [toast, setToast] = useState('');
  const { get } = useApi(account.id);
  const [usedQgb, setUsedQgb] = useState(0);
  const [capacityQgb, setCapacityQgb] = useState(account.rigStats.storage);

  const connected = session.phase === 'connected';

  const totalRam = account.rigStats.ram;

  const totalCpu = account.rigStats.cpu;

  const usedRam = session.ramUsed;

  const usedCpu = session.cpuUsed;

  const freeRam = totalRam - usedRam;

  const freeCpu = totalCpu - usedCpu;

  useEffect(() => {
    let cancelled = false;
    const loadStorage = async () => {
      try {
        const res = await get<{ usedQgb: number; capacityQgb: number }>('/filesystem');
        if (!cancelled) {
          setUsedQgb(res.usedQgb ?? 0);
          setCapacityQgb(res.capacityQgb ?? account.rigStats.storage);
        }
      } catch {
        if (!cancelled) {
          setUsedQgb(0);
          setCapacityQgb(account.rigStats.storage);
        }
      }
    };
    loadStorage();
    const interval = window.setInterval(loadStorage, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [get, account.rigStats.storage]);



  const showToast = useCallback((msg: string) => {

    setToast(msg);

    setTimeout(() => setToast(''), 3000);

  }, []);



  useEffect(() => {

    return session.subscribe((event) => {

      if (event.type === 'tool_started') {

        const name = TOOL_NAMES[event.toolId] ?? event.toolId;

        showToast(`${name} running`);

      } else if (event.type === 'tool_completed') {

        const name = TOOL_NAMES[event.toolId] ?? event.toolId;

        if (event.toolId === 'anti_firewall_l1') {
          showToast(`${name} active`);
        } else {
          showToast(`${name} complete`);
        }

      } else if (event.type === 'error') {

        showToast(event.message);

      }

    });

  }, [session, showToast]);



  return (

    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '8px', overflow: 'hidden', position: 'relative' }}>

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



      <div style={{

        background: 'var(--bg-panel-2)',

        border: '1px solid var(--border)',

        padding: '8px',

        flexShrink: 0,

      }}>

        <div className="label" style={{ marginBottom: '8px' }}>
          RIG HARDWARE
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

          {[

            { label: 'CPU', used: usedCpu, total: totalCpu, unit: 'cores' },

            { label: 'RAM', used: usedRam, total: totalRam, unit: 'GB' },

            { label: 'STORAGE', used: usedQgb, total: capacityQgb, unit: 'QGB' },

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

          <div className="label">
            PROCESS MANAGER — {session.runningTools.length} ACTIVE
          </div>

        </div>



        {!connected && (

          <div style={{

            padding: '6px 8px',

            fontSize: '9px',

            color: 'var(--text-dim)',

            letterSpacing: '0.08em',

            borderBottom: '1px solid var(--border)',

          }}>

            LAUNCH TOOLS FROM P:0 MENU → TOOLZ

          </div>

        )}



        <div style={{ flex: 1, overflow: 'auto' }}>

          {session.runningTools.length === 0 ? (

            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '0.1em' }}>

              NO ACTIVE PROCESSES

            </div>

          ) : (

            session.runningTools.map(tool => (

              <div

                key={tool.runId}

                role="button"

                tabIndex={0}

                onClick={() => onFocusToolWindow?.(tool.toolId)}

                onKeyDown={e => { if (e.key === 'Enter') onFocusToolWindow?.(tool.toolId); }}

                style={{

                  padding: '8px',

                  borderBottom: '1px solid var(--border)44',

                  animation: 'fade-in 0.2s ease',

                  cursor: onFocusToolWindow ? 'pointer' : 'default',

                }}

              >

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>

                  <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600 }}>

                    {TOOL_NAMES[tool.toolId] ?? tool.toolId}

                  </span>

                  <button

                    className="btn btn-danger btn-sm"

                    onClick={(e) => {

                      e.stopPropagation();

                      session.cancelTool(tool.runId);

                    }}

                  >

                    KILL

                  </button>

                </div>

                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '5px', letterSpacing: '0.05em' }}>

                  TARGET: {session.connectedIpv6 ?? '—'}

                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                  <div className="progress-wrap" style={{ flex: 1 }}>

                    <div className="progress-fill" style={{ width: `${tool.progressPercent}%` }} />

                  </div>

                  <span style={{ fontSize: '9px', color: 'var(--accent-green)', minWidth: '32px', textAlign: 'right', fontWeight: 700 }}>

                    {tool.progressPercent}%

                  </span>

                </div>

              </div>

            ))

          )}

        </div>



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

    </div>

  );

}

