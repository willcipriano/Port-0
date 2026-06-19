import { MVP_SUBNET_PREFIX } from '@port0/shared';

export function App() {
  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', background: '#0a0a0a', color: '#33ff66', minHeight: '100vh' }}>
      <h1>Port 0</h1>
      <p>Client scaffold — Stage 6 adds flexlayout-react windowing.</p>
      <p>MVP subnet: {MVP_SUBNET_PREFIX}/64</p>
    </main>
  );
}
