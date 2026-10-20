import type { StorybookConfig } from '@storybook/react-vite';
import { fixturesPlugin } from './fixtures-plugin.ts';

function allowedHosts(): string[] {
  const extra = (process.env.STORYBOOK_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  return ['localhost', '127.0.0.1', '.yair.link', ...extra];
}

// Storybook's dev server lets only pages on localhost embed it, and it checks every ancestor frame. VS Code's
// Story Explorer preview sits inside a VS Code webview (vscode-webview:// on desktop, the editor's own address
// in Coder's browser VS Code), so that check blocks it. In the managed dev environments (DEVENV_KIND is set by
// mise, Dev Containers and Coder) the embedding check is relaxed; plain `npm run storybook` elsewhere keeps it.
const embeddedInIde = Boolean(process.env.DEVENV_KIND);

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  staticDirs: ['./public'],
  // Host validation stays on. Besides localhost it accepts the reverse-proxy domains of the dev environments
  // (Coder serves apps as <app>--<agent>--<workspace>--<user>--coder.yair.link); add more with a comma list.
  core: { disableTelemetry: true, allowedHosts: allowedHosts() },
  security: { insecureRemoteIframeEmbed: embeddedInIde, insecureIframeMessaging: embeddedInIde },
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
