import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useApi } from '../../hooks/useApi';
import type { HackSession } from '../../hooks/useHackSession';

export interface VaultEntry {
  targetIpv6: string;
  password: string;
  lastUpdated: string;
}

type RecencyFilter = 'all' | 'today' | 'week' | 'month';
type SortMode = 'recent' | 'oldest' | 'address_asc' | 'address_desc';

interface Props {
  accountId: string;
  session?: HackSession;
  onConnect?: (ipv6: string) => void;
  connectedIpv6?: string | null;
}

function deriveSubnetPrefix(ipv6: string): string {
  const idx = ipv6.indexOf('::');
  if (idx === -1) return ipv6;
  return `${ipv6.slice(0, idx)}::`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatIpv6(ipv6: string) {
  const suffix = ipv6.slice(-8);
  const prefix = ipv6.slice(0, -8);
  return { prefix, suffix };
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(0,229,255,0.25)', color: 'inherit' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function passesRecency(iso: string, filter: RecencyFilter): boolean {
  if (filter === 'all') return true;
  const age = Date.now() - new Date(iso).getTime();
  if (filter === 'today') return age <= 24 * 60 * 60 * 1000;
  if (filter === 'week') return age <= 7 * 24 * 60 * 60 * 1000;
  return age <= 30 * 24 * 60 * 60 * 1000;
}

export function PasswordVault({ accountId, session, onConnect, connectedIpv6 }: Props) {
  const { get, del } = useApi(accountId);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const [recency, setRecency] = useState<RecencyFilter>('all');
  const [subnetFilter, setSubnetFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');
  const [copyFlash, setCopyFlash] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<{ passwords: VaultEntry[] }>('/passwords');
      setEntries(res.passwords ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!session) return;
    return session.subscribe((event) => {
      if (event.type === 'password_saved') {
        load();
      }
    });
  }, [session, load]);

  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(load, 30_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchRaw), 150);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const dominantSubnet = useMemo(() => {
    if (entries.length === 0) return null;
    const counts = new Map<string, number>();
    for (const e of entries) {
      const p = deriveSubnetPrefix(e.targetIpv6);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    let best = '';
    let max = 0;
    for (const [p, c] of counts) {
      if (c > max) { max = c; best = p; }
    }
    return best;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries.filter(e => {
      if (!passesRecency(e.lastUpdated, recency)) return false;
      if (subnetFilter && deriveSubnetPrefix(e.targetIpv6) !== subnetFilter) return false;
      if (!q) return true;
      return e.targetIpv6.toLowerCase().includes(q)
        || e.password.toLowerCase().includes(q);
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
        case 'address_asc':
          return a.targetIpv6.localeCompare(b.targetIpv6);
        case 'address_desc':
          return b.targetIpv6.localeCompare(a.targetIpv6);
        default:
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      }
    });
    return list;
  }, [entries, search, recency, subnetFilter, sort]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !filtered.some(e => e.targetIpv6 === selected)) {
      setSelected(filtered[0].targetIpv6);
    }
  }, [filtered, selected]);

  const current = filtered.find(e => e.targetIpv6 === selected) ?? null;
  const connected = connectedIpv6?.toLowerCase() ?? null;

  const moveSelection = useCallback((delta: number) => {
    if (filtered.length === 0) return;
    const idx = filtered.findIndex(e => e.targetIpv6 === selected);
    const next = idx < 0
      ? 0
      : Math.max(0, Math.min(filtered.length - 1, idx + delta));
    setSelected(filtered[next].targetIpv6);
  }, [filtered, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveSelection]);

  const handleCopy = useCallback(async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.password);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1200);
    } catch { /* ignore */ }
  }, [current]);

  const handleDelete = useCallback(async () => {
    if (!current) return;
    if (!window.confirm(`Delete stored password for ${current.targetIpv6}?`)) return;
    try {
      await del(`/passwords/${encodeURIComponent(current.targetIpv6)}`);
      await load();
    } catch { /* ignore */ }
  }, [current, del, load]);

  const recencyChips: { id: RecencyFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
  ];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      tabIndex={0}
    >
      <div style={{
        padding: '6px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
          PASSWORD VAULT
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
          {filtered.length} / {entries.length} entries
        </span>
      </div>

      <div style={{ padding: '6px 8px', display: 'flex', gap: '6px', flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search ipv6 or password…  (/)"
            value={searchRaw}
            onChange={e => setSearchRaw(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 24px 5px 8px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-panel-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {searchRaw && (
            <button
              type="button"
              onClick={() => setSearchRaw('')}
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '0 4px',
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortMode)}
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-panel-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            padding: '4px 6px',
          }}
        >
          <option value="recent">Recently updated</option>
          <option value="oldest">Oldest first</option>
          <option value="address_asc">Address A–Z</option>
          <option value="address_desc">Address Z–A</option>
        </select>
      </div>

      <div style={{
        padding: '0 8px 6px',
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        {recencyChips.map(chip => (
          <button
            key={chip.id}
            type="button"
            className={`btn btn-sm ${recency === chip.id ? 'btn-primary' : ''}`}
            onClick={() => setRecency(chip.id)}
            style={{ fontSize: '8px', padding: '2px 6px', letterSpacing: '0.06em' }}
          >
            {chip.label}
          </button>
        ))}
        {dominantSubnet && (
          <button
            type="button"
            className={`btn btn-sm ${subnetFilter === dominantSubnet ? 'btn-primary' : ''}`}
            onClick={() => setSubnetFilter(
              subnetFilter === dominantSubnet ? null : dominantSubnet,
            )}
            style={{ fontSize: '8px', padding: '2px 6px', letterSpacing: '0.06em' }}
          >
            Subnet {dominantSubnet}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '1px' }}>
        <div
          ref={listRef}
          style={{
            width: '200px',
            flexShrink: 0,
            overflow: 'auto',
            borderRight: '1px solid var(--border)',
          }}
        >
          {loading ? (
            <div style={{ padding: '12px', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
              LOADING…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
              {entries.length === 0
                ? 'No passwords stored yet.\nCrack a server to auto-save.'
                : 'No matches for query.'}
            </div>
          ) : (
            filtered.map(entry => {
              const { prefix, suffix } = formatIpv6(entry.targetIpv6);
              const isSelected = entry.targetIpv6 === selected;
              const isConnected = connected === entry.targetIpv6.toLowerCase();
              return (
                <div
                  key={entry.targetIpv6}
                  onClick={() => setSelected(entry.targetIpv6)}
                  style={{
                    padding: '7px 8px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)44',
                    background: isSelected ? 'rgba(0,229,255,0.06)' : 'transparent',
                    borderLeft: isSelected
                      ? '2px solid var(--accent-cyan)'
                      : '2px solid transparent',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{ color: 'var(--accent-green)' }}>
                      {highlightMatch(prefix, search)}
                    </span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {highlightMatch(suffix, search)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '8px', color: 'var(--text-dim)' }}>
                      {formatRelativeTime(entry.lastUpdated)}
                    </span>
                    {isConnected && (
                      <span className="badge badge-ok" style={{ fontSize: '7px', padding: '1px 4px' }}>
                        LIVE
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px', overflow: 'hidden' }}>
          {current ? (
            <>
              <div style={{ marginBottom: '10px', flexShrink: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  TARGET
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {(() => {
                    const { prefix, suffix } = formatIpv6(current.targetIpv6);
                    return (
                      <>
                        <span style={{ color: 'var(--accent-green)' }}>{prefix}</span>
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{suffix}</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div style={{ marginBottom: '10px', flexShrink: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  PASSWORD
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text-bright)',
                    letterSpacing: '0.08em',
                  }}>
                    {current.password}
                  </code>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleCopy}
                    style={{ fontSize: '8px' }}
                  >
                    {copyFlash ? 'COPIED' : 'COPY'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  UPDATED
                </div>
                <span
                  style={{ fontSize: '10px', color: 'var(--text-muted)' }}
                  title={new Date(current.lastUpdated).toISOString()}
                >
                  {formatRelativeTime(current.lastUpdated)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onConnect?.(current.targetIpv6)}
                  disabled={connected === current.targetIpv6.toLowerCase()}
                  style={{ flex: 1 }}
                >
                  {connected === current.targetIpv6.toLowerCase() ? 'CONNECTED' : 'CONNECT'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleDelete}
                >
                  DELETE
                </button>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dim)',
              fontSize: '11px',
              letterSpacing: '0.08em',
            }}>
              SELECT ENTRY
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
