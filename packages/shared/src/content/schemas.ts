import { z } from 'zod';

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    'scanner',
    'cracker',
    'exploit',
    'trace_blocker',
    'log_cleaner',
    'recon',
    'port_opener',
  ]),
  max_security_level: z.number().int().min(1).max(5),
  ram_cost: z.number().int().min(0),
  cpu_cost: z.number().int().min(0),
  duration_seconds: z.number().int().min(1),
  target_type: z.enum(['password', 'firewall', 'service', 'subnet', 'ownership', 'logs']),
  market_price: z.number().int().min(0),
  description: z.string(),
});

export const toolsFileSchema = z.object({
  balance_version: z.literal('balance-v0'),
  tools: z.array(toolSchema).min(1),
});

export const archetypeSchema = z.object({
  id: z.enum(['cheap_server', 'generic_linux', 'corp_workstation', 'mainframe']),
  name: z.string().min(1),
  tier: z.number().int().min(1).max(5),
  shell_character: z.string(),
  default_security: z.object({
    password: z.number().int(),
    firewall: z.number().int(),
    alarm: z.number().int(),
    encryption: z.number().int(),
    antivirus: z.number().int(),
  }),
});

export const archetypesFileSchema = z.object({
  balance_version: z.literal('balance-v0'),
  archetypes: z.array(archetypeSchema).min(3).max(5),
});

export const subnetFileSchema = z.object({
  balance_version: z.literal('balance-v0'),
  zone_id: z.string().min(1),
  zone_name: z.string().min(1),
  subnet_id: z.string().min(1),
  ipv6_prefix: z.string().regex(/^2001:db8:[0-9a-f]+:[0-9a-f]+::\/64$/i),
  theme: z.string().min(1),
  machine_count: z.number().int().min(1),
  landmark_count: z.number().int().min(1),
});

export const landmarkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ipv6: z.string().regex(/^2001:db8:[0-9a-f]+:[0-9a-f]+::[0-9a-f]+$/i),
  role: z.string().min(1),
  os_archetype_id: z.enum(['cheap_server', 'generic_linux', 'corp_workstation', 'mainframe']),
  /** Optional physical coordinates — if omitted, proc-gen assigns from geoAnchors */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const landmarksFileSchema = z.object({
  balance_version: z.literal('balance-v0'),
  landmarks: z.array(landmarkSchema).min(1),
});

export const balanceFileSchema = z.record(z.unknown());

export type ToolFileEntry = z.infer<typeof toolSchema>;
export type ArchetypeFileEntry = z.infer<typeof archetypeSchema>;
export type SubnetFileEntry = z.infer<typeof subnetFileSchema>;
export type LandmarkFileEntry = z.infer<typeof landmarkSchema>;
