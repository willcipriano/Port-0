import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  archetypesFileSchema,
  landmarksFileSchema,
  subnetFileSchema,
  type ArchetypeFileEntry,
  type LandmarkFileEntry,
  type SubnetFileEntry,
} from '../content/schemas.js';

function loadJsonOrYaml(path: string): unknown {
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return parseYaml(raw);
  }
  return JSON.parse(raw);
}

export function contentRoot(): string {
  if (process.env.CONTENT_DIR) return resolve(process.env.CONTENT_DIR);
  return resolve(process.cwd(), '../../content');
}

export interface WorldContent {
  subnet: SubnetFileEntry;
  archetypes: ArchetypeFileEntry[];
  landmarks: LandmarkFileEntry[];
}

function firstExisting(root: string, candidates: string[]): string | null {
  for (const rel of candidates) {
    const path = join(root, rel);
    if (existsSync(path)) return path;
  }
  return null;
}

function loadArchetypes(root: string): ArchetypeFileEntry[] {
  const dir = join(root, 'archetypes');
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
    if (files.length > 0) {
      const all: ArchetypeFileEntry[] = [];
      for (const file of files.sort()) {
        const data = loadJsonOrYaml(join(dir, file));
        const parsed = archetypesFileSchema.parse(data);
        all.push(...parsed.archetypes);
      }
      return all;
    }
  }

  const fallback = firstExisting(root, ['archetypes/mvp-archetypes.json', 'archetypes/mvp-archetypes.yaml']);
  if (!fallback) throw new Error('No archetype content found under content/archetypes/');
  const parsed = archetypesFileSchema.parse(loadJsonOrYaml(fallback));
  return parsed.archetypes;
}

function loadLandmarks(root: string): LandmarkFileEntry[] {
  const dir = join(root, 'landmarks');
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
    if (files.length > 0) {
      const all: LandmarkFileEntry[] = [];
      for (const file of files.sort()) {
        const data = loadJsonOrYaml(join(dir, file));
        const parsed = landmarksFileSchema.parse(data);
        all.push(...parsed.landmarks);
      }
      return all;
    }
  }

  const fallback = firstExisting(root, ['landmarks/mvp-landmarks.json', 'landmarks/mvp-landmarks.yaml']);
  if (!fallback) return [];
  const parsed = landmarksFileSchema.parse(loadJsonOrYaml(fallback));
  return parsed.landmarks;
}

function loadSubnet(root: string): SubnetFileEntry {
  const path =
    firstExisting(root, ['subnet/mvp-subnet.json', 'subnet/mvp.yaml', 'subnet/mvp-subnet.yaml']) ??
    join(root, 'subnet/mvp-subnet.json');
  if (!existsSync(path)) throw new Error('No subnet content found under content/subnet/');
  return subnetFileSchema.parse(loadJsonOrYaml(path));
}

export function loadWorldContent(root = contentRoot()): WorldContent {
  return {
    subnet: loadSubnet(root),
    archetypes: loadArchetypes(root),
    landmarks: loadLandmarks(root),
  };
}
