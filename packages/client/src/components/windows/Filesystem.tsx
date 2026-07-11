import { useMemo, useState, useCallback, type CSSProperties } from 'react';
import type { FsCategory, FsNode } from '@port0/shared';
import { useFilesystem } from '../../hooks/useFilesystem';
import { layoutTreemap, type TreemapItem } from '../../utils/treemap';
import { TOOL_REGISTRY, type ToolRegistryKey } from '../../tools/registry';

type ViewMode = 'map' | 'list' | 'types';

interface Props {
  accountId: string;
  onLaunchTool?: (toolId: string) => void;
}

const CATEGORY_COLORS: Record<FsCategory, string> = {
  tool: 'var(--fs-tool, #00e5ff)',
  loot: 'var(--fs-loot, #00ff9f)',
  qrypted: 'var(--fs-qrypt, #ff8800)',
  credential: 'var(--fs-cred, #ffee00)',
  intel: 'var(--fs-intel, #4488ff)',
  contract: 'var(--fs-contract, #aa88ff)',
  log: 'var(--fs-log, #5a7060)',
  module: 'var(--fs-module, #88ffcc)',
  archive: 'var(--fs-archive, #6688aa)',
  trash: 'var(--fs-trash, #3a4048)',
};

const HEAT_BORDER: Record<string, string> = {
  cold: 'transparent',
  warm: 'var(--accent-yellow)',
  hot: 'var(--accent-orange)',
  burned: 'var(--accent-red)',
  collapsed: 'var(--text-dim)',
};

function parentPath(path: string): string | null {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return null;
  return path.slice(0, idx);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function findToolRegistryKey(toolId: string): ToolRegistryKey | null {
  for (const [key, def] of Object.entries(TOOL_REGISTRY)) {
    if (def.toolId === toolId) return key as ToolRegistryKey;
  }
  return null;
}

export function Filesystem({ accountId, onLaunchTool }: Props) {
  const fs = useFilesystem(accountId);
  const [view, setView] = useState<ViewMode>('list');
  const [cwd, setCwd] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'size' | 'value' | 'heat'>('size');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byPath = useMemo(() => {
    const map = new Map<string, FsNode>();
    for (const n of fs.nodes) map.set(n.path, n);
    return map;
  }, [fs.nodes]);

  const selected = selectedPath ? byPath.get(selectedPath) ?? null : null;

  const listing = useMemo(() => {
    if (cwd == null) {
      return fs.nodes.filter((n) => n.path.split('/').filter(Boolean).length === 1);
    }
    return fs.nodes.filter((n) => parentPath(n.path) === cwd);
  }, [fs.nodes, cwd]);

  const filteredListing = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let rows = listing;
    if (q) {
      rows = rows.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q) ||
          n.path.toLowerCase().includes(q),
      );
    }
    const heatOrder = { cold: 0, warm: 1, hot: 2, burned: 3, collapsed: 4 };
    return [...rows].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'size') return directorySize(b, fs.nodes) - directorySize(a, fs.nodes);
      if (sortKey === 'value') return b.valueCredits - a.valueCredits;
      return (heatOrder[b.heat] ?? 0) - (heatOrder[a.heat] ?? 0);
    });
  }, [listing, filter, sortKey, fs.nodes]);

  const mapItems = useMemo((): TreemapItem[] => {
    const dirs = listing.filter((n) => n.nodeType === 'directory');
    const files = listing.filter((n) => n.nodeType === 'file');

    // At root (or any folder with subdirs that hold size), show directory regions first
    const dirItems = dirs
      .map((d) => ({
        id: d.id,
        label: `${d.name}/`,
        value: directorySize(d, fs.nodes),
        category: d.category,
        heat: d.heat,
        path: d.path,
        nodeType: 'directory' as const,
      }))
      .filter((d) => d.value > 0);

    if (cwd == null && dirItems.length > 0) {
      return dirItems;
    }

    if (files.length > 0) {
      return files.map((n) => ({
        id: n.id,
        label: n.name,
        value: Math.max(n.sizeQgb, 1),
        category: n.category,
        heat: n.heat,
        path: n.path,
        nodeType: n.nodeType,
      }));
    }

    return dirItems.map((d) => ({ ...d, value: Math.max(d.value, 1) }));
  }, [fs.nodes, cwd, listing]);

  const mapRects = useMemo(() => layoutTreemap(mapItems, 100, 100), [mapItems]);

  const breadcrumb = useMemo(() => {
    if (!cwd) return [{ label: '/', path: null as string | null }];
    const parts = cwd.split('/').filter(Boolean);
    const crumbs: { label: string; path: string | null }[] = [{ label: '/', path: null }];
    let built = '';
    for (const part of parts) {
      built += `/${part}`;
      crumbs.push({ label: part, path: built });
    }
    return crumbs;
  }, [cwd]);

  const usagePct = fs.capacityQgb > 0 ? Math.min(100, (fs.usedQgb / fs.capacityQgb) * 100) : 0;

  const runAction = useCallback(
    async (fn: () => Promise<void>, okMsg: string) => {
      setBusy(true);
      setActionMsg(null);
      try {
        await fn();
        setActionMsg(okMsg);
      } catch (err) {
        setActionMsg(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleOpen = (node: FsNode) => {
    if (node.nodeType === 'directory') {
      setCwd(node.path);
      setSelectedPath(node.path);
    } else {
      setSelectedPath(node.path);
    }
  };

  const handleRun = async () => {
    if (!selected || selected.category !== 'tool') return;
    setBusy(true);
    try {
      const res = await fs.run(selected.path);
      onLaunchTool?.(res.toolId);
      setActionMsg(`Ready: ${res.toolId}`);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (!selected) return;
    const name = window.prompt('New name', selected.name);
    if (!name || name === selected.name) return;
    await runAction(() => fs.rename(selected.path, name), `Renamed to ${name}`);
    setSelectedPath(parentPath(selected.path) ? `${parentPath(selected.path)}/${name}` : `/${name}`);
  };

  const handleMove = async () => {
    if (!selected) return;
    const to = window.prompt('Move to path (directory or full destination)', cwd ?? '/loot');
    if (!to) return;
    await runAction(() => fs.move(selected.path, to), 'Moved');
  };

  const handleMkdir = async () => {
    const base = cwd ?? '';
    const name = window.prompt('New folder name');
    if (!name) return;
    const path = `${base}/${name}`.replace(/\/+/g, '/');
    await runAction(() => fs.mkdir(path.startsWith('/') ? path : `/${path}`), 'Folder created');
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: '4px 10px',
    fontSize: '9px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    border: `1px solid ${active ? 'var(--border-bright)' : 'var(--border)'}`,
    background: active ? 'var(--bg-panel-3)' : 'transparent',
    color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '8px',
        gap: '6px',
        overflow: 'hidden',
        background: 'var(--bg-panel)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div className="label" style={{ margin: 0 }}>
          LOCAL RIG // FILESYSTEM
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['map', 'list', 'types'] as ViewMode[]).map((m) => (
            <button key={m} type="button" style={tabStyle(view === m)} onClick={() => setView(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
        <span>
          {fs.usedQgb} / {fs.capacityQgb} QGB
        </span>
        <span>{usagePct.toFixed(0)}% used</span>
      </div>
      <div className="progress-wrap">
        <div
          className={`progress-fill ${usagePct > 80 ? 'danger' : usagePct > 60 ? 'warning' : ''}`}
          style={{ width: `${usagePct}%` }}
        />
      </div>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', fontSize: '10px' }}>
        {breadcrumb.map((c, i) => (
          <span key={`${c.path ?? 'root'}-${i}`}>
            {i > 0 && <span style={{ color: 'var(--text-dim)', margin: '0 2px' }}>/</span>}
            <button
              type="button"
              className="btn btn-sm"
              style={{ padding: '1px 4px', fontSize: '9px' }}
              onClick={() => {
                setCwd(c.path);
                setSelectedPath(c.path);
              }}
            >
              {c.label}
            </button>
          </span>
        ))}
        <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={handleMkdir} disabled={busy}>
          + DIR
        </button>
        <button type="button" className="btn btn-sm" onClick={() => fs.load()} disabled={busy}>
          REFRESH
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '6px' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid var(--border)',
            background: 'var(--bg-panel-2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {fs.loading && (
            <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '10px' }}>Loading rig storage…</div>
          )}
          {fs.error && (
            <div style={{ padding: '12px', color: 'var(--text-danger)', fontSize: '10px' }}>{fs.error}</div>
          )}
          {!fs.loading && !fs.error && view === 'map' && (
            <StorageMap
              rects={mapRects}
              selectedPath={selectedPath}
              onSelect={(path) => {
                const node = byPath.get(path);
                if (node) handleOpen(node);
              }}
            />
          )}
          {!fs.loading && !fs.error && view === 'list' && (
            <FileList
              rows={filteredListing}
              allNodes={fs.nodes}
              selectedPath={selectedPath}
              filter={filter}
              sortKey={sortKey}
              onFilter={setFilter}
              onSort={setSortKey}
              onSelect={handleOpen}
            />
          )}
          {!fs.loading && !fs.error && view === 'types' && (
            <TypeBreakdown breakdown={fs.breakdown} total={fs.usedQgb} />
          )}
        </div>

        <div
          style={{
            width: '200px',
            flexShrink: 0,
            border: '1px solid var(--border)',
            background: 'var(--bg-panel-2)',
            padding: '8px',
            overflow: 'auto',
            fontSize: '10px',
          }}
        >
          {!selected ? (
            <div style={{ color: 'var(--text-muted)' }}>Select a block or row</div>
          ) : (
            <DetailPanel
              node={selected}
              sizeDisplay={directorySize(selected, fs.nodes)}
              busy={busy}
              onRun={selected.category === 'tool' ? handleRun : undefined}
              onRename={handleRename}
              onMove={handleMove}
              onTrash={
                selected.path.startsWith('/trash/')
                  ? undefined
                  : () => runAction(() => fs.trash(selected.path), 'Trashed')
              }
              onRestore={
                selected.path.startsWith('/trash/')
                  ? () => runAction(() => fs.restore(selected.path), 'Restored')
                  : undefined
              }
              canRun={
                selected.category === 'tool' &&
                selected.status === 'installed' &&
                Boolean(findToolRegistryKey(selected.toolId ?? '') || selected.toolId)
              }
            />
          )}
        </div>
      </div>

      {actionMsg && (
        <div style={{ fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.06em' }}>{actionMsg}</div>
      )}
    </div>
  );
}

function directorySize(node: FsNode, all: FsNode[]): number {
  if (node.nodeType === 'file') return node.sizeQgb;
  return all
    .filter((n) => n.nodeType === 'file' && (n.path === node.path || n.path.startsWith(`${node.path}/`)))
    .reduce((s, n) => s + n.sizeQgb, 0);
}

function StorageMap({
  rects,
  selectedPath,
  onSelect,
}: {
  rects: ReturnType<typeof layoutTreemap>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  if (rects.length === 0) {
    return (
      <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '10px' }}>
        Empty region — install tools or navigate into a folder
      </div>
    );
  }

  return (
    <div className="fs-storage-map" style={{ position: 'relative', flex: 1, minHeight: 0, margin: '4px' }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        {rects.map((r) => {
          const selected = r.path === selectedPath;
          const fill = CATEGORY_COLORS[r.category as FsCategory] ?? 'var(--accent-cyan)';
          const stroke = selected ? 'var(--text-bright)' : HEAT_BORDER[r.heat] || 'var(--border)';
          return (
            <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(r.path)}>
              <rect
                x={r.x + 0.3}
                y={r.y + 0.3}
                width={Math.max(0, r.width - 0.6)}
                height={Math.max(0, r.height - 0.6)}
                fill={fill}
                fillOpacity={r.category === 'qrypted' ? 0.55 : 0.35}
                stroke={stroke}
                strokeWidth={selected || r.heat === 'hot' ? 0.6 : 0.25}
              />
              {r.width > 8 && r.height > 6 && (
                <text
                  x={r.x + 1}
                  y={r.y + 3.5}
                  fill="var(--text-bright)"
                  fontSize="2.4"
                  style={{ pointerEvents: 'none', fontFamily: 'var(--font-mono)' }}
                >
                  {r.label.length > 14 ? `${r.label.slice(0, 12)}…` : r.label}
                </text>
              )}
              {r.width > 8 && r.height > 9 && (
                <text
                  x={r.x + 1}
                  y={r.y + 6.2}
                  fill="var(--text-muted)"
                  fontSize="2"
                  style={{ pointerEvents: 'none', fontFamily: 'var(--font-mono)' }}
                >
                  {r.value} QGB
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FileList({
  rows,
  allNodes,
  selectedPath,
  filter,
  sortKey,
  onFilter,
  onSort,
  onSelect,
}: {
  rows: FsNode[];
  allNodes: FsNode[];
  selectedPath: string | null;
  filter: string;
  sortKey: string;
  onFilter: (v: string) => void;
  onSort: (v: 'name' | 'size' | 'value' | 'heat') => void;
  onSelect: (n: FsNode) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '4px', padding: '4px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder="Filter…"
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '10px',
            padding: '3px 6px',
            fontFamily: 'var(--font-mono)',
          }}
        />
        <select
          value={sortKey}
          onChange={(e) => onSort(e.target.value as 'name' | 'size' | 'value' | 'heat')}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: '9px',
          }}
        >
          <option value="size">Size</option>
          <option value="name">Name</option>
          <option value="value">Value</option>
          <option value="heat">Heat</option>
        </select>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="data-table" style={{ width: '100%', fontSize: '9px' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>QGB</th>
              <th>Heat</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr
                key={n.id}
                onClick={() => onSelect(n)}
                onDoubleClick={() => onSelect(n)}
                style={{
                  cursor: 'pointer',
                  background: n.path === selectedPath ? 'rgba(0,229,255,0.08)' : undefined,
                }}
              >
                <td>
                  {n.nodeType === 'directory' ? `[${n.name}]` : n.name}
                </td>
                <td style={{ color: CATEGORY_COLORS[n.category] }}>{n.category}</td>
                <td>{directorySize(n, allNodes)}</td>
                <td>{n.heat}</td>
                <td>{n.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                  Empty
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypeBreakdown({
  breakdown,
  total,
}: {
  breakdown: { category: FsCategory; sizeQgb: number; count: number }[];
  total: number;
}) {
  if (breakdown.length === 0) {
    return <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '10px' }}>No files yet</div>;
  }
  return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto' }}>
      {breakdown.map((b) => {
        const pct = total > 0 ? (b.sizeQgb / total) * 100 : 0;
        return (
          <div key={b.category}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '9px' }}>
              <span style={{ color: CATEGORY_COLORS[b.category], letterSpacing: '0.1em' }}>
                {b.category.toUpperCase()} ×{b.count}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{b.sizeQgb} QGB</span>
            </div>
            <div className="progress-wrap">
              <div
                className="progress-fill"
                style={{
                  width: `${pct}%`,
                  background: CATEGORY_COLORS[b.category],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailPanel({
  node,
  sizeDisplay,
  busy,
  canRun,
  onRun,
  onRename,
  onMove,
  onTrash,
  onRestore,
}: {
  node: FsNode;
  sizeDisplay: number;
  busy: boolean;
  canRun: boolean;
  onRun?: () => void;
  onRename: () => void;
  onMove: () => void;
  onTrash?: () => void;
  onRestore?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <div style={{ color: 'var(--text-bright)', fontSize: '11px', wordBreak: 'break-all' }}>{node.name}</div>
        <div style={{ color: 'var(--text-dim)', fontSize: '9px', marginTop: '2px' }}>{node.path}</div>
      </div>
      <MetaRow label="Type" value={`${node.nodeType} / ${node.category}`} />
      <MetaRow label="Size" value={`${sizeDisplay} QGB`} />
      <MetaRow label="Value" value={`${node.valueCredits} cr`} />
      <MetaRow label="Heat" value={node.heat} />
      <MetaRow label="Status" value={node.status} />
      {node.toolId && <MetaRow label="Tool ID" value={node.toolId} />}
      {node.originIpv6 && <MetaRow label="Origin" value={node.originIpv6} />}
      <MetaRow label="Modified" value={formatTime(node.updatedAt)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
        {onRun && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !canRun} onClick={onRun}>
            RUN
          </button>
        )}
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onRename}>
          RENAME
        </button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onMove}>
          MOVE
        </button>
        {onTrash && (
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onTrash}>
            TRASH
          </button>
        )}
        {onRestore && (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onRestore}>
            RESTORE
          </button>
        )}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
