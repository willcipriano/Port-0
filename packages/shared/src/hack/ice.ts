import type { Tool } from '../types/tool.js';
import { findTool } from './tools.js';
import type { HackSessionState, SessionServerMessage } from './sessionTypes.js';

export const ICE_DISRUPTION_COOLDOWN_MS = 5_000;

export const ICE_BAD_CHARACTERS = ['�', '#', '%', '@', '!', '?', '0', '1', 'X'];

export function iceDisruptionChancePerSecond(iceLevel: number): number {
  switch (iceLevel) {
    case 0:
      return 0;
    case 1:
      return 0.006;
    case 2:
      return 0.012;
    case 3:
      return 0.022;
    case 4:
      return 0.035;
    case 5:
      return 0.055;
    default:
      return 0;
  }
}

export function shouldIceDisrupt(
  iceLevel: number,
  deltaSeconds: number,
  rng: () => number = Math.random,
): boolean {
  const perSecond = iceDisruptionChancePerSecond(iceLevel);
  if (perSecond <= 0) return false;

  const chance = 1 - Math.pow(1 - perSecond, deltaSeconds);
  return rng() < chance;
}

export function getTargetIceLevel(session: HackSessionState): number {
  return session.target.securityComponents.ice ?? 0;
}

export interface IceDisruptionEvent {
  runId: string;
  toolId: string;
  reason: 'ice';
  disruptionKind: 'disconnect' | 'bad_character' | 'stall';
  message: string;
  injectedCharacter?: string;
  addedDelayMs?: number;
}

function disruptAntiFirewallTool(
  _session: HackSessionState,
  run: HackSessionState['runningTools'][number],
): IceDisruptionEvent {
  run.cancelled = true;
  run.disruptedBy = 'ice';
  return {
    runId: run.runId,
    toolId: run.toolId,
    reason: 'ice',
    disruptionKind: 'disconnect',
    message: 'Firewall Dampener disconnected by ICE.',
  };
}

function disruptPasswordCracker(
  session: HackSessionState,
  run: HackSessionState['runningTools'][number],
  rng: () => number,
): IceDisruptionEvent {
  const iceLevel = getTargetIceLevel(session);
  const addedDelayMs = 750 + iceLevel * 350;
  run.durationMs += addedDelayMs;
  run.iceDelayMs = (run.iceDelayMs ?? 0) + addedDelayMs;
  run.disruptedBy = 'ice';
  const injectedCharacter = ICE_BAD_CHARACTERS[
    Math.floor(rng() * ICE_BAD_CHARACTERS.length)
  ]!;
  return {
    runId: run.runId,
    toolId: run.toolId,
    reason: 'ice',
    disruptionKind: 'bad_character',
    injectedCharacter,
    addedDelayMs,
    message: 'ICE injected a bad character into the password stream.',
  };
}

function disruptGenericTool(
  session: HackSessionState,
  run: HackSessionState['runningTools'][number],
  tool: Tool | undefined,
): IceDisruptionEvent {
  const iceLevel = getTargetIceLevel(session);
  const addedDelayMs = 500 + iceLevel * 250;
  run.durationMs += addedDelayMs;
  run.iceDelayMs = (run.iceDelayMs ?? 0) + addedDelayMs;
  run.disruptedBy = 'ice';
  const toolName = tool?.name ?? 'Tool';
  return {
    runId: run.runId,
    toolId: run.toolId,
    reason: 'ice',
    disruptionKind: 'stall',
    addedDelayMs,
    message: `${toolName} stalled by ICE.`,
  };
}

export function applyIceDisruptionToTool(
  session: HackSessionState,
  run: HackSessionState['runningTools'][number],
  _nowMs: number,
  tool: Tool | undefined,
  rng: () => number = Math.random,
): IceDisruptionEvent | null {
  switch (run.category) {
    case 'anti_firewall':
      return disruptAntiFirewallTool(session, run);
    case 'cracker':
      return disruptPasswordCracker(session, run, rng);
    default:
      return disruptGenericTool(session, run, tool);
  }
}

function isWithinIceCooldown(
  run: HackSessionState['runningTools'][number],
  nowMs: number,
): boolean {
  if (run.lastIceDisruptionAtMs === undefined) return false;
  return nowMs - run.lastIceDisruptionAtMs < ICE_DISRUPTION_COOLDOWN_MS;
}

export function advanceIceDisruption(
  session: HackSessionState,
  tools: Tool[],
  deltaMs: number,
  nowMs: number,
  rng: () => number = Math.random,
): SessionServerMessage[] {
  const iceLevel = getTargetIceLevel(session);
  if (iceLevel <= 0 || deltaMs <= 0) return [];

  const deltaSeconds = deltaMs / 1000;
  const messages: SessionServerMessage[] = [];

  for (const run of session.runningTools) {
    if (run.completed || run.cancelled) continue;
    if (isWithinIceCooldown(run, nowMs)) continue;
    if (!shouldIceDisrupt(iceLevel, deltaSeconds, rng)) continue;

    const tool = findTool(tools, run.toolId);
    const event = applyIceDisruptionToTool(session, run, nowMs, tool, rng);
    if (!event) continue;

    run.lastIceDisruptionAtMs = nowMs;
    run.iceDisruptionCount = (run.iceDisruptionCount ?? 0) + 1;

    messages.push({
      type: 'tool_disrupted',
      runId: event.runId,
      toolId: event.toolId,
      reason: event.reason,
      disruptionKind: event.disruptionKind,
      message: event.message,
      injectedCharacter: event.injectedCharacter,
      addedDelayMs: event.addedDelayMs,
    });
  }

  return messages;
}
