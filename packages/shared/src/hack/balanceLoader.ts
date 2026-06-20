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

export function loadHeatBalance(root = worldContentRoot()): { heatPerCaughtHack: number } {
  const raw = loadJson(resolve(root, 'balance/heat.json')) as Record<string, unknown>;
  return { heatPerCaughtHack: Number(raw.heat_per_caught_hack ?? 5) };
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
