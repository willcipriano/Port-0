import { useState, useEffect, useRef, useCallback } from 'react';

export type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'disconnecting';
export type TraceLevel = 'safe' | 'warning' | 'critical' | 'caught';

export type SessionEvent =
  | { type: 'started'; ipv6: string; prompt: string }
  | { type: 'ended'; reason?: string; message?: string }
  | { type: 'shell_output'; output: string }
  | { type: 'tool_started'; runId: string; toolId: string; passwordLength?: number; durationSeconds?: number }
  | { type: 'tool_completed'; toolId: string; output: string }
  | { type: 'tool_disrupted'; runId: string; toolId: string; reason: 'ice'; disruptionKind: 'disconnect' | 'bad_character' | 'stall'; message: string; injectedCharacter?: string; addedDelayMs?: number }
  | { type: 'password_saved'; targetIpv6: string }
  | { type: 'error'; message: string };

export interface RunningToolView {
  runId: string;
  toolId: string;
  progressPercent: number;
  durationSeconds?: number;
  revealedPrefix?: string;
}

export interface HackSession {
  wsReady: boolean;
  phase: ConnectionPhase;
  connectedIpv6: string | null;
  connectingIpv6: string | null;
  shellPrompt: string;
  tracing: boolean;
  tracePercent: number;
  traceRemainingSeconds: number;
  traceLevel: TraceLevel;
  lastError: string | null;
  targetPasswordLevel: number | null;
  targetFirewallLevel: number | null;
  targetIceLevel: number | null;
  runningTools: RunningToolView[];
  cpuUsed: number;
  ramUsed: number;
  connect: (ipv6: string) => void;
  disconnect: () => void;
  sendShellCommand: (command: string) => void;
  runTool: (toolId: string) => void;
  cancelTool: (runId: string) => void;
  getRunForTool: (toolId: string) => string | null;
  subscribe: (listener: (event: SessionEvent) => void) => () => void;
  clearError: () => void;
}

type ServerMessage = {
  type?: string;
  tracing?: boolean;
  progressSeconds?: number;
  remainingSeconds?: number;
  expiresAt?: string | null;
  prompt?: string;
  output?: string;
  code?: string;
  message?: string;
  reason?: string;
  runId?: string;
  toolId?: string;
  progressPercent?: number;
  passwordLength?: number;
  cpuUsed?: number;
  ramUsed?: number;
  cpuTotal?: number;
  ramTotal?: number;
  runningTools?: Array<{ runId: string; toolId: string; progressPercent: number; revealedPrefix?: string }>;
  durationSeconds?: number;
  revealedPrefix?: string;
  targetPasswordLevel?: number;
  targetFirewallLevel?: number;
  targetIceLevel?: number;
  targetIpv6?: string;
  disruptionKind?: 'disconnect' | 'bad_character' | 'stall';
  injectedCharacter?: string;
  addedDelayMs?: number;
};

function traceLevelFromPercent(percent: number): TraceLevel {
  if (percent >= 100) return 'caught';
  if (percent >= 75) return 'critical';
  if (percent >= 50) return 'warning';
  return 'safe';
}

function computeTracePercent(progressSeconds: number, remainingSeconds: number): number {
  const total = progressSeconds + remainingSeconds;
  if (total <= 0) return 0;
  return Math.min(100, (progressSeconds / total) * 100);
}

const INITIAL_TRACE = {
  tracing: false,
  tracePercent: 0,
  traceRemainingSeconds: 0,
  traceLevel: 'safe' as TraceLevel,
};

export function useHackSession(accountId: string): HackSession {
  const [wsReady, setWsReady] = useState(false);
  const [phase, setPhase] = useState<ConnectionPhase>('idle');
  const [connectedIpv6, setConnectedIpv6] = useState<string | null>(null);
  const [connectingIpv6, setConnectingIpv6] = useState<string | null>(null);
  const [shellPrompt, setShellPrompt] = useState('port0:~$');
  const [tracing, setTracing] = useState(false);
  const [tracePercent, setTracePercent] = useState(0);
  const [traceRemainingSeconds, setTraceRemainingSeconds] = useState(0);
  const [traceLevel, setTraceLevel] = useState<TraceLevel>('safe');
  const [lastError, setLastError] = useState<string | null>(null);
  const [targetPasswordLevel, setTargetPasswordLevel] = useState<number | null>(null);
  const [targetFirewallLevel, setTargetFirewallLevel] = useState<number | null>(null);
  const [targetIceLevel, setTargetIceLevel] = useState<number | null>(null);
  const [runningTools, setRunningTools] = useState<RunningToolView[]>([]);
  const [cpuUsed, setCpuUsed] = useState(0);
  const [ramUsed, setRamUsed] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingIpv6Ref = useRef<string | null>(null);
  const listenersRef = useRef(new Set<(event: SessionEvent) => void>());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const disposedRef = useRef(false);
  const phaseRef = useRef(phase);
  const connectedIpv6Ref = useRef(connectedIpv6);
  const toolDurationsRef = useRef<Map<string, number>>(new Map());

  phaseRef.current = phase;
  connectedIpv6Ref.current = connectedIpv6;

  const emit = useCallback((event: SessionEvent) => {
    listenersRef.current.forEach(fn => fn(event));
  }, []);

  const subscribe = useCallback((listener: (event: SessionEvent) => void) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const resetSession = useCallback(() => {
    setPhase('idle');
    setConnectedIpv6(null);
    setConnectingIpv6(null);
    setShellPrompt('port0:~$');
    setTracing(INITIAL_TRACE.tracing);
    setTracePercent(INITIAL_TRACE.tracePercent);
    setTraceRemainingSeconds(INITIAL_TRACE.traceRemainingSeconds);
    setTraceLevel(INITIAL_TRACE.traceLevel);
    setTargetPasswordLevel(null);
    setTargetFirewallLevel(null);
    setTargetIceLevel(null);
    setRunningTools([]);
    setCpuUsed(0);
    setRamUsed(0);
    toolDurationsRef.current.clear();
    pendingIpv6Ref.current = null;
  }, []);

  const applyTraceUpdate = useCallback((msg: ServerMessage) => {
    const isTracing = Boolean(msg.tracing);
    const progress = msg.progressSeconds ?? 0;
    const remaining = msg.remainingSeconds ?? 0;
    const percent = isTracing ? computeTracePercent(progress, remaining) : 0;
    setTracing(isTracing);
    setTracePercent(percent);
    setTraceRemainingSeconds(remaining);
    setTraceLevel(isTracing ? traceLevelFromPercent(percent) : 'safe');
  }, []);

  const sendWs = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const trySendConnect = useCallback(() => {
    const ipv6 = pendingIpv6Ref.current;
    if (!ipv6 || wsRef.current?.readyState !== WebSocket.OPEN) return;
    sendWs({ type: 'connect', ipv6 });
  }, [sendWs]);

  const handleMessage = useCallback((raw: string) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'session_ready':
        setWsReady(true);
        if (pendingIpv6Ref.current && phaseRef.current === 'connecting') {
          trySendConnect();
        }
        break;

      case 'session_started': {
        const ipv6 = pendingIpv6Ref.current ?? connectedIpv6Ref.current ?? '';
        setPhase('connected');
        setConnectedIpv6(ipv6);
        setConnectingIpv6(null);
        if (msg.targetPasswordLevel !== undefined) {
          setTargetPasswordLevel(msg.targetPasswordLevel);
        }
        if (msg.targetFirewallLevel !== undefined) {
          setTargetFirewallLevel(msg.targetFirewallLevel);
        }
        if (msg.targetIceLevel !== undefined) {
          setTargetIceLevel(msg.targetIceLevel);
        }
        if (msg.prompt) setShellPrompt(msg.prompt);
        if (msg.tracing !== undefined) {
          applyTraceUpdate({
            tracing: msg.tracing,
            progressSeconds: 0,
            remainingSeconds: msg.expiresAt
              ? Math.max(0, (new Date(msg.expiresAt).getTime() - Date.now()) / 1000)
              : 0,
          });
        }
        emit({ type: 'started', ipv6, prompt: msg.prompt ?? '' });
        break;
      }

      case 'trace_update':
        applyTraceUpdate(msg);
        break;

      case 'tool_started':
        if (msg.runId && msg.toolId) {
          if (msg.durationSeconds !== undefined) {
            toolDurationsRef.current.set(msg.runId, msg.durationSeconds);
          }
          setRunningTools(prev => {
            const without = prev.filter(t => t.runId !== msg.runId);
            return [
              ...without,
              {
                runId: msg.runId!,
                toolId: msg.toolId!,
                progressPercent: 0,
                durationSeconds: msg.durationSeconds,
                revealedPrefix: '',
              },
            ];
          });
          emit({
            type: 'tool_started',
            runId: msg.runId,
            toolId: msg.toolId,
            passwordLength: msg.passwordLength,
            durationSeconds: msg.durationSeconds,
          });
        }
        break;

      case 'tool_progress':
        if (msg.runId && msg.progressPercent !== undefined) {
          setRunningTools(prev => prev.map(tool =>
            tool.runId === msg.runId
              ? {
                ...tool,
                progressPercent: msg.progressPercent!,
                durationSeconds: tool.durationSeconds ?? toolDurationsRef.current.get(msg.runId!),
                revealedPrefix: msg.revealedPrefix !== undefined
                  ? msg.revealedPrefix
                  : tool.revealedPrefix,
              }
              : tool,
          ));
        }
        break;

      case 'tool_completed':
        if (msg.toolId && typeof msg.output === 'string') {
          emit({ type: 'tool_completed', toolId: msg.toolId, output: msg.output });
        }
        break;

      case 'password_saved':
        if (msg.targetIpv6) {
          emit({ type: 'password_saved', targetIpv6: msg.targetIpv6 });
        }
        break;

      case 'tool_cancelled':
        if (msg.runId) {
          setRunningTools(prev => prev.filter(tool => tool.runId !== msg.runId));
        }
        break;

      case 'tool_disrupted':
        if (msg.runId && msg.toolId && msg.reason === 'ice' && msg.disruptionKind) {
          if (msg.disruptionKind === 'disconnect') {
            setRunningTools(prev => prev.filter(tool => tool.runId !== msg.runId));
          } else if (msg.addedDelayMs !== undefined) {
            const addedSeconds = Math.ceil(msg.addedDelayMs / 1000);
            setRunningTools(prev => prev.map(tool => {
              if (tool.runId !== msg.runId) return tool;
              const nextDuration = (tool.durationSeconds ?? 0) + addedSeconds;
              toolDurationsRef.current.set(msg.runId!, nextDuration);
              return { ...tool, durationSeconds: nextDuration };
            }));
          }
          emit({
            type: 'tool_disrupted',
            runId: msg.runId,
            toolId: msg.toolId,
            reason: 'ice',
            disruptionKind: msg.disruptionKind,
            message: msg.message ?? 'Tool disrupted by ICE.',
            injectedCharacter: msg.injectedCharacter,
            addedDelayMs: msg.addedDelayMs,
          });
        }
        break;

      case 'task_manager':
        if (msg.runningTools) {
          setRunningTools(prev => {
            const prevById = new Map(prev.map(t => [t.runId, t]));
            return msg.runningTools!.map(tool => {
              const existing = prevById.get(tool.runId);
              return {
                ...tool,
                durationSeconds:
                  toolDurationsRef.current.get(tool.runId) ?? existing?.durationSeconds,
                revealedPrefix: tool.revealedPrefix ?? existing?.revealedPrefix ?? '',
              };
            });
          });
        }
        if (msg.cpuUsed !== undefined) setCpuUsed(msg.cpuUsed);
        if (msg.ramUsed !== undefined) setRamUsed(msg.ramUsed);
        break;

      case 'shell_output':
        if (typeof msg.output === 'string') {
          emit({ type: 'shell_output', output: msg.output });
        }
        break;

      case 'session_ended':
        emit({ type: 'ended', reason: msg.reason, message: msg.message });
        resetSession();
        break;

      case 'caught':
        setTraceLevel('caught');
        setTracePercent(100);
        setTracing(true);
        emit({ type: 'error', message: msg.message ?? 'Trace complete — you were caught.' });
        setTimeout(resetSession, 2000);
        break;

      case 'error':
        if (msg.code === 'session_active') {
          setLastError(msg.message ?? 'Disconnect current session first.');
          if (phaseRef.current === 'connecting') {
            setPhase(connectedIpv6Ref.current ? 'connected' : 'idle');
            setConnectingIpv6(null);
            pendingIpv6Ref.current = null;
          }
        } else if (phaseRef.current === 'connecting') {
          setLastError(msg.message ?? 'Connection failed.');
          setPhase('idle');
          setConnectingIpv6(null);
          pendingIpv6Ref.current = null;
          emit({ type: 'error', message: msg.message ?? 'Connection failed.' });
        } else {
          setLastError(msg.message ?? 'Session error.');
          emit({ type: 'error', message: msg.message ?? 'Session error.' });
        }
        break;

      default:
        break;
    }
  }, [applyTraceUpdate, emit, resetSession, trySendConnect]);

  const connectSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = `dev:${accountId}`;
    const url = `${protocol}//${window.location.host}/session?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      handleMessage(typeof event.data === 'string' ? event.data : String(event.data));
    };

    ws.onclose = () => {
      setWsReady(false);
      wsRef.current = null;
      if (disposedRef.current) return;
      if (phaseRef.current === 'connected' || phaseRef.current === 'connecting') {
        resetSession();
        emit({ type: 'ended', reason: 'socket_closed', message: 'Connection lost.' });
      }
      const delay = Math.min(30_000, 1000 * 2 ** reconnectAttemptRef.current);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(connectSocket, delay);
    };

    ws.onerror = () => {
      // onclose handles recovery
    };
  }, [accountId, handleMessage, emit, resetSession]);

  useEffect(() => {
    disposedRef.current = false;
    connectSocket();
    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null;
        ws.close();
        wsRef.current = null;
      }
    };
  }, [connectSocket]);

  const connect = useCallback((ipv6: string) => {
    setLastError(null);
    const normalized = ipv6.toLowerCase();

    if (phaseRef.current === 'connected') {
      if (connectedIpv6Ref.current === normalized) return;
      setLastError('Disconnect current session first.');
      return;
    }

    if (phaseRef.current === 'connecting' || phaseRef.current === 'disconnecting') return;

    pendingIpv6Ref.current = normalized;
    setConnectingIpv6(normalized);
    setPhase('connecting');
    emit({ type: 'shell_output', output: `Establishing connection to [${normalized}]...` });

    if (wsReady) {
      trySendConnect();
    }
  }, [wsReady, trySendConnect, emit]);

  const disconnect = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'disconnecting') return;
    setPhase('disconnecting');
    sendWs({ type: 'disconnect' });
  }, [sendWs]);

  const sendShellCommand = useCallback((command: string) => {
    if (phaseRef.current !== 'connected') return;
    sendWs({ type: 'shell_command', command });
  }, [sendWs]);

  const runTool = useCallback((toolId: string) => {
    if (phaseRef.current !== 'connected') return;
    sendWs({ type: 'run_tool', toolId });
  }, [sendWs]);

  const cancelTool = useCallback((runId: string) => {
    if (phaseRef.current !== 'connected') return;
    sendWs({ type: 'cancel_tool', runId });
  }, [sendWs]);

  const clearError = useCallback(() => setLastError(null), []);

  const getRunForTool = useCallback((toolId: string) => {
    return runningTools.find(tool => tool.toolId === toolId)?.runId ?? null;
  }, [runningTools]);

  return {
    wsReady,
    phase,
    connectedIpv6,
    connectingIpv6,
    shellPrompt,
    tracing,
    tracePercent,
    traceRemainingSeconds,
    traceLevel,
    lastError,
    targetPasswordLevel,
    targetFirewallLevel,
    targetIceLevel,
    runningTools,
    cpuUsed,
    ramUsed,
    connect,
    disconnect,
    sendShellCommand,
    runTool,
    cancelTool,
    getRunForTool,
    subscribe,
    clearError,
  };
}
