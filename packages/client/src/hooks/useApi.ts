import { useCallback } from 'react';

export function useApi() {
  const get = useCallback(async <T>(path: string): Promise<T> => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }, []);

  const post = useCallback(async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }, []);

  return { get, post };
}
