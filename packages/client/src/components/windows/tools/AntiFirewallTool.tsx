import { useCallback, useEffect, useRef, useState } from 'react';
import type { HackSession, SessionEvent } from '../../../hooks/useHackSession';
import { getToolRegistryEntry } from '../../../tools/registry';
import { crackRemainingSeconds, formatDurationSeconds } from '../../../utils/crackTiming';
import { CrackProgressBar } from './CrackProgressBar';
import './cracker-tool.css';

type Status = 'idle' | 'warming' | 'active';

function firewallPenaltyPercent(level: number): number {
  return Math.round((level + 1) * 10);
}

interface Props {
  session: HackSession;
  toolId: string;
  runId?: string;
  onRunLinked?: (runId: string) => void;
}

export function AntiFirewallTool({ session, toolId, runId, onRunLinked }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [disrupted, setDisrupted] = useState(false);
  const linkedRunIdRef = useRef(runId);
  const prevTargetRef = useRef<string | null>(null);

  linkedRunIdRef.current = runId;

  const connected = session.phase === 'connected';
  const targetIpv6 = session.connectedIpv6;
  const displayTarget = targetIpv6 ?? session.connectingIpv6;
  const activeRun = runId
    ? session.runningTools.find(t => t.runId === runId)
    : session.runningTools.find(t => t.toolId === toolId);
  const progress = activeRun?.progressPercent ?? 0;
  const totalDuration = activeRun?.durationSeconds ?? 4;
  const warmRemaining = crackRemainingSeconds(totalDuration, progress);

  const rawFirewallLevel = session.targetFirewallLevel ?? 0;
  const dampenerActive = Boolean(activeRun && progress >= 100);
  const effectiveLevel = dampenerActive ? rawFirewallLevel - 1 : rawFirewallLevel;
  const rawPenalty = firewallPenaltyPercent(rawFirewallLevel);
  const effectivePenalty = firewallPenaltyPercent(effectiveLevel);

  const toolMeta = getToolRegistryEntry(toolId);
  const toolMaxLevel = toolMeta?.maxSecurityLevel ?? 5;
  const levelBlocked = Boolean(
    connected
    && session.targetFirewallLevel != null
    && toolMaxLevel < session.targetFirewallLevel,
  );
  const levelErrorMessage = levelBlocked
    ? `INSUFFICIENT TOOL LEVEL — target firewall L${session.targetFirewallLevel}, dampener max L${toolMaxLevel}`
    : null;
  const reactiveLevelError = session.lastError?.toLowerCase().includes('insufficient tool level')
    ? session.lastError
    : null;
  const alreadyRunningError = session.lastError?.toLowerCase().includes('already running')
    ? session.lastError
    : null;
  const toolError = levelErrorMessage ?? reactiveLevelError ?? alreadyRunningError;
  const canStart = connected && !levelBlocked && status !== 'active' && status !== 'warming';

  const resetState = useCallback(() => {
    setStatus('idle');
    setDisrupted(false);
    linkedRunIdRef.current = undefined;
    onRunLinked?.('');
  }, [onRunLinked]);

  useEffect(() => {
    const prevTarget = prevTargetRef.current;
    if (targetIpv6 && targetIpv6 !== prevTarget && session.phase === 'connected') {
      resetState();
    }
    if (!targetIpv6 && prevTarget) {
      resetState();
    }
    prevTargetRef.current = targetIpv6;
  }, [targetIpv6, session.phase, resetState]);

  useEffect(() => {
    return session.subscribe((event: SessionEvent) => {
      if (event.type === 'tool_started' && event.toolId === toolId) {
        linkedRunIdRef.current = event.runId;
        onRunLinked?.(event.runId);
        setStatus('warming');
        setDisrupted(false);
      }
      if (event.type === 'tool_completed' && event.toolId === toolId) {
        setStatus('active');
      }
      if (event.type === 'tool_disrupted' && event.toolId === toolId && event.disruptionKind === 'disconnect') {
        resetState();
        setDisrupted(true);
      }
      if (event.type === 'ended') {
        resetState();
      }
    });
  }, [session, toolId, onRunLinked, resetState]);

  useEffect(() => {
    if (activeRun && progress >= 100) {
      setStatus('active');
    } else if (activeRun && status !== 'warming') {
      setStatus('warming');
    } else if (!activeRun && status !== 'idle') {
      setStatus('idle');
    }
  }, [activeRun, progress, status]);

  const start = useCallback(() => {
    if (!canStart) return;
    session.runTool(toolId);
  }, [canStart, session, toolId]);

  const kill = useCallback(() => {
    const id = linkedRunIdRef.current ?? activeRun?.runId;
    if (id) session.cancelTool(id);
    resetState();
  }, [session, activeRun?.runId, resetState]);

  const statusLabel =
    status === 'active' ? 'ACTIVE'
      : status === 'warming' ? 'WARMING'
        : 'IDLE';

  const firewallSummary = dampenerActive
    ? `FIREWALL L${rawFirewallLevel} (+${rawPenalty}%) → ACTIVE: L${effectiveLevel} (+${effectivePenalty}%)`
    : `FIREWALL L${rawFirewallLevel} (+${rawPenalty}% TOOL DELAY)`;

  return (
    <div className="cracker-tool">
      <div className="cracker-header">
        <div>
          <div className="cracker-version">DAMPENER v0.1 // SHAREWARE</div>
          <div className="cracker-target">{displayTarget ?? 'NO TARGET'}</div>
        </div>
        <span className={`cracker-status ${status === 'active' ? 'cracked' : status}`}>{statusLabel}</span>
      </div>

      <div className={`cracker-estimate ${status === 'active' ? 'success' : toolError ? 'danger' : disrupted ? 'danger' : 'neutral'}`}>
        {toolError
          ? toolError.toUpperCase()
          : disrupted && status === 'idle'
            ? 'DISCONNECTED BY ICE — RE-ACTIVATE TO RESUME'
            : status === 'active'
              ? '▶ DAMPENER ACTIVE — FIREWALL -1 WHILE RUNNING'
              : status === 'warming'
                ? `WARMING UP — ETA ${formatDurationSeconds(warmRemaining)}`
                : firewallSummary}
      </div>

      {status === 'warming' && activeRun && (
        <CrackProgressBar percent={progress} tone="safe" seed={targetIpv6 ?? ''} />
      )}

      {status === 'active' && (
        <div className="cracker-guess-panel safe">
          <div className="cracker-guess safe">
            EFFECTIVE FIREWALL L{effectiveLevel} (+{effectivePenalty}%)
          </div>
        </div>
      )}

      <div className="cracker-actions">
        {status === 'idle' && (
          <button
            className="cracker-btn"
            onClick={start}
            disabled={!canStart}
            title={levelBlocked ? levelErrorMessage ?? undefined : undefined}
          >
            {disrupted ? '[ ACTIVATE AGAIN ]' : '[ START ]'}
          </button>
        )}
        {(status === 'warming' || status === 'active') && (
          <button className="cracker-btn abort" onClick={kill}>
            [ DEACTIVATE ]
          </button>
        )}
      </div>

      {!connected && status === 'idle' && !levelBlocked && (
        <div className="cracker-footnote">CONNECT VIA SERVER LIST</div>
      )}
    </div>
  );
}
