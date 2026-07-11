import { randomUUID } from 'node:crypto';
import type { Tool } from '../types/tool.js';
import { loadTraceBalance, type TraceBalance } from './balanceLoader.js';
import { executeShellCommand, shellPrompt } from './shell.js';
import type {
  ConnectInput,
  HackSessionState,
  SessionEvent,
  SessionServerMessage,
} from './sessionTypes.js';
import {
  advanceRunningTools,
  applyToolEffect,
  canAffordTool,
  computeResourceUsage,
  computeToolDurationMs,
  findTool,
  firewallPenaltyMultiplier,
  getEffectiveFirewallLevel,
  targetComponentLevel,
  toolOwned,
  toolProgressPercent,
  updateAccessLifecycle,
  validateToolLevel,
} from './tools.js';
import {
  accelerateTrace,
  computeInitialTraceMs,
  extendTraceDeadline,
  isTraceExpired,
  traceProgressSeconds,
  traceRemainingSeconds,
} from './trace.js';
import { rollTraceProbe } from './traceProbe.js';
import { advanceIceDisruption } from './ice.js';
import { computeCrackerRevealedPrefix } from './crackerReveal.js';

let traceBalanceCache: TraceBalance | null = null;

export function getTraceBalance(): TraceBalance {
  if (!traceBalanceCache) {
    traceBalanceCache = loadTraceBalance();
  }
  return traceBalanceCache;
}

export function resetTraceBalanceCache(): void {
  traceBalanceCache = null;
}

function logCommand(session: HackSessionState, kind: string, detail: string): void {
  session.commandLog.push({ at: new Date().toISOString(), kind, detail });
  if (session.commandLog.length > 200) {
    session.commandLog.shift();
  }
}

function taskManagerMessage(session: HackSessionState): SessionServerMessage {
  const { cpuUsed, ramUsed } = computeResourceUsage(session);
  return {
    type: 'task_manager',
    cpuUsed,
    cpuTotal: session.rigCpu,
    ramUsed,
    ramTotal: session.rigRam,
    runningTools: session.runningTools
      .filter((r) => !r.completed && !r.cancelled)
      .map((r) => {
        const entry: { runId: string; toolId: string; progressPercent: number; revealedPrefix?: string } = {
          runId: r.runId,
          toolId: r.toolId,
          progressPercent: toolProgressPercent(r),
        };
        if (r.category === 'cracker') {
          entry.revealedPrefix = computeCrackerRevealedPrefix(
            session.target.rootPassword,
            entry.progressPercent,
          );
        }
        return entry;
      }),
  };
}

function traceUpdateMessage(session: HackSessionState, nowMs: number): SessionServerMessage {
  const expiresAt =
    session.traceExpiresAtMs !== null ? new Date(session.traceExpiresAtMs).toISOString() : null;
  const progressSeconds =
    session.tracing && session.traceStartedAtMs !== null && session.traceExpiresAtMs !== null
      ? traceProgressSeconds(session.traceStartedAtMs, nowMs, session.traceExpiresAtMs)
      : 0;
  const remainingSeconds =
    session.traceExpiresAtMs !== null ? traceRemainingSeconds(session.traceExpiresAtMs, nowMs) : 0;
  return {
    type: 'trace_update',
    tracing: session.tracing,
    progressSeconds,
    expiresAt,
    remainingSeconds,
  };
}

function triggerAlarm(session: HackSessionState, nowMs: number, balance: TraceBalance): void {
  if (!session.target.alarmActive || session.alarmDisabled) return;
  session.tracing = true;
  session.lifecycle = 'tracing';
  session.traceStartedAtMs = nowMs;
  const durationMs = computeInitialTraceMs(
    session.target.faction,
    session.subnetHeatLevel,
    balance,
  );
  session.traceExpiresAtMs = nowMs + durationMs;
  logCommand(session, 'alarm', 'trace_started');
}

function cancelAllRunningTools(session: HackSessionState): SessionServerMessage[] {
  const messages: SessionServerMessage[] = [];
  for (const run of session.runningTools) {
    if (run.completed || run.cancelled) continue;
    run.cancelled = true;
    messages.push({ type: 'tool_cancelled', runId: run.runId, toolId: run.toolId });
  }
  return messages;
}

export interface ConnectResult extends SessionEvent {
  state: HackSessionState;
}

export function connectSession(input: ConnectInput, balance = getTraceBalance()): ConnectResult {
  const session: HackSessionState = {
    id: input.sessionId,
    accountId: input.accountId,
    target: input.target,
    lifecycle: 'connected',
    shellAccessLevel: 'guest',
    tracing: false,
    traceExpiresAtMs: null,
    traceStartedAtMs: null,
    blockerExtensionsMs: 0,
    passwordCracked: false,
    alarmDisabled: !input.target.alarmActive,
    runningTools: [],
    installedToolIds: [...input.rig.installedToolIds],
    rigCpu: input.rig.cpu,
    rigRam: input.rig.ram,
    rigCpuUsed: 0,
    rigRamUsed: 0,
    subnetHeatLevel: input.subnetHeatLevel,
    lastActivityAtMs: input.nowMs,
    commandTimestampsMs: [],
    commandLog: [],
    lootCollected: [],
    createdAtMs: input.nowMs,
    lastTickMs: input.nowMs,
  };

  const messages: SessionServerMessage[] = [];

  messages.push({
    type: 'session_started',
    sessionId: session.id,
    prompt: shellPrompt(session),
    accessLevel: session.shellAccessLevel,
    tracing: session.tracing,
    traceExpiresAt: session.traceExpiresAtMs
      ? new Date(session.traceExpiresAtMs).toISOString()
      : undefined,
    targetPasswordLevel: session.target.securityComponents.password,
    targetFirewallLevel: session.target.securityComponents.firewall,
    targetIceLevel: session.target.securityComponents.ice ?? 0,
  });
  messages.push(traceUpdateMessage(session, input.nowMs));
  messages.push(taskManagerMessage(session));

  return { messages, state: session };
}

export function tickSession(
  session: HackSessionState,
  nowMs: number,
  tools: Tool[],
  balance = getTraceBalance(),
  rng: () => number = Math.random,
): SessionEvent {
  const messages: SessionServerMessage[] = [];
  const deltaMs = Math.max(0, nowMs - session.lastTickMs);
  session.lastTickMs = nowMs;

  const activeBlockers = session.runningTools.filter(
    (r) => r.category === 'trace_blocker' && !r.completed && !r.cancelled,
  );
  if (activeBlockers.length > 0 && session.tracing && session.traceExpiresAtMs !== null) {
    session.traceExpiresAtMs += deltaMs;
    session.blockerExtensionsMs += deltaMs;
  }

  advanceRunningTools(session, deltaMs, session.rigCpu);

  messages.push(...advanceIceDisruption(session, tools, deltaMs, nowMs, rng));

  if (rollTraceProbe(session, balance, rng)) {
    triggerAlarm(session, nowMs, balance);
    messages.push(traceUpdateMessage(session, nowMs));
  }

  for (const run of session.runningTools) {
    if (run.cancelled) continue;
    if (!run.completed && !run.warmedUp) {
      const progressPercent = toolProgressPercent(run);
      const tool = findTool(tools, run.toolId);
      const progressMsg: SessionServerMessage = {
        type: 'tool_progress',
        runId: run.runId,
        toolId: run.toolId,
        progressPercent,
      };
      if (tool?.category === 'cracker') {
        progressMsg.revealedPrefix = computeCrackerRevealedPrefix(
          session.target.rootPassword,
          progressPercent,
        );
      }
      messages.push(progressMsg);
      continue;
    }
    if (run.effectApplied) continue;

    run.effectApplied = true;
    const tool = findTool(tools, run.toolId);
    if (!tool) continue;

    const effect = applyToolEffect(session, tool);
    if (tool.category === 'trace_blocker' && session.tracing && session.traceExpiresAtMs !== null) {
      session.blockerExtensionsMs += balance.blockerExtensionSeconds * 1000;
      session.traceExpiresAtMs = extendTraceDeadline(
        session.traceExpiresAtMs,
        balance.blockerExtensionSeconds * 1000,
        nowMs,
      );
    }

    updateAccessLifecycle(session);
    messages.push({
      type: 'tool_completed',
      runId: run.runId,
      toolId: run.toolId,
      output: effect.output,
    });
    logCommand(session, 'tool_complete', run.toolId);
  }

  session.rigCpuUsed = computeResourceUsage(session).cpuUsed;
  session.rigRamUsed = computeResourceUsage(session).ramUsed;
  messages.push(taskManagerMessage(session));

  if (session.tracing && isTraceExpired(session.traceExpiresAtMs, nowMs)) {
    messages.push(...cancelAllRunningTools(session));
    session.rigCpuUsed = 0;
    session.rigRamUsed = 0;
    messages.push(taskManagerMessage(session));
    session.lifecycle = 'caught';
    logCommand(session, 'caught', 'trace_expired');
    return { messages, ended: true, caught: true };
  }

  if (isIdleExpired(session, nowMs, balance)) {
    session.lifecycle = 'disconnected';
    messages.push({
      type: 'session_ended',
      reason: 'idle_timeout',
      message: 'Session closed due to inactivity.',
    });
    logCommand(session, 'disconnect', 'idle_timeout');
    return { messages, ended: true };
  }

  if (session.tracing) {
    messages.push(traceUpdateMessage(session, nowMs));
  }

  return { messages };
}

function isIdleExpired(session: HackSessionState, nowMs: number, balance: TraceBalance): boolean {
  const idleMs = balance.idleTimeoutMinutes * 60 * 1000;
  return nowMs - session.lastActivityAtMs > idleMs;
}

function checkRateLimit(session: HackSessionState, nowMs: number, balance: TraceBalance): string | null {
  const windowMs = 1000;
  session.commandTimestampsMs = session.commandTimestampsMs.filter((t) => nowMs - t < windowMs);
  if (session.commandTimestampsMs.length >= balance.commandRateLimitPerSecond) {
    return 'Rate limit exceeded';
  }
  session.commandTimestampsMs.push(nowMs);
  return null;
}

function touch(session: HackSessionState, nowMs: number): void {
  session.lastActivityAtMs = nowMs;
}

export function handleShellCommand(
  session: HackSessionState,
  command: string,
  nowMs: number,
  balance = getTraceBalance(),
): SessionEvent {
  if (session.lifecycle === 'caught' || session.lifecycle === 'disconnected' || session.lifecycle === 'claimed') {
    return { messages: [{ type: 'error', code: 'session_closed', message: 'Session is not active.' }] };
  }

  const rateErr = checkRateLimit(session, nowMs, balance);
  if (rateErr) {
    return { messages: [{ type: 'error', code: 'rate_limit', message: rateErr }] };
  }
  touch(session, nowMs);

  const result = executeShellCommand(session, command);
  const messages: SessionServerMessage[] = [{ type: 'shell_output', output: result.output }];

  if (result.failedExploit && session.tracing && session.traceExpiresAtMs !== null) {
    session.traceExpiresAtMs = accelerateTrace(
      session.traceExpiresAtMs,
      balance.failedExploitBumpSeconds * 1000,
      nowMs,
    );
    messages.push(traceUpdateMessage(session, nowMs));
  }

  if (result.alarmDisabled) {
    session.tracing = false;
    updateAccessLifecycle(session);
    messages.push(traceUpdateMessage(session, nowMs));
  } else {
    updateAccessLifecycle(session);
  }

  logCommand(session, 'shell', command);
  return { messages };
}

export function handleRunTool(
  session: HackSessionState,
  toolId: string,
  tools: Tool[],
  nowMs: number,
  balance = getTraceBalance(),
): SessionEvent {
  if (session.lifecycle === 'caught' || session.lifecycle === 'disconnected' || session.lifecycle === 'claimed') {
    return { messages: [{ type: 'error', code: 'session_closed', message: 'Session is not active.' }] };
  }

  const rateErr = checkRateLimit(session, nowMs, balance);
  if (rateErr) {
    return { messages: [{ type: 'error', code: 'rate_limit', message: rateErr }] };
  }
  touch(session, nowMs);

  if (!toolOwned(session, toolId)) {
    return {
      messages: [{ type: 'error', code: 'tool_not_owned', message: 'Tool is not installed on your rig.' }],
    };
  }

  const tool = findTool(tools, toolId);
  if (!tool) {
    return { messages: [{ type: 'error', code: 'unknown_tool', message: 'Unknown tool.' }] };
  }

  if (tool.targetType === 'subnet') {
    return {
      messages: [{ type: 'error', code: 'wrong_context', message: 'Scanner runs outside hack sessions (Stage 4).' }],
    };
  }

  if (tool.category === 'trace_blocker') {
    if (!session.tracing) {
      return { messages: [{ type: 'error', code: 'no_trace', message: 'No active trace to block.' }] };
    }
  } else {
    const targetLevel = targetComponentLevel(session, tool);
    const levelErr = validateToolLevel(tool, targetLevel);
    if (levelErr) {
      return { messages: [{ type: 'error', code: 'insufficient_tool_level', message: levelErr }] };
    }
  }

  const resourceErr = canAffordTool(session, tool);
  if (resourceErr) {
    return { messages: [{ type: 'error', code: 'insufficient_resources', message: resourceErr }] };
  }

  if (tool.category === 'cracker' && session.passwordCracked) {
    return { messages: [{ type: 'error', code: 'already_done', message: 'Password already cracked.' }] };
  }
  if (tool.category === 'anti_firewall') {
    const alreadyRunning = session.runningTools.some(
      (r) => r.toolId === tool.id && !r.completed && !r.cancelled,
    );
    if (alreadyRunning) {
      return {
        messages: [{ type: 'error', code: 'already_running', message: 'Firewall dampener already running.' }],
      };
    }
  }
  if (tool.category === 'log_cleaner' && session.shellAccessLevel === 'guest' && !session.passwordCracked) {
    return {
      messages: [{ type: 'error', code: 'access_denied', message: 'Need shell access before cleaning logs.' }],
    };
  }

  const targetLevel = tool.category === 'trace_blocker' ? 1 : targetComponentLevel(session, tool);
  let durationMs = computeToolDurationMs(tool, targetLevel);
  if (tool.category === 'cracker') {
    durationMs = Math.max(durationMs, session.target.rootPassword.length * 350);
  }
  if (tool.category !== 'anti_firewall') {
    durationMs = Math.round(durationMs * firewallPenaltyMultiplier(getEffectiveFirewallLevel(session)));
  }
  const run = {
    runId: randomUUID(),
    toolId: tool.id,
    category: tool.category,
    startedAtMs: nowMs,
    durationMs,
    progressMs: 0,
    ramCost: tool.ramCost,
    cpuCost: tool.cpuCost,
    completed: false,
    cancelled: false,
    effectApplied: false,
    warmedUp: false,
  };
  session.runningTools.push(run);

  logCommand(session, 'run_tool', toolId);
  const toolStarted: SessionServerMessage = {
    type: 'tool_started',
    runId: run.runId,
    toolId: tool.id,
    durationSeconds: Math.ceil(durationMs / 1000),
  };
  if (tool.category === 'cracker') {
    toolStarted.passwordLength = session.target.rootPassword.length;
  }
  const messages: SessionServerMessage[] = [
    toolStarted,
    taskManagerMessage(session),
  ];
  if (session.tracing) {
    messages.push(traceUpdateMessage(session, nowMs));
  }
  return { messages };
}

export function handleCancelTool(
  session: HackSessionState,
  runId: string,
  nowMs: number,
  balance = getTraceBalance(),
): SessionEvent {
  touch(session, nowMs);
  const run = session.runningTools.find((r) => r.runId === runId && !r.completed && !r.cancelled);
  if (!run) {
    return { messages: [{ type: 'error', code: 'not_running', message: 'Tool run not found.' }] };
  }
  run.cancelled = true;
  logCommand(session, 'cancel_tool', runId);
  return {
    messages: [
      { type: 'tool_cancelled', runId, toolId: run.toolId },
      taskManagerMessage(session),
    ],
  };
}

export function handleClaim(session: HackSessionState, nowMs: number): SessionEvent {
  touch(session, nowMs);
  if (session.shellAccessLevel !== 'root') {
    return {
      messages: [
        {
          type: 'claim_result',
          success: false,
          message: 'Root access required to claim machine.',
        },
      ],
    };
  }
  if (!session.alarmDisabled) {
    return {
      messages: [
        {
          type: 'claim_result',
          success: false,
          message: 'Disable the alarm daemon before claiming.',
        },
      ],
    };
  }
  session.lifecycle = 'claimed';
  logCommand(session, 'claim', session.target.ipv6);
  return {
    messages: [
      {
        type: 'claim_result',
        success: true,
        ipv6: session.target.ipv6,
        message: `Claimed ${session.target.ipv6}`,
      },
      { type: 'session_ended', reason: 'claimed', message: 'Machine claimed successfully.' },
    ],
    ended: true,
  };
}

export function handleDisconnect(session: HackSessionState, nowMs: number, reason = 'disconnect'): SessionEvent {
  touch(session, nowMs);
  if (session.lifecycle === 'claimed' || session.lifecycle === 'caught') {
    return { messages: [] };
  }
  session.lifecycle = 'disconnected';
  logCommand(session, 'disconnect', reason);
  return {
    messages: [{ type: 'session_ended', reason, message: 'Disconnected from target.' }],
    ended: true,
  };
}

export function handleAbort(session: HackSessionState, nowMs: number): SessionEvent {
  return handleDisconnect(session, nowMs, 'abort');
}

export function advanceSessionTime(
  session: HackSessionState,
  deltaMs: number,
  tools: Tool[],
  balance = getTraceBalance(),
): SessionEvent {
  const nowMs = session.lastTickMs + deltaMs;
  return tickSession(session, nowMs, tools, balance);
}

export type { HackSessionState };
