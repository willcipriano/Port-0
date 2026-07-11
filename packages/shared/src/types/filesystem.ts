export type FsNodeType = 'directory' | 'file';

export type FsCategory =
  | 'tool'
  | 'loot'
  | 'qrypted'
  | 'credential'
  | 'intel'
  | 'contract'
  | 'log'
  | 'module'
  | 'archive'
  | 'trash';

export type FsHeat = 'cold' | 'warm' | 'hot' | 'burned' | 'collapsed';

export type FsStatus =
  | 'ok'
  | 'installed'
  | 'in_custody'
  | 'sealed'
  | 'hot'
  | 'laundered'
  | 'corrupted'
  | 'burned'
  | 'collapsed'
  | 'deleted';

export interface FsNode {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  nodeType: FsNodeType;
  category: FsCategory;
  sizeQgb: number;
  valueCredits: number;
  heat: FsHeat;
  status: FsStatus;
  toolId: string | null;
  originIpv6: string | null;
  metadata: Record<string, unknown>;
  protected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FsTypeBreakdownEntry {
  category: FsCategory;
  sizeQgb: number;
  count: number;
}

export interface FsTreeResponse {
  nodes: FsNode[];
  usedQgb: number;
  capacityQgb: number;
  breakdown: FsTypeBreakdownEntry[];
}

export interface FsCapacity {
  usedQgb: number;
  capacityQgb: number;
}

export const DEFAULT_FS_DIRECTORIES = [
  '/bin',
  '/loot',
  '/intel',
  '/contracts',
  '/contracts/active',
  '/contracts/completed',
  '/logs',
  '/trash',
] as const;

export const FS_CATEGORIES: FsCategory[] = [
  'tool',
  'loot',
  'qrypted',
  'credential',
  'intel',
  'contract',
  'log',
  'module',
  'archive',
  'trash',
];
