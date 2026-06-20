import {
  computeSiegeResolution,
  computeVirusStorageDamage,
  emptySiegeState,
  loadSiegeBalance,
  type SiegeInteractiveState,
} from '@port0/shared';
import type { Siege, SiegeDashboard, SiegeOutcome, SiegeStatus } from '@port0/shared';
import type { PoolClient } from 'pg';
import { getPool } from './pool.js';
import { connectRedis, accountEventsChannel } from './redis.js';
import { findMachineByIpv6, getMachineOwner, transferMachineOwnership } from './machines.js';
import { getFleetAggregates } from './fleet.js';
import { hasIntelOnTarget } from './intel.js';
import { consumeVirusUse, getVirusById } from './viruses.js';

export interface DeclareSiegeInput {
  attackerAccountId: string;
  targetIpv6: string;
  committedCpu?: number;
  committedRam?: number;
  virusIds?: string[];
}

export class SiegeError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SiegeError';
  }
}

interface SiegeRow {
  id: string;
  target_ipv6: string;
  target_machine_id: string;
  attacker_account_id: string;
  defender_account_id: string;
  status: SiegeStatus;
  outcome: SiegeOutcome | null;
  declared_at: Date;
  interactive_window_ends_at: Date;
  resolve_at_tick: string | null;
  committed_cpu: number;
  committed_ram: number;
  deployed_virus_ids: string[];
  state: SiegeInteractiveState;
  resolved_at: Date | null;
}

function parseState(raw: unknown): SiegeInteractiveState {
  if (!raw || typeof raw !== 'object') return emptySiegeState();
  const s = raw as Partial<SiegeInteractiveState>;
  return {
    attackerActions: s.attackerActions ?? [],
    defenderActions: s.defenderActions ?? [],
    virusDeployments: s.virusDeployments ?? [],
    isolatedNodes: s.isolatedNodes ?? [],
    storageDamage: s.storageDamage ?? 0,
    escalations: s.escalations ?? 0,
    countermeasures: s.countermeasures ?? 0,
  };
}

function toSiege(row: SiegeRow): Siege {
  return {
    id: row.id,
    targetIpv6: row.target_ipv6,
    attackerAccountId: row.attacker_account_id,
    defenderAccountId: row.defender_account_id,
    status: row.status,
    declaredAt: row.declared_at.toISOString(),
    interactiveWindowEndsAt: row.interactive_window_ends_at.toISOString(),
    resolveAt: row.resolve_at_tick != null ? String(row.resolve_at_tick) : undefined,
    outcome: row.outcome ?? undefined,
  };
}

function toDashboard(state: SiegeInteractiveState): SiegeDashboard {
  return {
    storageDamage: state.storageDamage,
    escalations: state.escalations,
    countermeasures: state.countermeasures,
    isolatedNodes: state.isolatedNodes,
    virusDeployments: state.virusDeployments.length,
    attackerActions: state.attackerActions,
    defenderActions: state.defenderActions,
  };
}

export async function declareSiege(input: DeclareSiegeInput): Promise<Siege> {
  const balance = loadSiegeBalance();
  const machine = await findMachineByIpv6(input.targetIpv6);
  if (!machine) {
    throw new SiegeError('target_not_found', 'Target IPv6 not found');
  }

  const owner = await getMachineOwner(machine.id);
  if (!owner) {
    throw new SiegeError('target_unowned', 'Target is not a player-owned drone');
  }
  if (owner.accountId === input.attackerAccountId) {
    throw new SiegeError('own_target', 'Cannot siege your own drone');
  }

  if (!balance.allowSiegeWithoutRecon) {
    const hasIntel = await hasIntelOnTarget(input.attackerAccountId, input.targetIpv6);
    if (!hasIntel) {
      throw new SiegeError('recon_required', 'Recon intel required before declaring siege');
    }
  }

  const attackerFleet = await getFleetAggregates(input.attackerAccountId);
  const committedCpu = Math.min(input.committedCpu ?? attackerFleet.attack, attackerFleet.attack);
  const committedRam = Math.min(input.committedRam ?? attackerFleet.mpPool, attackerFleet.mpPool);

  if (committedCpu <= 0) {
    throw new SiegeError('no_fleet_cpu', 'Attacker fleet has no committed CPU');
  }

  const virusIds = input.virusIds ?? [];
  for (const virusId of virusIds) {
    const virus = await getVirusById(virusId, input.attackerAccountId);
    if (!virus) {
      throw new SiegeError('virus_not_found', `Virus ${virusId} not found`);
    }
  }

  const windowMs = balance.interactiveWindowMinutes * 60 * 1000;
  const interactiveEnds = new Date(Date.now() + windowMs);

  const pool = getPool();
  const result = await pool.query<SiegeRow>(
    `INSERT INTO sieges (
       target_ipv6, target_machine_id, attacker_account_id, defender_account_id,
       status, interactive_window_ends_at, committed_cpu, committed_ram, deployed_virus_ids, state
     ) VALUES (LOWER($1), $2, $3, $4, 'interactive', $5, $6, $7, $8::jsonb, $9::jsonb)
     RETURNING *`,
    [
      input.targetIpv6,
      machine.id,
      input.attackerAccountId,
      owner.accountId,
      interactiveEnds,
      committedCpu,
      committedRam,
      JSON.stringify(virusIds),
      JSON.stringify(emptySiegeState()),
    ],
  );

  const siege = toSiege(result.rows[0]!);
  await notifySiegeEvent(siege, 'siege_declared');
  return siege;
}

async function notifySiegeEvent(siege: Siege, type: string, extra: Record<string, unknown> = {}): Promise<void> {
  const redis = await connectRedis();
  const payload = JSON.stringify({ type, siegeId: siege.id, targetIpv6: siege.targetIpv6, ...extra });
  await redis.publish(accountEventsChannel(siege.attackerAccountId), payload);
  if (siege.defenderAccountId) {
    await redis.publish(accountEventsChannel(siege.defenderAccountId), payload);
  }
}

export async function getSiege(siegeId: string, accountId: string): Promise<{ siege: Siege; dashboard: SiegeDashboard } | null> {
  const pool = getPool();
  const result = await pool.query<SiegeRow>(
    `SELECT * FROM sieges
     WHERE id = $1 AND (attacker_account_id = $2 OR defender_account_id = $2)`,
    [siegeId, accountId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const state = parseState(row.state);
  return { siege: toSiege(row), dashboard: toDashboard(state) };
}

export async function getSiegeById(siegeId: string): Promise<{ siege: Siege; dashboard: SiegeDashboard; state: SiegeInteractiveState; row: SiegeRow } | null> {
  const pool = getPool();
  const result = await pool.query<SiegeRow>(`SELECT * FROM sieges WHERE id = $1`, [siegeId]);
  const row = result.rows[0];
  if (!row) return null;
  const state = parseState(row.state);
  return { siege: toSiege(row), dashboard: toDashboard(state), state, row };
}

export type SiegeAction =
  | { type: 'deploy_virus'; virusId: string; targetIpv6?: string }
  | { type: 'escalate' }
  | { type: 'target_drone'; targetIpv6: string }
  | { type: 'countermeasure' }
  | { type: 'isolate_node'; targetIpv6: string }
  | { type: 'defend_tool'; toolId: string };

export async function applySiegeAction(
  siegeId: string,
  accountId: string,
  action: SiegeAction,
): Promise<{ siege: Siege; dashboard: SiegeDashboard }> {
  const balance = loadSiegeBalance();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query<SiegeRow>(
      `SELECT * FROM sieges WHERE id = $1 FOR UPDATE`,
      [siegeId],
    );
    const row = locked.rows[0];
    if (!row) throw new SiegeError('not_found', 'Siege not found');
    if (row.status !== 'interactive') {
      throw new SiegeError('not_interactive', 'Siege is not in interactive phase');
    }
    if (new Date() > row.interactive_window_ends_at) {
      throw new SiegeError('window_closed', 'Interactive window has closed');
    }

    const state = parseState(row.state);
    const isAttacker = row.attacker_account_id === accountId;
    const isDefender = row.defender_account_id === accountId;
    if (!isAttacker && !isDefender) {
      throw new SiegeError('forbidden', 'Not a participant in this siege');
    }

    if (action.type === 'deploy_virus' && isAttacker) {
      const virus = await getVirusById(action.virusId, accountId);
      if (!virus || virus.usesRemaining <= 0) {
        throw new SiegeError('virus_unavailable', 'Virus not available');
      }
      const machine = await findMachineByIpv6(row.target_ipv6);
      const avLevel = machine?.security_components?.antivirus ?? 0;
      const damage = computeVirusStorageDamage(virus.level, avLevel, balance);
      state.storageDamage += damage;
      state.virusDeployments.push({
        virusId: action.virusId,
        targetIpv6: action.targetIpv6 ?? row.target_ipv6,
        damage,
      });
      state.attackerActions.push(`deploy_virus:${action.virusId}`);
      await consumeVirusUse(client, action.virusId, accountId);
    } else if (action.type === 'escalate' && isAttacker) {
      if (row.committed_cpu < state.escalations * balance.escalateCpuCost + balance.escalateCpuCost) {
        throw new SiegeError('insufficient_cpu', 'Not enough committed CPU to escalate');
      }
      state.escalations += 1;
      state.attackerActions.push('escalate');
    } else if (action.type === 'target_drone' && isAttacker) {
      state.attackerActions.push(`target:${action.targetIpv6}`);
    } else if (action.type === 'countermeasure' && isDefender) {
      const defenderFleet = await getFleetAggregates(row.defender_account_id);
      if (defenderFleet.mpPool < state.countermeasures * balance.countermeasureMpCost + balance.countermeasureMpCost) {
        throw new SiegeError('insufficient_mp', 'Not enough MP for countermeasure');
      }
      state.countermeasures += 1;
      state.defenderActions.push('countermeasure');
    } else if (action.type === 'isolate_node' && isDefender) {
      if (!state.isolatedNodes.includes(action.targetIpv6)) {
        state.isolatedNodes.push(action.targetIpv6);
      }
      state.defenderActions.push(`isolate:${action.targetIpv6}`);
    } else if (action.type === 'defend_tool' && isDefender) {
      state.defenderActions.push(`defend_tool:${action.toolId}`);
      state.countermeasures += 1;
    } else {
      throw new SiegeError('invalid_action', 'Action not allowed for your role');
    }

    await client.query(`UPDATE sieges SET state = $2::jsonb WHERE id = $1`, [
      siegeId,
      JSON.stringify(state),
    ]);
    await client.query('COMMIT');

    const siege = toSiege({ ...row, state });
    const dashboard = toDashboard(state);
    await notifySiegeEvent(siege, 'siege_updated', { dashboard });
    return { siege, dashboard };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function advanceSiegesToResolving(client: PoolClient, tickId: number): Promise<number> {
  const balance = loadSiegeBalance();
  const result = await client.query<SiegeRow>(
    `UPDATE sieges
     SET status = 'resolving', resolve_at_tick = $1
     WHERE status = 'interactive' AND interactive_window_ends_at <= NOW()
     RETURNING *`,
    [tickId + balance.resolveTicks],
  );
  for (const row of result.rows) {
    const siege = toSiege(row);
    await notifySiegeEvent(siege, 'siege_resolving');
  }
  return result.rowCount ?? 0;
}

export async function resolveSiegesForTick(client: PoolClient, tickId: number): Promise<number> {
  const balance = loadSiegeBalance();
  const pending = await client.query<SiegeRow>(
    `SELECT * FROM sieges
     WHERE status = 'resolving' AND resolve_at_tick IS NOT NULL AND resolve_at_tick <= $1`,
    [tickId],
  );

  let resolved = 0;
  for (const row of pending.rows) {
    const state = parseState(row.state);
    const machine = await findMachineByIpv6(row.target_ipv6);
    if (!machine) continue;

    const defenderOffline = state.defenderActions.length === 0;
    const isolatedCpu =
      state.isolatedNodes.includes(row.target_ipv6) ? machine.cpu : 0;
    const defenderCpu = Math.max(0, machine.cpu - isolatedCpu);

    const resolution = computeSiegeResolution({
      attackerCpu: row.committed_cpu,
      defenderCpu,
      defenderFirewall: machine.security_components?.firewall ?? 0,
      defenderAntivirus: machine.security_components?.antivirus ?? 0,
      virusStorageDamage: state.storageDamage,
      escalations: state.escalations,
      countermeasures: state.countermeasures,
      defenderOffline,
      balance,
    });

    const outcome: SiegeOutcome =
      resolution.winner === 'attacker' ? 'attacker_win' : 'defender_win';

    if (outcome === 'attacker_win') {
      await transferMachineOwnership(
        row.target_machine_id,
        row.defender_account_id,
        row.attacker_account_id,
        'siege_capture',
        client,
      );
    }

    await client.query(
      `UPDATE sieges
       SET status = 'completed', outcome = $2, resolved_at = NOW(),
           state = jsonb_set(state, '{resolution}', $3::jsonb)
       WHERE id = $1`,
      [
        row.id,
        outcome,
        JSON.stringify({
          attackPower: resolution.attackPower,
          defensePower: resolution.defensePower,
          outcomeScore: resolution.outcomeScore,
        }),
      ],
    );

    await client.query(
      `INSERT INTO audit_log (event_type, account_id, payload)
       VALUES ('siege_resolved', $1, $2::jsonb)`,
      [
        row.attacker_account_id,
        JSON.stringify({
          siege_id: row.id,
          target_ipv6: row.target_ipv6,
          outcome,
          attack_power: resolution.attackPower,
          defense_power: resolution.defensePower,
        }),
      ],
    );

    const siege = toSiege({
      ...row,
      status: 'completed',
      outcome,
      resolved_at: new Date(),
    });
    await notifySiegeEvent(siege, 'siege_outcome', {
      outcome,
      attackPower: resolution.attackPower,
      defensePower: resolution.defensePower,
    });
    resolved += 1;
  }
  return resolved;
}

export function validateSiegeTarget(ipv6: string): Promise<{ valid: boolean; reason?: string }> {
  return findMachineByIpv6(ipv6).then(async (machine) => {
    if (!machine) return { valid: false, reason: 'Target not found' };
    const owner = await getMachineOwner(machine.id);
    if (!owner) return { valid: false, reason: 'Target is not player-owned' };
    return { valid: true };
  });
}
