import type { StorybookConfig } from '@storybook/react-vite';
import { fixturesPlugin } from './fixtures-plugin.ts';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  staticDirs: ['./public'],
  core: { disableTelemetry: true },
  typescript: { reactDocgen: 'react-docgen-typescript' },
  async viteFinal(viteConfig, { configType }) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(viteConfig, {
      // Reachable from other machines and behind reverse proxies, like the app itself.
      server: { host: true, allowedHosts: true },
      preview: { host: true, allowedHosts: true },
      plugins: [fixturesPlugin(configType === 'PRODUCTION' ? 'build' : 'serve')],
    });
  },
};

export default config;
