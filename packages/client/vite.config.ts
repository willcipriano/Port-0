import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3099',
      '/world': 'http://localhost:3099',
      '/machines': 'http://localhost:3099',
      '/scans': 'http://localhost:3099',
      '/fleet': 'http://localhost:3099',
      '/market': 'http://localhost:3099',
      '/passwords': 'http://localhost:3002',
      '/health': 'http://localhost:3099',
      '/session': {
        target: 'ws://localhost:3002',
        ws: true,
      },
    },
  },
});
