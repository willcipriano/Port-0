import { useState, useEffect, useRef, useCallback } from 'react';
import type { HackSession, SessionEvent } from '../../../hooks/useHackSession';
import { TOOL_REGISTRY, getToolRegistryEntry } from '../../../tools/registry';
import {
  buildCrackDisplay,
  crackScrambleInterval,
  parseCrackedPassword,
  type CrackDisplayChar,
} from '../../../utils/bruteForceAnimation';
import {
  crackRemainingSeconds,
  estimateCrackRace,
  ESTIMATE_CALC_DELAY_MS,
  formatDurationSeconds,
  formatEstimateDisplay,
  rollCrackEstimate,
} from '../../../utils/crackTiming';
import { CrackProgressBar } from './CrackProgressBar';
import './cracker-tool.css';

type Status = 'idle' | 'running' | 'cracked' | 'failed';
type EstimatePhase = 'idle' | 'calculating' | 'ready' | 'recalibrating';
type UiPhase = 'idle' | 'resetting' | 'arming' | 'linking' | 'breaking' | 'victory';

const DEFAULT_EST_SECONDS = TOOL_REGISTRY.brute_force.estimatedDurationSeconds;
const RESET_ANIM_MS = 480;
const ARM_ANIM_MS = 550;
const BREAK_ANIM_MS = 420;
const VICTORY_ANIM_MS = 1850;

function initialCrackerFields() {
  return {
    status: 'idle' as Status,
    estimatePhase: 'idle' as EstimatePhase,
    rolledEstimate: DEFAULT_EST_SECONDS,
    displayChars: null as CrackDisplayChar[] | null,
    passwordLength: 8,
    crackedPassword: null as string | null,
    revealedPrefix: '',
    durationSeconds: DEFAULT_EST_SECONDS,
  };
}

interface Props {
  session: HackSession;
  toolId: string;
  runId?: string;
  onRunLinked?: (runId: string) => void;
}

export function BruteForceTool({ session, toolId, runId, onRunLinked }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [estimatePhase, setEstimatePhase] = useState<EstimatePhase>('idle');
  const [uiPhase, setUiPhase] = useState<UiPhase>('idle');
  const [resetBanner, setResetBanner] = useState<string | null>(null);
  const [rolledEstimate, setRolledEstimate] = useState<number>(DEFAULT_EST_SECONDS);
  const [displayChars, setDisplayChars] = useState<CrackDisplayChar[] | null>(null);
  const [passwordLength, setPasswordLength] = useState(8);
  const [crackedPassword, setCrackedPassword] = useState<string | null>(null);
  const [revealedPrefix, setRevealedPrefix] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number>(DEFAULT_EST_SECONDS);
  const linkedRunIdRef = useRef(runId);
  const scrambleTickRef = useRef(0);
  const prevTargetRef = useRef<string | null>(null);
  const prevPhaseRef = useRef(session.phase);
  const resetTimerRef = useRef<number | null>(null);
  const armTimerRef = useRef<number | null>(null);
  const estimateTimerRef = useRef<number | null>(null);
  const victoryTimerRef = useRef<number | null>(null);

  linkedRunIdRef.current = runId;

  const connected = session.phase === 'connected';
  const connecting = session.phase === 'connecting';
  const targetIpv6 = session.connectedIpv6;
  const displayTarget = targetIpv6 ?? session.connectingIpv6;
  const activeRun = runId
    ? session.runningTools.find(t => t.runId === runId)
    : session.runningTools.find(t => t.toolId === toolId);
  const progress = activeRun?.progressPercent ?? 0;
  const totalDuration = activeRun?.durationSeconds ?? durationSeconds;
  const crackRemaining = status === 'running' || activeRun
    ? crackRemainingSeconds(totalDuration, progress)
    : totalDuration;
  const race = estimateCrackRace(crackRemaining, session.tracing, session.traceRemainingSeconds);

  const toolMeta = getToolRegistryEntry(toolId);
  const toolMaxLevel = toolMeta?.maxSecurityLevel ?? 1;
  const targetPasswordLevel = session.targetPasswordLevel;
  const levelBlocked = Boolean(
    connected
    && targetPasswordLevel != null
    && toolMaxLevel < targetPasswordLevel,
  );
  const levelErrorMessage = levelBlocked
    ? `INSUFFICIENT TOOL LEVEL — target password L${targetPasswordLevel}, cracker max L${toolMaxLevel}`
    : null;
  const reactiveLevelError = session.lastError?.toLowerCase().includes('insufficient tool level')
    ? session.lastError
    : null;
  const toolError = levelErrorMessage ?? reactiveLevelError;
  const canStart = connected && !levelBlocked;

  const clearLifecycleTimers = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    if (estimateTimerRef.current) {
      clearTimeout(estimateTimerRef.current);
      estimateTimerRef.current = null;
    }
    if (victoryTimerRef.current) {
      clearTimeout(victoryTimerRef.current);
      victoryTimerRef.current = null;
    }
  }, []);

  const applyInitialState = useCallback(() => {
    const next = initialCrackerFields();
    setStatus(next.status);
    setEstimatePhase(next.estimatePhase);
    setRolledEstimate(next.rolledEstimate);
    setDisplayChars(next.displayChars);
    setPasswordLength(next.passwordLength);
    setCrackedPassword(next.crackedPassword);
    setRevealedPrefix(next.revealedPrefix);
    setDurationSeconds(next.durationSeconds);
    scrambleTickRef.current = 0;
    linkedRunIdRef.current = undefined;
    onRunLinked?.('');
  }, [onRunLinked]);

  const beginTargetEstimate = useCallback((ipv6: string) => {
    setEstimatePhase('calculating');
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    estimateTimerRef.current = window.setTimeout(() => {
      setRolledEstimate(rollCrackEstimate(ipv6));
      setEstimatePhase('ready');
      estimateTimerRef.current = null;
    }, ESTIMATE_CALC_DELAY_MS);
  }, []);

  const beginReset = useCallback((banner: string) => {
    clearLifecycleTimers();
    setUiPhase('resetting');
    setResetBanner(banner);
    resetTimerRef.current = window.setTimeout(() => {
      applyInitialState();
      setUiPhase('idle');
      setResetBanner(null);
      resetTimerRef.current = null;
    }, RESET_ANIM_MS);
  }, [applyInitialState, clearLifecycleTimers]);

  const beginVictory = useCallback((pw: string, len: number) => {
    clearLifecycleTimers();
    setUiPhase('breaking');
    setResetBanner(null);
    scrambleTickRef.current += 1;
    setDisplayChars(buildCrackDisplay(94, len, pw.slice(0, Math.max(1, pw.length - 1)), null, scrambleTickRef.current));

    victoryTimerRef.current = window.setTimeout(() => {
      setCrackedPassword(pw);
      setRevealedPrefix(pw);
      setDisplayChars(buildCrackDisplay(100, len, pw, pw));
      setStatus('cracked');
      setUiPhase('victory');

      victoryTimerRef.current = window.setTimeout(() => {
        setUiPhase('idle');
        victoryTimerRef.current = null;
      }, VICTORY_ANIM_MS);
    }, BREAK_ANIM_MS);
  }, [clearLifecycleTimers]);

  useEffect(() => {
    const prevTarget = prevTargetRef.current;
    const prevPhase = prevPhaseRef.current;
    const nextTarget = targetIpv6;
    const nextPhase = session.phase;

    if (nextPhase === 'disconnecting' && prevPhase === 'connected') {
      beginReset('SESSION TERMINATED');
    } else if (prevTarget && !nextTarget && nextPhase !== 'disconnecting') {
      beginReset('SESSION TERMINATED');
    } else if (nextTarget && nextTarget !== prevTarget && nextPhase === 'connected') {
      clearLifecycleTimers();
      applyInitialState();
      setUiPhase('arming');
      setResetBanner(null);
      beginTargetEstimate(nextTarget);
      armTimerRef.current = window.setTimeout(() => {
        setUiPhase('idle');
        armTimerRef.current = null;
      }, ARM_ANIM_MS);
    }

    prevTargetRef.current = nextTarget;
    prevPhaseRef.current = nextPhase;
  }, [
    targetIpv6,
    session.phase,
    beginReset,
    beginTargetEstimate,
    applyInitialState,
    clearLifecycleTimers,
  ]);

  useEffect(() => {
    if (session.phase === 'connecting' && session.connectingIpv6 && !targetIpv6) {
      setUiPhase('linking');
      setResetBanner(null);
      setEstimatePhase('idle');
    }
  }, [session.phase, session.connectingIpv6, targetIpv6]);

  useEffect(() => () => clearLifecycleTimers(), [clearLifecycleTimers]);

  useEffect(() => {
    return session.subscribe((event: SessionEvent) => {
      if (event.type === 'tool_started' && event.toolId === toolId) {
        linkedRunIdRef.current = event.runId;
        onRunLinked?.(event.runId);
        setStatus('running');
        setEstimatePhase('ready');
        setCrackedPassword(null);
        setRevealedPrefix('');
        scrambleTickRef.current = 0;
        if (event.passwordLength) setPasswordLength(event.passwordLength);
        if (event.durationSeconds) {
          setDurationSeconds(event.durationSeconds);
          setRolledEstimate(rollCrackEstimate(targetIpv6 ?? '', event.durationSeconds));
        }
      }
      if (event.type === 'tool_completed' && event.toolId === toolId) {
        const pw = parseCrackedPassword(event.output);
        if (pw) {
          beginVictory(pw, passwordLength);
        }
      }
      if (event.type === 'ended') {
        beginReset('SESSION TERMINATED');
      }
    });
  }, [session, toolId, onRunLinked, targetIpv6, passwordLength, beginReset, beginVictory]);

  useEffect(() => {
    if (uiPhase === 'resetting' || uiPhase === 'linking' || uiPhase === 'breaking' || uiPhase === 'victory') return;
    if (status === 'cracked') return;
    if (!activeRun && status !== 'running') return;
    if (activeRun && status === 'idle') setStatus('running');
    if (activeRun?.durationSeconds) setDurationSeconds(activeRun.durationSeconds);

    const tick = () => {
      const pct = activeRun?.progressPercent ?? 0;
      const prefix = activeRun?.revealedPrefix ?? '';
      scrambleTickRef.current += 1;
      setDisplayChars(buildCrackDisplay(pct, passwordLength, prefix, crackedPassword, scrambleTickRef.current));
      if (prefix) setRevealedPrefix(prefix);
    };

    const interval = window.setInterval(tick, crackScrambleInterval(progress));
    tick();
    return () => clearInterval(interval);
  }, [status, activeRun, progress, passwordLength, crackedPassword, uiPhase]);

  useEffect(() => {
    if (uiPhase !== 'breaking') return;
    const interval = window.setInterval(() => {
      scrambleTickRef.current += 1;
      setDisplayChars(prev => {
        if (!prev) return prev;
        return prev.map((entry, i) => ({
          ...entry,
          char: entry.phase === 'locked'
            ? entry.char
            : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'[
              (scrambleTickRef.current * 17 + i * 31) % 68
            ]!,
        }));
      });
    }, 28);
    return () => clearInterval(interval);
  }, [uiPhase]);

  const start = useCallback(() => {
    if (!canStart || status === 'running' || status === 'cracked') return;
    setEstimatePhase('recalibrating');
    session.runTool(toolId);
  }, [canStart, status, session, toolId]);

  const kill = useCallback(() => {
    const id = linkedRunIdRef.current ?? activeRun?.runId;
    if (id) session.cancelTool(id);
    setStatus('idle');
    setCrackedPassword(null);
    setRevealedPrefix('');
    setDisplayChars(null);
    scrambleTickRef.current = 0;
    if (targetIpv6) setEstimatePhase('ready');
  }, [session, activeRun?.runId, targetIpv6]);

  const statusLabel =
    uiPhase === 'breaking' ? 'BREAKING'
      : uiPhase === 'victory' || status === 'cracked' ? 'CRACKED'
        : status === 'running' ? 'RUNNING'
          : status === 'failed' ? 'FAILED'
            : 'IDLE';

  const timingTone = status === 'cracked'
    ? 'success'
    : toolError
      ? 'danger'
      : race?.unlikelyToFinish
        ? 'danger'
        : race
          ? 'safe'
          : 'neutral';

  const progressTone = timingTone === 'success' ? 'safe' : timingTone === 'neutral' ? 'neutral' : timingTone;

  const guessPanelClass = [
    'cracker-guess-panel',
    toolError ? 'danger' : '',
    timingTone === 'danger' && !toolError ? 'danger' : '',
    timingTone === 'safe' ? 'safe' : '',
    uiPhase === 'breaking' ? 'breaking' : '',
    uiPhase === 'victory' ? 'victory' : '',
  ].filter(Boolean).join(' ');

  const guessClass = [
    'cracker-guess',
    status === 'cracked' ? 'cracked' : '',
    uiPhase === 'breaking' ? 'breaking' : '',
    uiPhase === 'victory' ? 'victory' : '',
    timingTone === 'danger' ? 'danger' : '',
    timingTone === 'safe' ? 'safe' : '',
  ].filter(Boolean).join(' ');

  const estimateClass = [
    'cracker-estimate',
    estimatePhase === 'calculating' ? 'calculating' : '',
    status === 'cracked' ? 'success' : toolError ? 'danger' : timingTone,
    uiPhase === 'breaking' ? 'breaking' : '',
    uiPhase === 'victory' ? 'victory' : '',
  ].filter(Boolean).join(' ');

  const renderEstimateText = () => {
    if (resetBanner) return resetBanner;
    if (toolError) return toolError.toUpperCase();
    if (uiPhase === 'breaking') {
      return <>KEY FOUND — VERIFYING<span className="cracker-dots" /></>;
    }
    if (uiPhase === 'victory' || status === 'cracked') {
      return '▶ ACCESS GRANTED — PASSWORD RECOVERED';
    }
    if (uiPhase === 'linking') {
      return <>ACQUIRING TARGET<span className="cracker-dots" /></>;
    }
    if (status === 'running' || activeRun) {
      if (race?.unlikelyToFinish) {
        return `UNLIKELY TO FINISH IN TIME — trace ${formatDurationSeconds(race.traceRemainingSeconds)}, crack needs ${formatDurationSeconds(race.crackRemainingSeconds)}`;
      }
      if (race) {
        return `+${formatDurationSeconds(race.marginSeconds)} buffer — crack ETA ${formatDurationSeconds(race.crackRemainingSeconds)}, trace ${formatDurationSeconds(race.traceRemainingSeconds)}`;
      }
      return `CRACK ETA: ${formatDurationSeconds(crackRemaining)} remaining`;
    }
    if (estimatePhase === 'recalibrating') {
      return <>INITIALIZING ATTACK<span className="cracker-dots" /></>;
    }
    if (!connected || estimatePhase === 'idle') {
      return 'AWAITING TARGET';
    }
    if (estimatePhase === 'calculating') {
      return <>ESTIMATING KEYSPACE<span className="cracker-dots" /></>;
    }
    return `EST CRACK TIME: ${formatEstimateDisplay(rolledEstimate)}`;
  };

  const toolClass = [
    'cracker-tool',
    uiPhase === 'resetting' ? 'resetting' : '',
    uiPhase === 'arming' ? 'arming' : '',
    uiPhase === 'linking' ? 'linking' : '',
    uiPhase === 'breaking' ? 'breaking' : '',
    uiPhase === 'victory' ? 'victory' : '',
  ].filter(Boolean).join(' ');

  const statusClass = [
    'cracker-status',
    status,
    uiPhase === 'breaking' ? 'breaking' : '',
    uiPhase === 'victory' ? 'victory' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={toolClass}>
      {uiPhase === 'victory' && <div className="cracker-victory-overlay" aria-hidden />}
      {uiPhase === 'breaking' && <div className="cracker-break-overlay" aria-hidden />}
      <div className="cracker-header">
        <div>
          <div className="cracker-version">BRUTE v0.3 // SHAREWARE</div>
          <div className="cracker-target">{displayTarget ?? 'NO TARGET'}</div>
        </div>
        <span className={statusClass}>{statusLabel}</span>
      </div>

      <div className={estimateClass}>
        {renderEstimateText()}
      </div>

      <div className={guessPanelClass}>
        <div className={guessClass}>
          {displayChars ? (
            displayChars.map((entry, i) => (
              <span
                key={`${i}-${entry.phase}-${entry.char}-${uiPhase}`}
                className={[
                  entry.phase === 'scrambling' ? 'crack-char-scrambling' : '',
                  entry.phase === 'locked' ? 'crack-char-locked' : '',
                  entry.phase === 'chaotic' ? 'crack-char-chaotic' : '',
                  uiPhase === 'victory' ? 'crack-char-victory' : '',
                  uiPhase === 'breaking' ? 'crack-char-breaking' : '',
                ].filter(Boolean).join(' ')}
                style={{ ['--scramble-i' as string]: i }}
              >
                {entry.char}
              </span>
            ))
          ) : (
            <span className="cracker-guess-empty">—</span>
          )}
        </div>
      </div>

      {(status === 'running' || activeRun) && uiPhase !== 'resetting' && uiPhase !== 'breaking' && uiPhase !== 'victory' && (
        <CrackProgressBar
          percent={progress}
          tone={progressTone}
          seed={targetIpv6 ?? ''}
        />
      )}

      <div className="cracker-actions">
        {status !== 'running' && status !== 'cracked' && (
          <button
            className="cracker-btn"
            onClick={start}
            disabled={!canStart}
            title={levelBlocked ? levelErrorMessage ?? undefined : undefined}
          >
            [ START ]
          </button>
        )}
        {(status === 'running' || activeRun) && uiPhase !== 'resetting' && uiPhase !== 'breaking' && uiPhase !== 'victory' && (
          <button className="cracker-btn abort" onClick={kill}>
            [ ABORT ]
          </button>
        )}
      </div>

      {levelBlocked && status === 'idle' && (
        <div className="cracker-footnote cracker-footnote-error">
          UPGRADE CRACKER TO L{targetPasswordLevel} OR FIND A WEAKER TARGET
        </div>
      )}

      {!connected && status === 'idle' && !levelBlocked && (
        <div className="cracker-footnote">CONNECT VIA SERVER LIST</div>
      )}
    </div>
  );
}
