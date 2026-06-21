import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { AppShell } from './components/AppShell';

export function App() {
  const { state, login, logout } = useAuth();

  if (state.phase === 'authed') {
    return <AppShell account={state.account} onLogout={logout} />;
  }

  return (
    <LoginPage
      onLogin={login}
      connecting={state.phase === 'connecting'}
      error={state.phase === 'error' ? state.message : undefined}
    />
  );
}
