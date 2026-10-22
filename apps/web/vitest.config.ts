import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Two projects:
//   unit       jsdom, no browser. Needs the database only for liveEndpoint.test.ts. This is what `npm test` runs.
//   storybook  every story as a browser test in headless Chromium (needs the fixtures DB).
//              This is what `npm run test:ui` runs.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
          css: false,
          restoreMocks: true,
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
        // Pre-bundle everything stories import so Vite does not reload mid-run on a cold cache.
        optimizeDeps: {
          include: [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
            '@tanstack/react-query',
            '@fontsource-variable/inter',
            'lucide-react',
            'msw',
            'msw/browser',
            'react-router',
            'react/jsx-dev-runtime',
          ],
        },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
