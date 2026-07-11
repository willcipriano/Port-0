import type { PoolClient } from 'pg';
import {
  DEFAULT_FS_DIRECTORIES,
  loadFilesystemBalance,
  normalizeFsPath,
  parentPathOf,
  basenameOf,
  toolPath,
  isValidFsName,
  type FsCategory,
  type FsHeat,
  type FsNode,
  type FsStatus,
  type FsTreeResponse,
  type FsTypeBreakdownEntry,
} from '@port0/shared';
import { getPool } from './pool.js';

export class FilesystemError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FilesystemError';
  }
}

export { normalizeFsPath, parentPathOf, basenameOf, toolPath };

interface DbFsRow {
  id: string;
  account_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  node_type: 'directory' | 'file';
  category: FsCategory;
  size_qgb: number;
  value_credits: number;
  heat: FsHeat;
  status: FsStatus;
  tool_id: string | null;
  origin_ipv6: string | null;
  metadata: Record<string, unknown> | null;
  protected: boolean;
  created_at: Date;
  updated_at: Date;
}

type Queryable = Pick<PoolClient, 'query'> | ReturnType<typeof getPool>;

function mapRow(row: DbFsRow): FsNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    path: row.path,
    nodeType: row.node_type,
    category: row.category,
    sizeQgb: row.size_qgb,
    valueCredits: row.value_credits,
    heat: row.heat,
    status: row.status,
    toolId: row.tool_id,
    originIpv6: row.origin_ipv6,
    metadata: row.metadata ?? {},
    protected: row.protected,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function wrapPathError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof Error && err.name === 'FsPathError') {
      throw new FilesystemError('invalid_path', err.message);
    }
    throw err;
  }
}

function safeNormalize(path: string): string {
  return wrapPathError(() => normalizeFsPath(path));
}

function toolSizeQgb(toolId: string): number {
  const balance = loadFilesystemBalance();
  return balance.toolSizeQgb[toolId] ?? balance.defaultToolSizeQgb;
}

async function getCapacityQgb(accountId: string, db: Queryable = getPool()): Promise<number> {
  const result = await db.query<{ storage: number }>(
    'SELECT storage FROM rigs WHERE account_id = $1',
    [accountId],
  );
  const storage = result.rows[0]?.storage;
  if (storage == null) {
    throw new FilesystemError('account_not_found', 'Rig not found for account');
  }
  return storage;
}

async function getUsedQgb(accountId: string, db: Queryable = getPool()): Promise<number> {
  const result = await db.query<{ used: string }>(
    `SELECT COALESCE(SUM(size_qgb), 0)::text AS used
     FROM user_fs_nodes
     WHERE account_id = $1 AND node_type = 'file'`,
    [accountId],
  );
  return Number(result.rows[0]?.used ?? 0);
}

async function assertCapacity(
  accountId: string,
  additionalQgb: number,
  db: Queryable,
): Promise<void> {
  if (additionalQgb <= 0) return;
  const [used, capacity] = await Promise.all([
    getUsedQgb(accountId, db),
    getCapacityQgb(accountId, db),
  ]);
  if (used + additionalQgb > capacity) {
    throw new FilesystemError(
      'storage_full',
      `Rig storage full: ${used + additionalQgb} / ${capacity} QGB`,
    );
  }
}

async function getNodeByPath(
  accountId: string,
  path: string,
  db: Queryable = getPool(),
): Promise<FsNode | null> {
  const normalized = safeNormalize(path);
  const result = await db.query<DbFsRow>(
    `SELECT * FROM user_fs_nodes WHERE account_id = $1 AND path = $2`,
    [accountId, normalized],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

async function requireNode(
  accountId: string,
  path: string,
  db: Queryable = getPool(),
): Promise<FsNode> {
  const node = await getNodeByPath(accountId, path, db);
  if (!node) throw new FilesystemError('not_found', `No such file or directory: ${path}`);
  return node;
}

async function insertDirectory(
  accountId: string,
  path: string,
  category: FsCategory,
  db: Queryable,
): Promise<FsNode> {
  const normalized = safeNormalize(path);
  const name = basenameOf(normalized);
  const parentPath = parentPathOf(normalized);
  let parentId: string | null = null;
  if (parentPath) {
    const parent = await requireNode(accountId, parentPath, db);
    if (parent.nodeType !== 'directory') {
      throw new FilesystemError('not_a_directory', `Not a directory: ${parentPath}`);
    }
    parentId = parent.id;
  }

  const existing = await getNodeByPath(accountId, normalized, db);
  if (existing) {
    if (existing.nodeType !== 'directory') {
      throw new FilesystemError('exists', `Path already exists: ${normalized}`);
    }
    return existing;
  }

  const result = await db.query<DbFsRow>(
    `INSERT INTO user_fs_nodes (
       account_id, parent_id, name, path, node_type, category,
       size_qgb, value_credits, heat, status, metadata
     ) VALUES ($1, $2, $3, $4, 'directory', $5, 0, 0, 'cold', 'ok', '{}'::jsonb)
     RETURNING *`,
    [accountId, parentId, name, normalized, category],
  );
  return mapRow(result.rows[0]);
}

function categoryForDefaultDir(path: string): FsCategory {
  if (path === '/bin' || path.startsWith('/bin/')) return 'tool';
  if (path === '/loot' || path.startsWith('/loot/')) return 'loot';
  if (path === '/intel' || path.startsWith('/intel/')) return 'intel';
  if (path === '/contracts' || path.startsWith('/contracts/')) return 'contract';
  if (path === '/logs' || path.startsWith('/logs/')) return 'log';
  if (path === '/trash' || path.startsWith('/trash/')) return 'trash';
  return 'intel';
}

function isSystemDir(path: string): boolean {
  return (DEFAULT_FS_DIRECTORIES as readonly string[]).includes(path);
}

export async function ensureDefaultTree(accountId: string, db: Queryable = getPool()): Promise<void> {
  for (const dir of DEFAULT_FS_DIRECTORIES) {
    await insertDirectory(accountId, dir, categoryForDefaultDir(dir), db);
  }
}

export async function createDirectory(accountId: string, path: string): Promise<FsNode> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureDefaultTree(accountId, client);
    const normalized = safeNormalize(path);
    const parts = normalized.split('/').filter(Boolean);
    let built = '';
    for (const part of parts) {
      built += `/${part}`;
      await insertDirectory(accountId, built, categoryForDefaultDir(built), client);
    }
    const node = await requireNode(accountId, normalized, client);
    await client.query('COMMIT');
    return node;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface CreateFileInput {
  path: string;
  category: FsCategory;
  sizeQgb: number;
  valueCredits?: number;
  heat?: FsHeat;
  status?: FsStatus;
  toolId?: string | null;
  originIpv6?: string | null;
  metadata?: Record<string, unknown>;
  protected?: boolean;
}

async function createFileWithClient(
  accountId: string,
  input: CreateFileInput,
  db: Queryable,
): Promise<FsNode> {
  const normalized = safeNormalize(input.path);
  if (input.sizeQgb < 0) {
    throw new FilesystemError('invalid_size', 'sizeQgb must be >= 0');
  }
  const name = basenameOf(normalized);
  const parentPath = parentPathOf(normalized);
  if (!parentPath) {
    throw new FilesystemError('invalid_path', 'Files cannot be created at root');
  }

  await ensureDefaultTree(accountId, db);

  const parts = parentPath.split('/').filter(Boolean);
  let built = '';
  for (const part of parts) {
    built += `/${part}`;
    await insertDirectory(accountId, built, categoryForDefaultDir(built), db);
  }

  const parent = await requireNode(accountId, parentPath, db);
  if (parent.nodeType !== 'directory') {
    throw new FilesystemError('not_a_directory', `Not a directory: ${parentPath}`);
  }

  const existing = await getNodeByPath(accountId, normalized, db);
  if (existing) {
    throw new FilesystemError('exists', `Path already exists: ${normalized}`);
  }

  await assertCapacity(accountId, input.sizeQgb, db);

  const result = await db.query<DbFsRow>(
    `INSERT INTO user_fs_nodes (
       account_id, parent_id, name, path, node_type, category,
       size_qgb, value_credits, heat, status, tool_id, origin_ipv6, metadata, protected
     ) VALUES (
       $1, $2, $3, $4, 'file', $5,
       $6, $7, $8, $9, $10, $11, $12::jsonb, $13
     )
     RETURNING *`,
    [
      accountId,
      parent.id,
      name,
      normalized,
      input.category,
      input.sizeQgb,
      input.valueCredits ?? 0,
      input.heat ?? 'cold',
      input.status ?? 'ok',
      input.toolId ?? null,
      input.originIpv6 ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.protected ?? false,
    ],
  );
  return mapRow(result.rows[0]);
}

export async function createFile(accountId: string, input: CreateFileInput): Promise<FsNode> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const node = await createFileWithClient(accountId, input, client);
    await client.query('COMMIT');
    return node;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function installToolFile(
  client: PoolClient,
  accountId: string,
  toolId: string,
): Promise<void> {
  await ensureDefaultTree(accountId, client);
  const path = toolPath(toolId);
  const existing = await getNodeByPath(accountId, path, client);
  if (existing) return;

  const byTool = await client.query<{ id: string }>(
    `SELECT id FROM user_fs_nodes
     WHERE account_id = $1 AND category = 'tool' AND tool_id = $2
       AND status = 'installed' AND node_type = 'file'
     LIMIT 1`,
    [accountId, toolId],
  );
  if (byTool.rows[0]) return;

  await createFileWithClient(accountId, {
    path,
    category: 'tool',
    sizeQgb: toolSizeQgb(toolId),
    valueCredits: 0,
    heat: 'cold',
    status: 'installed',
    toolId,
    metadata: { version: 1 },
  }, client);
}

export async function listInstalledToolIdsFromFs(accountId: string): Promise<string[]> {
  const pool = getPool();
  await ensureDefaultTree(accountId, pool);
  const result = await pool.query<{ tool_id: string }>(
    `SELECT DISTINCT tool_id
     FROM user_fs_nodes
     WHERE account_id = $1
       AND category = 'tool'
       AND status = 'installed'
       AND node_type = 'file'
       AND tool_id IS NOT NULL
       AND path LIKE '/bin/%'
       AND path NOT LIKE '/trash/%'
     ORDER BY tool_id`,
    [accountId],
  );
  return result.rows.map((r) => r.tool_id);
}

export async function removeToolFiles(accountId: string, toolIds: string[]): Promise<number> {
  if (toolIds.length === 0) return 0;
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM user_fs_nodes
     WHERE account_id = $1
       AND category = 'tool'
       AND tool_id = ANY($2::text[])`,
    [accountId, toolIds],
  );
  return result.rowCount ?? 0;
}

export async function backfillToolsFromRigTools(accountId: string): Promise<void> {
  const pool = getPool();
  const existing = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM user_fs_nodes
     WHERE account_id = $1 AND category = 'tool' AND node_type = 'file'`,
    [accountId],
  );
  if (Number(existing.rows[0]?.n ?? 0) > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureDefaultTree(accountId, client);
    const tools = await client.query<{ tool_id: string }>(
      'SELECT tool_id FROM rig_tools WHERE account_id = $1',
      [accountId],
    );
    for (const row of tools.rows) {
      await installToolFile(client, accountId, row.tool_id);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getTree(accountId: string): Promise<FsTreeResponse> {
  const pool = getPool();
  await ensureDefaultTree(accountId, pool);
  await backfillToolsFromRigTools(accountId);

  const result = await pool.query<DbFsRow>(
    `SELECT * FROM user_fs_nodes WHERE account_id = $1 ORDER BY path`,
    [accountId],
  );
  const nodes = result.rows.map(mapRow);
  const [usedQgb, capacityQgb] = await Promise.all([
    getUsedQgb(accountId, pool),
    getCapacityQgb(accountId, pool),
  ]);
  const breakdown = await getTypeBreakdown(accountId);
  return { nodes, usedQgb, capacityQgb, breakdown };
}

export async function getNode(accountId: string, path: string): Promise<FsNode> {
  await ensureDefaultTree(accountId);
  return requireNode(accountId, path);
}

export async function getUsage(
  accountId: string,
): Promise<{ usedQgb: number; capacityQgb: number }> {
  const pool = getPool();
  await ensureDefaultTree(accountId, pool);
  const [usedQgb, capacityQgb] = await Promise.all([
    getUsedQgb(accountId, pool),
    getCapacityQgb(accountId, pool),
  ]);
  return { usedQgb, capacityQgb };
}

export async function getTypeBreakdown(accountId: string): Promise<FsTypeBreakdownEntry[]> {
  const pool = getPool();
  const result = await pool.query<{ category: FsCategory; size_qgb: string; count: string }>(
    `SELECT category, COALESCE(SUM(size_qgb), 0)::text AS size_qgb, COUNT(*)::text AS count
     FROM user_fs_nodes
     WHERE account_id = $1 AND node_type = 'file'
     GROUP BY category
     ORDER BY SUM(size_qgb) DESC`,
    [accountId],
  );
  return result.rows.map((r) => ({
    category: r.category,
    sizeQgb: Number(r.size_qgb),
    count: Number(r.count),
  }));
}

async function rewriteSubtreePaths(
  accountId: string,
  oldPath: string,
  newPath: string,
  db: Queryable,
): Promise<void> {
  await db.query(
    `UPDATE user_fs_nodes
     SET path = $3 || substr(path, length($2) + 1),
         updated_at = NOW()
     WHERE account_id = $1
       AND (path = $2 OR path LIKE $2 || '/%')`,
    [accountId, oldPath, newPath],
  );
}

export async function renameNode(
  accountId: string,
  path: string,
  newName: string,
): Promise<FsNode> {
  if (!isValidFsName(newName)) {
    throw new FilesystemError('invalid_name', 'Invalid file name');
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const node = await requireNode(accountId, path, client);
    if (node.path === '/trash' || node.path === '/bin') {
      throw new FilesystemError('protected', 'Cannot rename system directory');
    }
    const parent = parentPathOf(node.path);
    const newPath = parent ? `${parent}/${newName}` : `/${newName}`;
    const conflict = await getNodeByPath(accountId, newPath, client);
    if (conflict) {
      throw new FilesystemError('exists', `Path already exists: ${newPath}`);
    }
    await client.query(
      `UPDATE user_fs_nodes SET name = $3, path = $4, updated_at = NOW()
       WHERE account_id = $1 AND id = $2`,
      [accountId, node.id, newName, newPath],
    );
    if (node.nodeType === 'directory') {
      await rewriteSubtreePaths(accountId, node.path, newPath, client);
    }
    const updated = await requireNode(accountId, newPath, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function moveNode(accountId: string, from: string, to: string): Promise<FsNode> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const node = await requireNode(accountId, from, client);
    if (node.nodeType === 'directory' && isSystemDir(node.path)) {
      throw new FilesystemError('protected', 'Cannot move system directory');
    }

    let destPath = safeNormalize(to);
    const destExisting = await getNodeByPath(accountId, destPath, client);
    if (destExisting?.nodeType === 'directory') {
      destPath = `${destPath}/${node.name}`;
    }

    if (destPath === node.path) {
      await client.query('COMMIT');
      return node;
    }
    if (node.nodeType === 'directory' && (destPath === node.path || destPath.startsWith(`${node.path}/`))) {
      throw new FilesystemError('invalid_move', 'Cannot move a directory into itself');
    }

    const destParentPath = parentPathOf(destPath);
    if (!destParentPath) {
      throw new FilesystemError('invalid_path', 'Cannot move to root');
    }

    const parts = destParentPath.split('/').filter(Boolean);
    let built = '';
    for (const part of parts) {
      built += `/${part}`;
      await insertDirectory(accountId, built, categoryForDefaultDir(built), client);
    }

    const destParent = await requireNode(accountId, destParentPath, client);
    if (destParent.nodeType !== 'directory') {
      throw new FilesystemError('not_a_directory', `Not a directory: ${destParentPath}`);
    }

    const conflict = await getNodeByPath(accountId, destPath, client);
    if (conflict) {
      throw new FilesystemError('exists', `Path already exists: ${destPath}`);
    }

    const newName = basenameOf(destPath);
    await client.query(
      `UPDATE user_fs_nodes
       SET parent_id = $3, name = $4, path = $5, updated_at = NOW()
       WHERE account_id = $1 AND id = $2`,
      [accountId, node.id, destParent.id, newName, destPath],
    );
    if (node.nodeType === 'directory') {
      await rewriteSubtreePaths(accountId, node.path, destPath, client);
    }

    const updated = await requireNode(accountId, destPath, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function uniqueTrashPath(name: string, existingPaths: Set<string>): string {
  let candidate = `/trash/${name}`;
  if (!existingPaths.has(candidate)) return candidate;
  let i = 1;
  while (existingPaths.has(`/trash/${name}.${i}`)) i += 1;
  return `/trash/${name}.${i}`;
}

export async function trashNode(accountId: string, path: string): Promise<FsNode> {
  const normalized = safeNormalize(path);
  if (isSystemDir(normalized)) {
    throw new FilesystemError('protected', 'Cannot trash system directory');
  }
  if (normalized === '/trash' || normalized.startsWith('/trash/')) {
    throw new FilesystemError('already_trashed', 'Item is already in trash');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureDefaultTree(accountId, client);
    const node = await requireNode(accountId, normalized, client);
    if (node.protected) {
      throw new FilesystemError('protected', 'Cannot trash protected file');
    }

    const trashChildren = await client.query<{ path: string }>(
      `SELECT path FROM user_fs_nodes WHERE account_id = $1 AND path LIKE '/trash/%'`,
      [accountId],
    );
    const existing = new Set(trashChildren.rows.map((r) => r.path));
    const dest = uniqueTrashPath(node.name, existing);

    const metadata = {
      ...node.metadata,
      trashedFrom: node.path,
      previousStatus: node.status,
    };

    const trashDir = await requireNode(accountId, '/trash', client);
    await client.query(
      `UPDATE user_fs_nodes
       SET parent_id = $3,
           name = $4,
           path = $5,
           status = 'deleted',
           metadata = $6::jsonb,
           updated_at = NOW()
       WHERE account_id = $1 AND id = $2`,
      [accountId, node.id, trashDir.id, basenameOf(dest), dest, JSON.stringify(metadata)],
    );
    if (node.nodeType === 'directory') {
      await rewriteSubtreePaths(accountId, node.path, dest, client);
      await client.query(
        `UPDATE user_fs_nodes
         SET status = 'deleted', updated_at = NOW()
         WHERE account_id = $1 AND (path = $2 OR path LIKE $2 || '/%')`,
        [accountId, dest],
      );
    }

    const updated = await requireNode(accountId, dest, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function restoreNode(accountId: string, path: string): Promise<FsNode> {
  const normalized = safeNormalize(path);
  if (!normalized.startsWith('/trash/')) {
    throw new FilesystemError('not_in_trash', 'Item is not in trash');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const node = await requireNode(accountId, normalized, client);
    const trashedFrom =
      typeof node.metadata.trashedFrom === 'string' ? node.metadata.trashedFrom : null;
    if (!trashedFrom) {
      throw new FilesystemError('no_restore_path', 'Original path unknown; move manually');
    }

    const previousStatus =
      typeof node.metadata.previousStatus === 'string'
        ? (node.metadata.previousStatus as FsStatus)
        : node.category === 'tool'
          ? 'installed'
          : 'ok';

    const destParentPath = parentPathOf(trashedFrom);
    if (!destParentPath) {
      throw new FilesystemError('invalid_path', 'Cannot restore to root');
    }

    const parts = destParentPath.split('/').filter(Boolean);
    let built = '';
    for (const part of parts) {
      built += `/${part}`;
      await insertDirectory(accountId, built, categoryForDefaultDir(built), client);
    }

    let destPath = trashedFrom;
    if (await getNodeByPath(accountId, destPath, client)) {
      let i = 1;
      destPath = `${destParentPath}/${node.name}.restored.${i}`;
      while (await getNodeByPath(accountId, destPath, client)) {
        i += 1;
        destPath = `${destParentPath}/${node.name}.restored.${i}`;
      }
    }

    const destParent = await requireNode(accountId, parentPathOf(destPath)!, client);
    const restMeta = { ...node.metadata };
    delete restMeta.trashedFrom;
    delete restMeta.previousStatus;

    await client.query(
      `UPDATE user_fs_nodes
       SET parent_id = $3,
           name = $4,
           path = $5,
           status = $6,
           metadata = $7::jsonb,
           updated_at = NOW()
       WHERE account_id = $1 AND id = $2`,
      [
        accountId,
        node.id,
        destParent.id,
        basenameOf(destPath),
        destPath,
        previousStatus,
        JSON.stringify(restMeta),
      ],
    );
    if (node.nodeType === 'directory') {
      await rewriteSubtreePaths(accountId, node.path, destPath, client);
      await client.query(
        `UPDATE user_fs_nodes
         SET status = 'ok', updated_at = NOW()
         WHERE account_id = $1 AND path LIKE $2 || '/%'`,
        [accountId, destPath],
      );
    }

    const updated = await requireNode(accountId, destPath, client);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function runToolFromPath(
  accountId: string,
  path: string,
): Promise<{ toolId: string; node: FsNode }> {
  const node = await getNode(accountId, path);
  if (node.nodeType !== 'file' || node.category !== 'tool' || !node.toolId) {
    throw new FilesystemError('not_a_tool', 'Only installed tool files can be run');
  }
  if (node.status !== 'installed' || node.path.startsWith('/trash/')) {
    throw new FilesystemError('tool_not_installed', 'Tool is not installed');
  }
  return { toolId: node.toolId, node };
}
