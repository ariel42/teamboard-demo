import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { DEFAULT_FLAGS } from '../../lib/flags';
import type { BoardPayload } from '../../lib/types';
import type { LiveInfo } from '../support/fixtures';
import { PageHarness } from '../support/PageHarness';
import { StatefulBoard } from '../support/StatefulBoard';

/**
 * Real-stack checks of the one data source: every `parameters.fixture` scenario is read from the
 * sb_ schemas (`npm run db:setup`) through the dev server endpoint `/__fixtures/:name`. They stay
 * out of the sidebar and Docs, but run under vitest; `npm run test:ui` seeds its own throwaway
 * `t<hex>_sb_` schemas for them.
 */
const meta = {
  title: 'Layout/Storybook data',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'centered', fixture: 'typical' },
  render: () => <p style={{ margin: 0 }}>Storybook data check.</p>,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The loader read the scenario from the database: a payload and the md5 version of that read. */
export const LoadsFromSb: Story = {
  play: async ({ loaded }) => {
    await expect(loaded.fixtureError).toBeUndefined();
    const board = (loaded.fixture as BoardPayload).board;
    // sb_ board names carry the mock marker, so nobody takes the rows for real app data.
    await expect(board.name).toMatch(/mock/);
    await expect((loaded.live as LiveInfo).version).toMatch(/^[0-9a-f]{32}$/);
  },
};

/** No badge and no data switch any more: nothing on the page announces a data source. */
export const NoBadge: Story = {
  play: async ({ globals }) => {
    await expect(globals.dataSource).toBeUndefined();
    await expect(within(document.body).queryByTestId('live-data-badge')).toBeNull();
    await expect(within(document.body).queryByText(/^Live/)).toBeNull();
  },
};

/** A composition fed from sb_app: the same Board, with the payload in `loaded.fixture`. */
export const SbBoard: StoryObj<typeof StatefulBoard> = {
  parameters: { layout: 'fullscreen' },
  args: { flags: DEFAULT_FLAGS, wipLimit: 5 },
  render: (args, { loaded }) => <StatefulBoard {...args} data={loaded.fixture as BoardPayload} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('region', { name: 'Backlog (mock)' })).toBeInTheDocument();
  },
};

/** A page story (MSW fake API) seeded from the sb_ payload: the board id is the real sb_app id. */
export const SbPage: StoryObj<typeof PageHarness> = {
  parameters: { layout: 'fullscreen', mockApi: {} },
  render: (_args, { loaded }) => (
    <PageHarness path={`/boards/${(loaded.fixture as BoardPayload).board.id}`} />
  ),
  play: async ({ canvasElement, loaded }) => {
    const board = loaded.fixture as BoardPayload;
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1 })).toHaveTextContent(
      board.board.name,
    );
    await expect(await canvas.findByRole('region', { name: 'Backlog (mock)' })).toBeInTheDocument();
  },
};
