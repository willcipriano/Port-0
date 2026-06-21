import { useState, useCallback } from 'react';

export interface Account {
  id: string;
  displayHandle: string;
  cryptoBalance: number;
  rigStats: { cpu: number; ram: number; storage: number; bandwidth: number };
  status: string;
}

type AuthState =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'authed'; account: Account }
  | { phase: 'error'; message: string };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ phase: 'idle' });

  const login = useCallback(async (handle: string, _password: string) => {
    setState({ phase: 'connecting' });
    // Simulate OAuth handshake delay
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    try {
      const res = await fetch('/auth/me');
      if (!res.ok) throw new Error('auth_failed');
      const account: Account = await res.json();
      account.displayHandle = handle || account.displayHandle;
      setState({ phase: 'authed', account });
    } catch {
      setState({ phase: 'error', message: 'CONNECTION REFUSED — check credentials' });
    }
  }, []);

  const logout = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, login, logout };
}
