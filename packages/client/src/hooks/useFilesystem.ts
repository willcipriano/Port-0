import { useCallback, useEffect, useState } from 'react';
import type { FsNode, FsTreeResponse, FsTypeBreakdownEntry } from '@port0/shared';
import { useApi } from './useApi';

export type { FsNode, FsTreeResponse, FsTypeBreakdownEntry };

export function useFilesystem(accountId: string) {
  const { get, post } = useApi(accountId);
  const [tree, setTree] = useState<FsTreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await get<FsTreeResponse>('/filesystem');
      setTree(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filesystem');
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    load();
  }, [load]);

  const mkdir = useCallback(
    async (path: string) => {
      await post('/filesystem/mkdir', { path });
      await load();
    },
    [post, load],
  );

  const move = useCallback(
    async (from: string, to: string) => {
      await post('/filesystem/move', { from, to });
      await load();
    },
    [post, load],
  );

  const rename = useCallback(
    async (path: string, name: string) => {
      await post('/filesystem/rename', { path, name });
      await load();
    },
    [post, load],
  );

  const trash = useCallback(
    async (path: string) => {
      await post('/filesystem/trash', { path });
      await load();
    },
    [post, load],
  );

  const restore = useCallback(
    async (path: string) => {
      await post('/filesystem/restore', { path });
      await load();
    },
    [post, load],
  );

  const run = useCallback(
    async (path: string) => {
      const res = await post<{ toolId: string; node: FsNode }>('/filesystem/run', { path });
      return res;
    },
    [post],
  );

  return {
    nodes: tree?.nodes ?? [],
    usedQgb: tree?.usedQgb ?? 0,
    capacityQgb: tree?.capacityQgb ?? 0,
    breakdown: tree?.breakdown ?? [],
    loading,
    error,
    load,
    mkdir,
    move,
    rename,
    trash,
    restore,
    run,
  };
}
