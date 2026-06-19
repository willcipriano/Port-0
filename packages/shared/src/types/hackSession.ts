export type HackSessionStatus = 'active' | 'disconnected' | 'traced' | 'completed';

export interface TraceState {
  startedAt: string;
  deadlineAt: string;
  progressSeconds: number;
  blockerExtensionsSeconds: number;
}

export interface RunningToolProcess {
  toolId: string;
  startedAt: string;
  ramCost: number;
  cpuCost: number;
}

export interface HackSession {
  id: string;
  accountId: string;
  targetIpv6: string;
  status: HackSessionStatus;
  trace: TraceState;
  runningTools: RunningToolProcess[];
  shellAccessLevel: 'guest' | 'user' | 'root';
  createdAt: string;
}

/** WebSocket messages for /session */
export type SessionClientMessage =
  | { type: 'connect'; ipv6: string }
  | { type: 'run_tool'; toolId: string }
  | { type: 'shell_command'; command: string }
  | { type: 'claim' }
  | { type: 'disconnect' };

export type SessionServerMessage =
  | { type: 'session_started'; sessionId: string; prompt: string; traceDeadlineAt: string }
  | { type: 'tool_output'; toolId: string; output: string }
  | { type: 'shell_output'; output: string }
  | { type: 'trace_progress'; progressSeconds: number; deadlineAt: string }
  | { type: 'claimed'; ipv6: string }
  | { type: 'traced'; consequence: 'hospital' | 'prison' }
  | { type: 'error'; message: string }
  | { type: 'tick_applied'; tickId: string; summary: string };
