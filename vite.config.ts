import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

const useHttps = process.env.VITE_DEV_HTTPS !== 'false';

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    hmr: false,
    allowedHosts: true,
  },
});
