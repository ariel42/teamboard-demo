import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The browser only ever talks to relative /api URLs. In dev (and preview) Vite proxies them to the
// API, so the app also works behind a reverse proxy on a subdomain.
// WEB_PORT / API_PORT only exist for machines where the defaults (5173 / 3000) are already taken.
const webPort = Number(process.env.WEB_PORT ?? 5173);
const proxy = { '/api': { target: `http://localhost:${process.env.API_PORT ?? 3000}` } };

export default defineConfig({
  plugins: [react()],
  server: { port: webPort, strictPort: true, host: true, allowedHosts: true, proxy },
  preview: { port: webPort, strictPort: true, host: true, allowedHosts: true, proxy },
});
