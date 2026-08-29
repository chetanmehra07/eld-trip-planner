import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API calls to /api are proxied to the Django server so no
// VITE_API_URL is needed. In production set VITE_API_URL to the API origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
