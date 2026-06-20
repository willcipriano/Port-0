/** @deprecated Import from `@port0/shared` hack module for Stage 3 types. */
export type {
  SessionLifecycle,
  ShellAccessLevel,
  TargetFaction,
  SessionClientMessage,
  SessionServerMessage,
} from '../hack/sessionTypes.js';

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
