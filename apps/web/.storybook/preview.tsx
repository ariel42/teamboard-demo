import type { Decorator, Preview } from '@storybook/react-vite';
import { mswLoader } from 'msw-storybook-addon/csf3';
import '@fontsource-variable/inter';
import '../src/styles/tokens.css';
import '../src/styles/global.css';
import { applyDirection } from '../src/lib/direction';
import { applyTheme, storeThemePreference } from '../src/lib/theme';
import { FixtureErrorPanel } from '../src/stories/support/FixtureErrorPanel';
import { fixtureLoader } from '../src/stories/support/fixtures';
import { createMockApi } from '../src/stories/support/mockApi';
import type { MockApiOptions } from '../src/stories/support/mockApi';
import { getWorker } from '../src/stories/support/msw';

/** Toolbar "Theme": writes data-theme on <html> (and the stored preference the app's hook reads). */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
  storeThemePreference(theme);
  applyTheme(theme);
  return <Story />;
};

/** Toolbar "Direction": writes dir + lang (Hebrew for RTL) on <html>. */
const withDirection: Decorator = (Story, context) => {
  const dir = context.globals.dir === 'rtl' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('data-dir', dir);
  applyDirection('');
  return <Story />;
};

/** Replaces the story with a clear panel when its database fixture could not be loaded. */
const withFixtureError: Decorator = (Story, context) => {
  const error = context.loaded.fixtureError as string | undefined;
  if (!error) return <Story />;
  // In the Vitest run a missing database must fail the test, not pass on a panel.
  if (import.meta.env.VITEST) throw new Error(error);
  return <FixtureErrorPanel message={error} />;
};

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      description: 'Color theme (sets data-theme on the document)',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    dir: {
      description: 'Text direction (sets dir and lang on the document)',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'Left to right (English)' },
          { value: 'rtl', title: 'Right to left (Hebrew)' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', dir: 'ltr' },
  decorators: [withFixtureError, withDirection, withTheme],
  loaders: [
    mswLoader(getWorker),
    // parameters.fixture = 'typical' loads that mocks.fixtures row into context.loaded.fixture
    async ({ parameters }) => {
      const name = parameters.fixture as string | undefined;
      return name ? await fixtureLoader(name) : {};
    },
  ],
  beforeEach: async ({ parameters, loaded }) => {
    // parameters.mockApi turns the fixture into a stateful fake API for the page under test
    const options = parameters.mockApi as Omit<MockApiOptions, 'fixture'> | undefined;
    const fixture = loaded?.fixture;
    if (!options || !fixture) return;
    const worker = await getWorker();
    worker.use(...createMockApi({ ...options, fixture }));
    return () => worker.resetHandlers();
  },
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: {
      // Fail the test on every violation. "region" is off because stories render one component in
      // isolation; "all content inside a landmark" only makes sense for a full page.
      test: 'error',
      config: { rules: [{ id: 'region', enabled: false }] },
    },
    viewport: {
      options: {
        mobile: {
          name: 'Mobile (375)',
          styles: { width: '375px', height: '812px' },
          type: 'mobile',
        },
        tablet: {
          name: 'Tablet (768)',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        desktop: {
          name: 'Desktop (1440)',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
    options: {
      storySort: {
        order: ['How we test UI', 'Components', 'Compositions', 'Layout', 'Pages'],
      },
    },
  },
};

export default preview;
