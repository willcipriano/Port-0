import type { SecurityComponents } from '../types/machine.js';
import type { Tool } from '../types/tool.js';

export type SessionLifecycle =
  | 'connected'
  | 'tracing'
  | 'access_gained'
  | 'secured'
  | 'claimed'
  | 'disconnected'
  | 'caught';

export type ShellAccessLevel = 'guest' | 'user' | 'root';

export type TargetFaction = 'shady' | 'criminal' | 'government';

export interface TargetMachineContext {
  id: string;
  ipv6: string;
  osArchetypeId: string;
  securityComponents: SecurityComponents;
  faction: TargetFaction;
  alarmActive: boolean;
  isLandmark: boolean;
  rootPassword: string;
}

export interface RunningToolState {
  runId: string;
  toolId: string;
  category: Tool['category'];
  startedAtMs: number;
  durationMs: number;
  progressMs: number;
  ramCost: number;
  cpuCost: number;
  completed: boolean;
  cancelled: boolean;
  effectApplied: boolean;
  warmedUp: boolean;
  lastIceDisruptionAtMs?: number;
  iceDisruptionCount?: number;
  disruptedBy?: 'ice' | string;
  iceDelayMs?: number;
}

export interface SessionCommandLogEntry {
  at: string;
  kind: string;
  detail: string;
}

export interface HackSessionState {
  id: string;
  accountId: string;
  target: TargetMachineContext;
  lifecycle: SessionLifecycle;
  shellAccessLevel: ShellAccessLevel;
  tracing: boolean;
  traceExpiresAtMs: number | null;
  traceStartedAtMs: number | null;
  blockerExtensionsMs: number;
  passwordCracked: boolean;
  alarmDisabled: boolean;
  runningTools: RunningToolState[];
  installedToolIds: string[];
  rigCpu: number;
  rigRam: number;
  rigCpuUsed: number;
  rigRamUsed: number;
  subnetHeatLevel: number;
  lastActivityAtMs: number;
  commandTimestampsMs: number[];
  commandLog: SessionCommandLogEntry[];
  lootCollected: string[];
  createdAtMs: number;
  lastTickMs: number;
}

export interface RigContext {
  cpu: number;
  ram: number;
  installedToolIds: string[];
}

export interface ConnectInput {
  sessionId: string;
  accountId: string;
  target: TargetMachineContext;
  rig: RigContext;
  subnetHeatLevel: number;
  nowMs: number;
}

export type SessionClientMessage =
  | { type: 'connect'; ipv6: string }
  | { type: 'shell_command'; command: string }
  | { type: 'run_tool'; toolId: string }
  | { type: 'cancel_tool'; runId: string }
  | { type: 'claim' }
  | { type: 'disconnect' }
  | { type: 'abort' };

export type SessionServerMessage =
  | { type: 'session_ready'; accountId: string }
  | { type: 'session_started'; sessionId: string; prompt: string; accessLevel: ShellAccessLevel; tracing: boolean; traceExpiresAt?: string; targetPasswordLevel?: number; targetFirewallLevel?: number; targetIceLevel?: number }
  | { type: 'shell_output'; output: string }
  | { type: 'tool_started'; runId: string; toolId: string; durationSeconds: number; passwordLength?: number }
  | { type: 'tool_progress'; runId: string; toolId: string; progressPercent: number; revealedPrefix?: string }
  | { type: 'tool_completed'; runId: string; toolId: string; output: string }
  | { type: 'password_saved'; targetIpv6: string }
  | { type: 'tool_cancelled'; runId: string; toolId: string }
  | { type: 'tool_disrupted'; runId: string; toolId: string; reason: 'ice'; disruptionKind: 'disconnect' | 'bad_character' | 'stall'; message: string; injectedCharacter?: string; addedDelayMs?: number }
  | { type: 'trace_update'; tracing: boolean; progressSeconds: number; expiresAt: string | null; remainingSeconds: number }
  | { type: 'task_manager'; cpuUsed: number; cpuTotal: number; ramUsed: number; ramTotal: number; runningTools: Array<{ runId: string; toolId: string; progressPercent: number; revealedPrefix?: string }> }
  | { type: 'claim_result'; success: boolean; ipv6?: string; message: string }
  | { type: 'session_ended'; reason: string; message?: string }
  | { type: 'caught'; punishment: 'hospital' | 'prison'; message: string; statusExpiresAt: string }
  | { type: 'error'; code: string; message: string };

export interface SessionEvent {
  messages: SessionServerMessage[];
  ended?: boolean;
  caught?: boolean;
}
