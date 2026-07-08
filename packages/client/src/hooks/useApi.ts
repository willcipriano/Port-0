import { useCallback } from 'react';

function authHeaders(accountId?: string): Record<string, string> {
  if (!accountId) return {};
  return { Authorization: `Bearer dev:${accountId}` };
}

export function useApi(accountId?: string) {
  const headers = authHeaders(accountId);

  const get = useCallback(async <T>(path: string): Promise<T> => {
    const res = await fetch(path, { headers });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }, [accountId]);

  const post = useCallback(async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }, [accountId]);

  const del = useCallback(async <T>(path: string): Promise<T> => {
    const res = await fetch(path, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }, [accountId]);

  return { get, post, del };
}
