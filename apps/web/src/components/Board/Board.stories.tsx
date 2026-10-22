import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DEFAULT_FLAGS } from '../../lib/flags';
import { StatefulBoard } from '../../stories/support/StatefulBoard';
import type { BoardPayload } from '../../lib/types';

/**
 * Every story here renders the same presentational Board with a different scenario of the
 * `sb_` schemas. The data comes from Postgres through the Storybook dev server (see "How we test
 * UI"), so editing a row in `sb_app` changes the story. Column names carry the "(mock)" marker.
 */
const meta = {
  title: 'Compositions/Board',
  component: StatefulBoard,
  parameters: { layout: 'fullscreen', fixture: 'typical' },
  args: { data: undefined as unknown as BoardPayload, flags: DEFAULT_FLAGS, wipLimit: 5 },
  render: (args, { loaded }) => <StatefulBoard {...args} data={loaded.fixture as BoardPayload} />,
} satisfies Meta<typeof StatefulBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Typical: Story = {};
export const Empty: Story = { parameters: { fixture: 'empty' } };
export const Overloaded: Story = {
  parameters: { fixture: 'overloaded' },
  args: { flags: { ...DEFAULT_FLAGS, wipLimits: true } },
};
export const LongText: Story = { parameters: { fixture: 'long-text' } };
export const RtlHebrew: Story = { parameters: { fixture: 'rtl-hebrew' }, globals: { dir: 'rtl' } };
export const AllPriorities: Story = { parameters: { fixture: 'all-priorities' } };

export const WipLimitsOn: Story = {
  args: { flags: { ...DEFAULT_FLAGS, wipLimits: true }, wipLimit: 3 },
};
export const CompactCards: Story = { args: { flags: { ...DEFAULT_FLAGS, compactCards: true } } };
export const NoCommentsNoDueDates: Story = {
  args: { flags: { ...DEFAULT_FLAGS, cardComments: false, dueDates: false } },
};
export const Dark: Story = { globals: { theme: 'dark' } };

export const KeyboardMove: Story = {
  args: { onMoveCard: fn() },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    const title = 'Add Apple Pay to checkout';
    const cardsIn = (column: string) =>
      within(canvas.getByRole('region', { name: column })).queryAllByTestId('task-card');
    const live = () => document.querySelector('[role="status"][aria-live="assertive"]');

    await step('focus the card and lift it with Space', async () => {
      const card = canvas.getByText(title).closest<HTMLElement>('[data-testid="task-card"]');
      await expect(card).not.toBeNull();
      card?.focus();
      await userEvent.keyboard(' ');
      await waitFor(() =>
        expect(live()).toHaveTextContent(`card ${title} is now in column Backlog (mock)`),
      );
    });
    await step('move it right with the arrow keys until it is over In Progress', async () => {
      // dnd-kit needs a second ArrowRight to leave the source column
      await waitFor(
        async () => {
          await userEvent.keyboard('{ArrowRight}');
          await expect(live()).toHaveTextContent(
            `card ${title} is now in column In Progress (mock)`,
          );
        },
        { timeout: 6000 },
      );
    });
    await step('drop it with Space', async () => {
      await userEvent.keyboard(' ');
      await waitFor(() =>
        expect(live()).toHaveTextContent(`Dropped card ${title} in column In Progress (mock)`),
      );
      await expect(cardsIn('In Progress (mock)').some((c) => c.textContent?.includes(title))).toBe(
        true,
      );
      await expect(cardsIn('Backlog (mock)').some((c) => c.textContent?.includes(title))).toBe(
        false,
      );
      await expect(args.onMoveCard).toHaveBeenCalledOnce();
    });
  },
};

export const AddCardInColumn: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const backlog = within(canvas.getByRole('region', { name: 'Backlog (mock)' }));
    await step('open the composer in Backlog and add a card', async () => {
      await userEvent.click(backlog.getByRole('button', { name: /add card/i }));
      await userEvent.type(
        backlog.getByRole('textbox', { name: 'Card title' }),
        'Write the runbook{Enter}',
      );
    });
    await step('the card appears and the count goes up', async () => {
      await expect(await backlog.findByText('Write the runbook')).toBeVisible();
      await expect(backlog.getByTestId('column-count')).toHaveTextContent('4');
    });
  },
};
