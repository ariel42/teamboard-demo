import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { DEFAULT_FLAGS } from '../../lib/flags';
import type { BoardPayload } from '../../lib/types';
import { DEFAULT_DATA_SOURCE } from '../support/dataSource';
import type { LiveInfo } from '../support/fixtures';
import { PageHarness } from '../support/PageHarness';
import { StatefulBoard } from '../support/StatefulBoard';

/**
 * The toolbar "Data" switch. Fixtures (default) read mocks.fixtures. Live schema reads the same
 * scenario from the sb_app mirror (`npm run db:seed-storybook`) through the dev server endpoint
 * `/__fixtures-live/:name` and shows a small "Live: sb_app" badge. These stories only read.
 */
const meta = {
  title: 'Layout/Data source',
  parameters: { layout: 'centered', fixture: 'typical' },
  render: () => <p style={{ margin: 0 }}>Data source toolbar check.</p>,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** No global set: the default is "fixtures", nothing live is loaded and there is no badge. */
export const DefaultIsFixtures: Story = {
  play: async ({ globals, loaded, canvasElement }) => {
    await expect(DEFAULT_DATA_SOURCE).toBe('fixtures');
    await expect(globals.dataSource).toBe('fixtures');
    await expect(loaded.live).toBeUndefined();
    await expect(loaded.fixture).toBeDefined();
    await expect(within(document.body).queryByTestId('live-data-badge')).toBeNull();
    await expect(within(canvasElement).queryByText(/^Live/)).toBeNull();
  },
};

/** "Live schema" selected: the board is read from sb_app and the badge says so. */
export const LiveShowsBadge: Story = {
  globals: { dataSource: 'live' },
  play: async ({ globals, loaded }) => {
    await expect(globals.dataSource).toBe('live');
    const live = loaded.live as LiveInfo;
    await expect(live.state).toBe('ok');
    await expect(live.version).toMatch(/^[0-9a-f]{32}$/);
    const badge = await within(document.body).findByTestId('live-data-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveTextContent(/^Live: (t[0-9a-f]{8}_)?sb_app$/);
    await expect(badge).toHaveAttribute('data-state', 'ok');
  },
};

/** A composition fed from sb_app: the same Board, with the live payload in `loaded.fixture`. */
export const LiveBoard: StoryObj<typeof StatefulBoard> = {
  globals: { dataSource: 'live' },
  parameters: { layout: 'fullscreen' },
  args: { flags: DEFAULT_FLAGS, wipLimit: 5 },
  render: (args, { loaded }) => <StatefulBoard {...args} data={loaded.fixture as BoardPayload} />,
  play: async ({ canvasElement, loaded }) => {
    await expect((loaded.live as LiveInfo).state).toBe('ok');
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('region', { name: 'Backlog' })).toBeInTheDocument();
    await expect(await within(document.body).findByTestId('live-data-badge')).toHaveAttribute(
      'data-state',
      'ok',
    );
  },
};

/** A page story (MSW fake API) seeded from the live payload: the board id is the real sb_app id. */
export const LivePage: StoryObj<typeof PageHarness> = {
  globals: { dataSource: 'live' },
  parameters: { layout: 'fullscreen', mockApi: {} },
  render: (_args, { loaded }) => (
    <PageHarness path={`/boards/${(loaded.fixture as BoardPayload).board.id}`} />
  ),
  play: async ({ canvasElement, loaded }) => {
    const board = loaded.fixture as BoardPayload;
    await expect((loaded.live as LiveInfo).state).toBe('ok');
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1 })).toHaveTextContent(
      board.board.name,
    );
    await expect(await canvas.findByRole('region', { name: 'Backlog' })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(document.body).getByTestId('live-data-badge')).toHaveAttribute(
        'data-state',
        'ok',
      ),
    );
  },
};
