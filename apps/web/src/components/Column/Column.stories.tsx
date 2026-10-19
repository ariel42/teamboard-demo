import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SAMPLE_USERS } from '../../stories/support/sample';
import type { Priority } from '../../lib/types';
import { TaskCard } from '../TaskCard/TaskCard';
import { Column } from './Column';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

const cards = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <TaskCard
      key={i}
      title={`Card ${i + 1}: ${['Fix login redirect', 'Review audit log', 'Update runbook', 'Rotate keys'][i % 4]}`}
      priority={PRIORITIES[i % 4] as Priority}
      labels={i % 3 === 0 ? ['backend'] : []}
      assignee={i % 2 === 0 ? SAMPLE_USERS[i % SAMPLE_USERS.length] : null}
      dueDate={i % 5 === 0 ? '2026-11-20' : null}
      commentCount={i % 4}
    />
  ));

const meta = {
  title: 'Compositions/Column',
  component: Column,
  args: { name: 'In progress', count: 3, wipLimit: 5, showWip: false, onAddCard: fn() },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Column>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { name: 'Done', count: 0 } };
export const Normal: Story = { args: { count: 3, children: cards(3) } };
export const AtWipLimit: Story = { args: { count: 5, showWip: true, children: cards(5) } };
export const OverWipLimit: Story = { args: { count: 7, showWip: true, children: cards(7) } };
/** 120 cards: the column keeps growing and the surrounding container scrolls. */
export const ManyCards: Story = {
  args: { count: 120, children: cards(120) },
  decorators: [
    (Story) => (
      <div
        style={{ blockSize: 520, overflowY: 'auto', paddingInlineEnd: 8 }}
        tabIndex={0}
        aria-label="Scrollable column area"
      >
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('column-count')).toHaveTextContent('120');
    await expect(canvas.getAllByText(/^Card \d+:/)).toHaveLength(120);
  },
};
export const Rtl: Story = {
  args: { name: 'בעבודה', count: 3, children: cards(3) },
  globals: { dir: 'rtl' },
};

export const AddCardFlow: Story = {
  args: { count: 0, name: 'Todo' },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('open the composer', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /add card/i }));
      await expect(canvas.getByRole('textbox', { name: 'Card title' })).toHaveFocus();
    });
    await step('submit a title', async () => {
      await userEvent.type(
        canvas.getByRole('textbox', { name: 'Card title' }),
        'Write the runbook{Enter}',
      );
      await expect(args.onAddCard).toHaveBeenCalledWith('Write the runbook');
    });
  },
};
