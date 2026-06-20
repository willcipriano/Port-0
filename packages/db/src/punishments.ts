import {
  loadHeatBalance,
  loadToolsCatalog,
  loadTraceBalance,
  punishmentForFaction,
  type TargetFaction,
} from '@port0/shared';
import { getPool } from './pool.js';
import { incrementSubnetHeat } from './machines.js';
import { listInstalledTools, removeTools } from './rigTools.js';

export interface PunishmentResult {
  punishment: 'hospital' | 'prison';
  statusExpiresAt: string;
  fine: number;
  confiscatedTools: string[];
  message: string;
}

export async function applyCatchPunishment(
  accountId: string,
  faction: TargetFaction,
  subnetId: string | null,
): Promise<PunishmentResult> {
  const pool = getPool();
  const traceBalance = loadTraceBalance();
  const heatBalance = loadHeatBalance();
  const punishment = punishmentForFaction(faction);

  const accountResult = await pool.query<{ offense_count: number; crypto_balance: number }>(
    'SELECT offense_count, crypto_balance FROM accounts WHERE id = $1',
    [accountId],
  );
  const account = accountResult.rows[0];
  if (!account) throw new Error('Account not found');

  const offenseCount = account.offense_count + 1;
  const escalation = traceBalance.punishment.escalationMultiplier ** (offenseCount - 1);

  const baseMinutes =
    punishment === 'prison'
      ? traceBalance.punishment.prisonBaseMinutes
      : traceBalance.punishment.hospitalBaseMinutes;
  const durationMinutes = Math.ceil(baseMinutes * escalation);
  const statusExpiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

  const fineBase =
    punishment === 'prison'
      ? traceBalance.punishment.prisonFine
      : traceBalance.punishment.hospitalFine;
  const fine = Math.min(account.crypto_balance, Math.ceil(fineBase * escalation));

  let confiscatedTools: string[] = [];
  if (punishment === 'prison' && traceBalance.punishment.confiscateIllegalOnPrison) {
    const installed = await listInstalledTools(accountId);
    const catalog = loadToolsCatalog();
    const illegalCategories = new Set(traceBalance.illegalToolCategories);
    confiscatedTools = installed.filter((toolId) => {
      const tool = catalog.find((t) => t.id === toolId);
      return tool ? illegalCategories.has(tool.category) : false;
    });
    await removeTools(accountId, confiscatedTools);
  }

  await pool.query(
    `UPDATE accounts
     SET status = $2,
         status_expires_at = $3,
         crypto_balance = GREATEST(0, crypto_balance - $4),
         offense_count = $5
     WHERE id = $1`,
    [accountId, punishment, statusExpiresAt, fine, offenseCount],
  );

  if (subnetId) {
    await incrementSubnetHeat(subnetId, heatBalance.heatPerCaughtHack);
  }

  await pool.query(
    `INSERT INTO audit_log (event_type, account_id, payload)
     VALUES ('hack_caught', $1, $2::jsonb)`,
    [
      accountId,
      JSON.stringify({
        punishment,
        faction,
        fine,
        offense_count: offenseCount,
        confiscated_tools: confiscatedTools,
        status_expires_at: statusExpiresAt,
      }),
    ],
  );

  const message =
    punishment === 'prison'
      ? `Trace complete. Authorities seized your rig tools and locked you out for ${durationMinutes} minutes.`
      : `They traced you back. Hospital for ${durationMinutes} minutes — fine ${fine} crypto deducted.`;

  return {
    punishment,
    statusExpiresAt,
    fine,
    confiscatedTools,
    message,
  };
}
