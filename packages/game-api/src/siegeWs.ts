import type { WSContext } from 'hono/ws';
import type { SiegeClientMessage, SiegeServerMessage } from '@port0/shared';
import { applySiegeAction, getSiegeById, SiegeError } from '@port0/db';

const siegeRooms = new Map<string, Set<WSContext>>();

function send(ws: WSContext, message: SiegeServerMessage): void {
  ws.send(JSON.stringify(message));
}

function broadcast(siegeId: string, message: SiegeServerMessage): void {
  const room = siegeRooms.get(siegeId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const ws of room) {
    ws.send(payload);
  }
}

function parseMessage(raw: string): SiegeClientMessage | null {
  try {
    const data = JSON.parse(raw) as SiegeClientMessage;
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    return data;
  } catch {
    return null;
  }
}

async function pushState(siegeId: string, accountId: string): Promise<void> {
  const data = await getSiegeById(siegeId);
  if (!data) return;
  broadcast(siegeId, {
    type: 'siege_state',
    siege: data.siege,
    dashboard: data.dashboard,
  });
}

export function createSiegeWebSocketHandlers(siegeId: string, accountId: string) {
  return {
    onOpen: async (_event: Event, ws: WSContext) => {
      const data = await getSiegeById(siegeId);
      if (!data) {
        ws.close(4404, 'Siege not found');
        return;
      }
      if (
        data.siege.attackerAccountId !== accountId &&
        data.siege.defenderAccountId !== accountId
      ) {
        ws.close(4403, 'Not a siege participant');
        return;
      }
      let room = siegeRooms.get(siegeId);
      if (!room) {
        room = new Set();
        siegeRooms.set(siegeId, room);
      }
      room.add(ws);
      send(ws, { type: 'siege_state', siege: data.siege, dashboard: data.dashboard });
    },
    onMessage: async (event: MessageEvent, ws: WSContext) => {
      const message = parseMessage(event.data.toString());
      if (!message) {
        send(ws, { type: 'error', message: 'Invalid message' });
        return;
      }

      try {
        if (message.type === 'join') {
          await pushState(siegeId, accountId);
          return;
        }

        const action =
          message.type === 'deploy_virus'
            ? { type: 'deploy_virus' as const, virusId: message.virusId, targetIpv6: message.targetIpv6 }
            : message.type === 'escalate'
              ? { type: 'escalate' as const }
              : message.type === 'target_drone'
                ? { type: 'target_drone' as const, targetIpv6: message.targetIpv6 }
                : message.type === 'countermeasure'
                  ? { type: 'countermeasure' as const }
                  : message.type === 'isolate_node'
                    ? { type: 'isolate_node' as const, targetIpv6: message.targetIpv6 }
                    : message.type === 'defend_tool'
                      ? { type: 'defend_tool' as const, toolId: message.toolId }
                      : null;

        if (!action) {
          send(ws, { type: 'error', message: 'Unknown action' });
          return;
        }

        const result = await applySiegeAction(siegeId, accountId, action);
        broadcast(siegeId, { type: 'siege_state', siege: result.siege, dashboard: result.dashboard });
      } catch (err) {
        const msg = err instanceof SiegeError ? err.message : 'Action failed';
        send(ws, { type: 'error', message: msg });
      }
    },
    onClose: (_event: CloseEvent, ws: WSContext) => {
      const room = siegeRooms.get(siegeId);
      if (!room) return;
      room.delete(ws);
      if (room.size === 0) siegeRooms.delete(siegeId);
    },
  };
}

export function notifySiegeOutcome(
  siegeId: string,
  outcome: 'attacker_win' | 'defender_win' | 'cancelled',
  attackPower?: number,
  defensePower?: number,
): void {
  broadcast(siegeId, { type: 'outcome', outcome, attackPower, defensePower });
}
