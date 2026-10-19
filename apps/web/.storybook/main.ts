import type { StorybookConfig } from '@storybook/react-vite';
import { fixturesPlugin } from './fixtures-plugin.ts';

function allowedHosts(): string[] {
  const extra = (process.env.STORYBOOK_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  return ['localhost', '127.0.0.1', '.yair.link', ...extra];
}

// Storybook's dev server lets only localhost pages embed it. Coder's browser VS Code embeds it from its own
// address (the Story Explorer preview), so there, and only there, the embedding check is relaxed.
const embeddedInBrowserIde = process.env.DEVENV_KIND === 'coder';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  staticDirs: ['./public'],
  // Host validation stays on. Besides localhost it accepts the reverse-proxy domains of the dev environments
  // (Coder serves apps as <app>--<agent>--<workspace>--<user>--coder.yair.link); add more with a comma list.
  core: { disableTelemetry: true, allowedHosts: allowedHosts() },
  security: { insecureRemoteIframeEmbed: embeddedInBrowserIde, insecureIframeMessaging: embeddedInBrowserIde },
  typescript: { reactDocgen: 'react-docgen-typescript' },
  async viteFinal(viteConfig, { configType }) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(viteConfig, {
      // Listens on localhost only; the dev environments reach it through their own proxies or port forwards.
      server: { allowedHosts: allowedHosts() },
      preview: { allowedHosts: allowedHosts() },
      plugins: [fixturesPlugin(configType === 'PRODUCTION' ? 'build' : 'serve')],
    });
  },
};

export default config;
