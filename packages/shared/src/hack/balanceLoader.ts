import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toolsFileSchema, type ToolFileEntry } from '../content/schemas.js';
import { contentRoot as worldContentRoot } from '../world/contentLoader.js';
import type { Tool, ToolCategory, ToolTargetType } from '../types/tool.js';

export interface TraceBalance {
  baseSeconds: number;
  heatMultiplierPerLevel: number;
  blockerExtensionSeconds: number;
  failedExploitBumpSeconds: number;
  idleTimeoutMinutes: number;
  commandRateLimitPerSecond: number;
  factionMultipliers: Record<string, number>;
  punishment: {
    hospitalBaseMinutes: number;
    hospitalFine: number;
    prisonBaseMinutes: number;
    prisonFine: number;
    escalationMultiplier: number;
    confiscateIllegalOnPrison: boolean;
  };
  illegalToolCategories: ToolCategory[];
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadToolsCatalog(root = worldContentRoot()): Tool[] {
  const data = loadJson(resolve(root, 'tools/mvp-tools.json'));
  const parsed = toolsFileSchema.parse(data);
  return parsed.tools.map(mapTool);
}

export function loadTraceBalance(root = worldContentRoot()): TraceBalance {
  const raw = loadJson(resolve(root, 'balance/trace.json')) as Record<string, unknown>;
  const punishment = raw.punishment as Record<string, unknown>;
  return {
    baseSeconds: Number(raw.base_seconds ?? 180),
    heatMultiplierPerLevel: Number(raw.heat_multiplier_per_level ?? 0.05),
    blockerExtensionSeconds: Number(raw.blocker_extension_seconds ?? 120),
    failedExploitBumpSeconds: Number(raw.failed_exploit_bump_seconds ?? 15),
    idleTimeoutMinutes: Number(raw.idle_timeout_minutes ?? 30),
    commandRateLimitPerSecond: Number(raw.command_rate_limit_per_second ?? 5),
    factionMultipliers: (raw.faction_multipliers as Record<string, number>) ?? {
      shady: 1.2,
      criminal: 1.0,
      government: 0.85,
    },
    punishment: {
      hospitalBaseMinutes: Number(punishment.hospital_base_minutes ?? 5),
      hospitalFine: Number(punishment.hospital_fine ?? 50),
      prisonBaseMinutes: Number(punishment.prison_base_minutes ?? 10),
      prisonFine: Number(punishment.prison_fine ?? 200),
      escalationMultiplier: Number(punishment.escalation_multiplier ?? 1.5),
      confiscateIllegalOnPrison: Boolean(punishment.confiscate_illegal_on_prison ?? true),
    },
    illegalToolCategories: (raw.illegal_tool_categories as ToolCategory[]) ?? [
      'cracker',
      'port_opener',
      'trace_blocker',
      'log_cleaner',
    ],
  };
}

export function loadHeatBalance(root = worldContentRoot()): {
  heatPerCaughtHack: number;
  decayPerTick: number;
  floorBaseline: number;
} {
  const raw = loadJson(resolve(root, 'balance/heat.json')) as Record<string, unknown>;
  return {
    heatPerCaughtHack: Number(raw.heat_per_caught_hack ?? 5),
    decayPerTick: Number(raw.decay_per_tick ?? 1),
    floorBaseline: Number(raw.floor_baseline ?? 0),
  };
}

export interface EconomyBalance {
  upkeepPerDronePerTick: number;
  passiveIncomePerDronePerTick: number;
  machinesPerScan: number;
  lootSellPrice: number;
  marketPriceVolatility: number;
}

export function loadEconomyBalance(root = worldContentRoot()): EconomyBalance {
  const raw = loadJson(resolve(root, 'balance/economy.json')) as Record<string, unknown>;
  return {
    upkeepPerDronePerTick: Number(raw.upkeep_per_drone_per_tick ?? 5),
    passiveIncomePerDronePerTick: Number(raw.passive_income_per_drone_per_tick ?? 10),
    machinesPerScan: Number(raw.machines_per_scan ?? 5),
    lootSellPrice: Number(raw.loot_sell_price ?? 25),
    marketPriceVolatility: Number(raw.market_price_volatility ?? 0.05),
  };
}

export function loadSiegeBalance(root = worldContentRoot()) {
  const raw = loadJson(resolve(root, 'balance/siege.json')) as Record<string, unknown>;
  return {
    resolveTicks: Number(raw.resolve_ticks ?? 1),
    interactiveWindowMinutes: Number(raw.interactive_window_minutes ?? 5),
    allowSiegeWithoutRecon: Boolean(raw.allow_siege_without_recon ?? false),
    reconSuccessChance: Number(raw.recon_success_chance ?? 0.65),
    reconMinConfidence: Number(raw.recon_min_confidence ?? 0.4),
    logAnalysisConfidence: Number(raw.log_analysis_confidence ?? 0.85),
    escalateCpuCost: Number(raw.escalate_cpu_cost ?? 2),
    escalateAttackBonus: Number(raw.escalate_attack_bonus ?? 3),
    countermeasureMpCost: Number(raw.countermeasure_mp_cost ?? 2),
    countermeasureDefenseBonus: Number(raw.countermeasure_defense_bonus ?? 4),
    virusStorageDamageBase: Number(raw.virus_storage_damage_base ?? 15),
    defenderPassiveFirewallWeight: Number(raw.defender_passive_firewall_weight ?? 2),
    defenderPassiveAntivirusWeight: Number(raw.defender_passive_antivirus_weight ?? 1),
  };
}

export function loadVirusBalance(root = worldContentRoot()) {
  const raw = loadJson(resolve(root, 'balance/virus.json')) as Record<string, unknown>;
  return {
    craftMinutes: Number(raw.craft_minutes ?? 30),
    uses: Number(raw.uses ?? 3),
    sourceCodeCraftTimeMultiplier: Number(raw.source_code_craft_time_multiplier ?? 0.5),
  };
}

function mapTool(entry: ToolFileEntry): Tool {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category as ToolCategory,
    maxSecurityLevel: entry.max_security_level,
    ramCost: entry.ram_cost,
    cpuCost: entry.cpu_cost,
    durationSeconds: entry.duration_seconds,
    targetType: entry.target_type as ToolTargetType,
    marketPrice: entry.market_price,
    description: entry.description,
  };
}
