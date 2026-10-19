import type { SetupWorker } from 'msw/browser';

let worker: Promise<SetupWorker> | undefined;

/**
 * One Mock Service Worker for the whole Storybook session (also used by the Vitest browser run).
 * `mockServiceWorker.js` is served from .storybook/public (generated with `npx msw init`).
 */
export function getWorker(): Promise<SetupWorker> {
  worker ??= (async () => {
    const { setupWorker } = await import('msw/browser');
    // Anything without a handler (fixtures, assets, HMR) goes straight to the Storybook server.
    const instance = setupWorker();
    await instance.start({
      quiet: true,
      onUnhandledFrame: 'bypass',
      serviceWorker: { url: new URL('mockServiceWorker.js', document.baseURI).href },
    });
    return instance;
  })();
  return worker;
}
