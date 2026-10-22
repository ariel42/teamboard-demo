import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { DEFAULT_DATA_SOURCE, LIVE_NOTICE_TEXT } from '../support/dataSource';

/**
 * The toolbar "Data" switch. Fixtures (default) read mocks.fixtures; Live schema is not built yet,
 * so it still shows fixtures and adds a small notice in the corner.
 */
const meta = {
  title: 'Layout/Data source',
  parameters: { layout: 'centered' },
  render: () => <p style={{ margin: 0 }}>Data source toolbar check.</p>,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** No global set: the default is "fixtures" and there is no notice. */
export const DefaultIsFixtures: Story = {
  play: async ({ globals, canvasElement }) => {
    await expect(DEFAULT_DATA_SOURCE).toBe('fixtures');
    await expect(globals.dataSource).toBe('fixtures');
    await expect(within(document.body).queryByTestId('live-data-notice')).toBeNull();
    await expect(within(canvasElement).queryByText(LIVE_NOTICE_TEXT)).toBeNull();
  },
};

/** "Live schema" selected: the notice appears. */
export const LiveShowsNotice: Story = {
  globals: { dataSource: 'live' },
  play: async ({ globals }) => {
    await expect(globals.dataSource).toBe('live');
    await expect(await within(document.body).findByText(LIVE_NOTICE_TEXT)).toBeVisible();
  },
};
