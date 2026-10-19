import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PageHarness } from '../support/PageHarness';
import type { BoardPayload } from '../../lib/types';

/**
 * The real app (routes, AppLayout, BoardPage, react-query) mounted in memory. Network calls are
 * answered by MSW from a stateful fake API built from the database fixture, so moves, new cards,
 * comments and flag changes all work. `parameters.mockApi` shapes that API per story.
 */
const meta = {
  title: 'Pages/BoardPage',
  component: PageHarness,
  parameters: { layout: 'fullscreen', fixture: 'typical', mockApi: {} },
  args: { path: '/boards/1' },
  render: (args, { loaded }) => {
    const id = (loaded.fixture as BoardPayload).board.id;
    return <PageHarness path={args.path.replace('/boards/1', `/boards/${id}`)} />;
  },
} satisfies Meta<typeof PageHarness>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1 })).toBeInTheDocument();
    await expect(await canvas.findByRole('region', { name: 'Backlog' })).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: { mockApi: { board: 'pending' } },
  play: async ({ canvasElement }) => {
    // the skeleton is the only thing on the page; there is no board heading yet
    await new Promise((r) => setTimeout(r, 300));
    await expect(within(canvasElement).queryByRole('heading', { level: 1 })).toBeNull();
  },
};

export const Empty: Story = { parameters: { fixture: 'empty' } };

export const Overloaded: Story = {
  parameters: { fixture: 'overloaded', mockApi: { flags: { wip_limits: true }, wipLimit: 3 } },
};

export const ErrorWithRetry: Story = {
  parameters: { mockApi: { board: 'error', recoverAfter: 1 } },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('the failure is explained', async () => {
      await expect(await canvas.findByText('Could not load the board')).toBeInTheDocument();
    });
    await step('Retry loads the board', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /retry|try again/i }));
      await expect(await canvas.findByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  },
};

export const CommentsOff: Story = { parameters: { mockApi: { flags: { card_comments: false } } } };
export const WipLimitsOn: Story = {
  parameters: { mockApi: { flags: { wip_limits: true }, wipLimit: 2 } },
};
export const CompactOn: Story = { parameters: { mockApi: { flags: { compact_cards: true } } } };
export const DueDatesOff: Story = { parameters: { mockApi: { flags: { due_dates: false } } } };
export const AllFlagsCombined: Story = {
  parameters: {
    mockApi: {
      flags: { card_comments: false, due_dates: false, wip_limits: true, compact_cards: true },
      wipLimit: 3,
    },
  },
  globals: { theme: 'dark' },
};
export const Rtl: Story = { parameters: { fixture: 'rtl-hebrew' }, globals: { dir: 'rtl' } };

export const AddCardThroughApi: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const backlog = await canvas.findByRole('region', { name: 'Backlog' });
    await step('add a card from the column', async () => {
      await userEvent.click(within(backlog).getByRole('button', { name: /add card/i }));
      await userEvent.type(within(backlog).getByRole('textbox'), 'Write the rollout plan{Enter}');
    });
    await step('the API accepted it and the board shows it', async () => {
      await waitFor(() =>
        expect(within(backlog).getByText('Write the rollout plan')).toBeInTheDocument(),
      );
    });
  },
};

export const OpenCardAndComment: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('open a card', async () => {
      const card = (await canvas.findAllByTestId('task-card'))[0] as HTMLElement;
      await userEvent.click(card);
    });
    const dialog = within(await within(document.body).findByRole('dialog'));
    await step('post a comment', async () => {
      await userEvent.type(
        await dialog.findByRole('textbox', { name: /add a comment/i }),
        'Ship it',
      );
      await userEvent.click(dialog.getByRole('button', { name: 'Comment' }));
    });
    await step('the comment appears in the thread', async () => {
      await waitFor(() => expect(dialog.getByText('Ship it')).toBeInTheDocument());
    });
  },
};

export const ToggleFlagInHeader: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1 });
    await step('turn compact cards on from the flags panel', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /flags/i }));
      await userEvent.click(canvas.getByRole('switch', { name: /compact cards/i }));
      await waitFor(() =>
        expect(canvas.getByRole('switch', { name: /compact cards/i })).toBeChecked(),
      );
    });
  },
};
