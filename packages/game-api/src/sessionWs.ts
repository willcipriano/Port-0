import type { WSContext } from 'hono/ws';
import {
  loadToolsCatalog,
  type HackSessionState,
  type SessionClientMessage,
  type SessionServerMessage,
  type TargetMachineContext,
  connectSession,
  tickSession,
  handleShellCommand,
  handleRunTool,
  handleCancelTool,
  handleClaim,
  handleDisconnect,
  handleAbort,
} from '@port0/shared';
import {
  addLoot,
  applyCatchPunishment,
  claimMachine,
  createSessionId,
  deleteHackSession,
  findMachineByIpv6,
  getActiveSession,
  getDefaultSubnetId,
  getSubnetHeat,
  listInstalledTools,
  saveHackSession,
  type DbAccountWithRig,
} from '@port0/db';

const TICK_INTERVAL_MS = 1000;

interface SessionSocketState {
  account: DbAccountWithRig;
  session: HackSessionState | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  subnetId: string | null;
}

function send(ws: WSContext, message: SessionServerMessage): void {
  ws.send(JSON.stringify(message));
}

function sendMany(ws: WSContext, messages: SessionServerMessage[]): void {
  for (const message of messages) {
    send(ws, message);
  }
}

function parseClientMessage(raw: string): SessionClientMessage | null {
  try {
    const data = JSON.parse(raw) as SessionClientMessage;
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    return data;
  } catch {
    return null;
  }
}

function machineToTarget(row: NonNullable<Awaited<ReturnType<typeof findMachineByIpv6>>>): TargetMachineContext {
  return {
    id: row.id,
    ipv6: row.ipv6,
    osArchetypeId: row.os_archetype_id,
    securityComponents: row.security_components,
    faction: row.faction as TargetMachineContext['faction'],
    alarmActive: row.alarm_active,
    isLandmark: row.is_landmark,
  };
}

async function persistSession(session: HackSessionState): Promise<void> {
  await saveHackSession(session);
}

async function endSession(
  ws: WSContext,
  state: SessionSocketState,
  session: HackSessionState,
): Promise<void> {
  stopTickLoop(state);
  await deleteHackSession(session);
  state.session = null;
}

function stopTickLoop(state: SessionSocketState): void {
  if (state.tickTimer) {
    clearInterval(state.tickTimer);
    state.tickTimer = null;
  }
}

function startTickLoop(ws: WSContext, state: SessionSocketState): void {
  stopTickLoop(state);
  const tools = loadToolsCatalog();
  state.tickTimer = setInterval(async () => {
    if (!state.session) return;
    try {
      const result = tickSession(state.session, Date.now(), tools);
      sendMany(ws, result.messages);
      await persistSession(state.session);

      if (result.caught) {
        const punishment = await applyCatchPunishment(
          state.session.accountId,
          state.session.target.faction,
          state.subnetId,
        );
        send(ws, {
          type: 'caught',
          punishment: punishment.punishment,
          message: punishment.message,
          statusExpiresAt: punishment.statusExpiresAt,
        });
        send(ws, {
          type: 'session_ended',
          reason: 'caught',
          message: punishment.message,
        });
        await endSession(ws, state, state.session);
        ws.close(1000, 'traced');
        return;
      }

      if (result.ended) {
        await endSession(ws, state, state.session);
      }
    } catch (err) {
      send(ws, {
        type: 'error',
        code: 'tick_failed',
        message: err instanceof Error ? err.message : 'Session tick failed',
      });
    }
  }, TICK_INTERVAL_MS);
}

async function handleConnect(
  ws: WSContext,
  state: SessionSocketState,
  ipv6: string,
): Promise<void> {
  if (state.session) {
    send(ws, { type: 'error', code: 'session_active', message: 'Disconnect current session first.' });
    return;
  }

  const existing = await getActiveSession(state.account.id);
  if (existing) {
    send(ws, { type: 'error', code: 'session_active', message: 'Account already has an active hack session.' });
    return;
  }

  const machine = await findMachineByIpv6(ipv6);
  if (!machine) {
    send(ws, { type: 'error', code: 'target_not_found', message: 'Target IPv6 not found in world registry.' });
    return;
  }

  if (!machine.security_components) {
    send(ws, { type: 'error', code: 'target_invalid', message: 'Target machine is missing security data.' });
    return;
  }

  const subnetId = state.subnetId ?? (await getDefaultSubnetId());
  const heatLevel = subnetId ? await getSubnetHeat(subnetId) : 0;
  const installedToolIds = await listInstalledTools(state.account.id);
  const sessionId = createSessionId();
  const nowMs = Date.now();

  const connected = connectSession({
    sessionId,
    accountId: state.account.id,
    target: machineToTarget(machine),
    rig: {
      cpu: state.account.cpu,
      ram: state.account.ram,
      installedToolIds,
    },
    subnetHeatLevel: heatLevel,
    nowMs,
  });

  state.session = connected.state;
  await persistSession(state.session);
  sendMany(ws, connected.messages);
  startTickLoop(ws, state);
}

export function createSessionWebSocketHandlers(account: DbAccountWithRig, subnetId: string | null) {
  const state: SessionSocketState = {
    account,
    session: null,
    tickTimer: null,
    subnetId,
  };

  return {
    onOpen: (_event: Event, ws: WSContext) => {
      send(ws, { type: 'session_ready', accountId: account.id });
    },
    onMessage: async (event: MessageEvent, ws: WSContext) => {
      const message = parseClientMessage(event.data.toString());
      if (!message) {
        send(ws, { type: 'error', code: 'invalid_message', message: 'Invalid JSON message.' });
        return;
      }

      const tools = loadToolsCatalog();
      const nowMs = Date.now();

      try {
        switch (message.type) {
          case 'connect':
            await handleConnect(ws, state, message.ipv6);
            return;

          case 'shell_command': {
            if (!state.session) {
              send(ws, { type: 'error', code: 'no_session', message: 'Connect to a target first.' });
              return;
            }
            const beforeLoot = state.session.lootCollected.length;
            const shellResult = handleShellCommand(state.session, message.command, nowMs);
            sendMany(ws, shellResult.messages);
            const newLoot = state.session.lootCollected.slice(beforeLoot);
            for (const label of newLoot) {
              const lootType = label.includes('credential')
                ? 'credentials'
                : label.includes('source')
                  ? 'source_code'
                  : 'data';
              await addLoot(state.session.accountId, lootType, label, state.session.target.ipv6);
            }
            await persistSession(state.session);
            return;
          }

          case 'run_tool': {
            if (!state.session) {
              send(ws, { type: 'error', code: 'no_session', message: 'Connect to a target first.' });
              return;
            }
            const toolResult = handleRunTool(state.session, message.toolId, tools, nowMs);
            sendMany(ws, toolResult.messages);
            await persistSession(state.session);
            return;
          }

          case 'cancel_tool': {
            if (!state.session) {
              send(ws, { type: 'error', code: 'no_session', message: 'Connect to a target first.' });
              return;
            }
            const cancelResult = handleCancelTool(state.session, message.runId, nowMs);
            sendMany(ws, cancelResult.messages);
            await persistSession(state.session);
            return;
          }

          case 'claim': {
            if (!state.session) {
              send(ws, { type: 'error', code: 'no_session', message: 'Connect to a target first.' });
              return;
            }
            const claimResult = handleClaim(state.session, nowMs);
            sendMany(ws, claimResult.messages);
            if (claimResult.messages.some((m) => m.type === 'claim_result' && m.success)) {
              await claimMachine(state.session.target.id, state.session.accountId);
            }
            await persistSession(state.session);
            if (claimResult.ended && state.session) {
              await endSession(ws, state, state.session);
            }
            return;
          }

          case 'disconnect': {
            if (!state.session) {
              send(ws, { type: 'session_ended', reason: 'disconnect', message: 'No active session.' });
              return;
            }
            const disconnectResult = handleDisconnect(state.session, nowMs);
            sendMany(ws, disconnectResult.messages);
            await endSession(ws, state, state.session);
            return;
          }

          case 'abort': {
            if (!state.session) {
              send(ws, { type: 'session_ended', reason: 'abort', message: 'No active session.' });
              return;
            }
            const abortResult = handleAbort(state.session, nowMs);
            sendMany(ws, abortResult.messages);
            await endSession(ws, state, state.session);
            return;
          }

          default:
            send(ws, { type: 'error', code: 'unknown_type', message: 'Unknown message type.' });
        }
      } catch (err) {
        send(ws, {
          type: 'error',
          code: 'handler_error',
          message: err instanceof Error ? err.message : 'Request failed',
        });
      }
    },
    onClose: async () => {
      stopTickLoop(state);
      if (state.session) {
        handleDisconnect(state.session, Date.now(), 'socket_closed');
        await deleteHackSession(state.session);
        state.session = null;
      }
    },
  };
}
