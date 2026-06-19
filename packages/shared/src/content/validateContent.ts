import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  archetypesFileSchema,
  landmarksFileSchema,
  subnetFileSchema,
  toolsFileSchema,
  balanceFileSchema,
} from './schemas.js';

function contentRoot(): string {
  const fromEnv = process.env.CONTENT_DIR;
  if (fromEnv) return resolve(fromEnv);
  return resolve(process.cwd(), '../../content');
}

function loadJsonOrYaml(path: string): unknown {
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return parseYaml(raw);
  }
  return JSON.parse(raw);
}

function validateBalanceDir(root: string): string[] {
  const errors: string[] = [];
  const balanceDir = join(root, 'balance');
  if (!existsSync(balanceDir)) {
    errors.push(`Missing content/balance directory at ${balanceDir}`);
    return errors;
  }
  for (const file of readdirSync(balanceDir)) {
    if (!file.endsWith('.json')) continue;
    const data = loadJsonOrYaml(join(balanceDir, file));
    const result = balanceFileSchema.safeParse(data);
    if (!result.success) {
      errors.push(`balance/${file}: ${result.error.message}`);
    } else if ((data as { balance_version?: string }).balance_version !== 'balance-v0') {
      errors.push(`balance/${file}: missing balance_version balance-v0`);
    }
  }
  return errors;
}

export function validateContent(root = contentRoot()): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  const toolsPath = join(root, 'tools', 'mvp-tools.json');
  if (!existsSync(toolsPath)) {
    errors.push(`Missing ${toolsPath}`);
  } else {
    const toolsResult = toolsFileSchema.safeParse(loadJsonOrYaml(toolsPath));
    if (!toolsResult.success) errors.push(`tools/mvp-tools.json: ${toolsResult.error.message}`);
  }

  const archetypesPath = join(root, 'archetypes', 'mvp-archetypes.json');
  if (!existsSync(archetypesPath)) {
    errors.push(`Missing ${archetypesPath}`);
  } else {
    const archetypesResult = archetypesFileSchema.safeParse(loadJsonOrYaml(archetypesPath));
    if (!archetypesResult.success) {
      errors.push(`archetypes/mvp-archetypes.json: ${archetypesResult.error.message}`);
    }
  }

  const subnetPath = join(root, 'subnet', 'mvp-subnet.json');
  if (!existsSync(subnetPath)) {
    errors.push(`Missing ${subnetPath}`);
  } else {
    const subnetResult = subnetFileSchema.safeParse(loadJsonOrYaml(subnetPath));
    if (!subnetResult.success) errors.push(`subnet/mvp-subnet.json: ${subnetResult.error.message}`);
  }

  const landmarksPath = join(root, 'landmarks', 'mvp-landmarks.json');
  if (!existsSync(landmarksPath)) {
    errors.push(`Missing ${landmarksPath}`);
  } else {
    const landmarksResult = landmarksFileSchema.safeParse(loadJsonOrYaml(landmarksPath));
    if (!landmarksResult.success) {
      errors.push(`landmarks/mvp-landmarks.json: ${landmarksResult.error.message}`);
    }
  }

  errors.push(...validateBalanceDir(root));

  return { ok: errors.length === 0, errors };
}

if (process.argv[1]?.includes('validateContent')) {
  const result = validateContent();
  if (result.ok) {
    console.log('Content validation passed.');
    process.exit(0);
  }
  console.error('Content validation failed:');
  for (const err of result.errors) console.error(`  - ${err}`);
  process.exit(1);
}
