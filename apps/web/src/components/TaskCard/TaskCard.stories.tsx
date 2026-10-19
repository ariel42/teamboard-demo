import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SAMPLE_USERS } from '../../stories/support/sample';
import { TaskCard } from './TaskCard';

const meta = {
  title: 'Components/TaskCard',
  component: TaskCard,
  args: {
    title: 'Migrate the payment ledger to the new schema',
    labels: ['backend', 'migration'],
    priority: 'high',
    assignee: SAMPLE_USERS[0],
    dueDate: '2026-11-20',
    commentCount: 3,
    onClick: fn(),
    role: 'button',
    tabIndex: 0,
  },
  argTypes: {
    priority: { control: 'inline-radio', options: ['low', 'medium', 'high', 'urgent'] },
  },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongText: Story = {
  args: {
    title:
      'Investigate why the nightly reconciliation job intermittently times out when the settlement file exceeds two gigabytes and the downstream audit service is also under load',
    labels: ['reconciliation', 'performance'],
  },
};
export const NoAssignee: Story = { args: { assignee: null, commentCount: 0, dueDate: null } };
export const Compact: Story = { args: { compact: true } };
export const Dragging: Story = {
  args: { dragging: true },
  parameters: {
    // The in-place ghost is deliberately faded (opacity 0.4) so it reads as a placeholder; the
    // full-contrast copy is the Overlay story. Only this rule is waived, only for this story.
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } },
  },
};
export const Overlay: Story = {
  args: { overlay: true },
  parameters: {
    docs: { description: { story: 'What the drag overlay shows while a card is carried.' } },
  },
};
export const Selected: Story = { args: { selected: true } };
export const ManyLabels: Story = {
  args: {
    labels: ['backend', 'frontend', 'security', 'tech-debt', 'docs', 'infra', 'ux', 'compliance'],
  },
};
export const Overdue: Story = { args: { dueDate: '2020-01-01', priority: 'urgent' } };
export const HebrewRtl: Story = {
  args: {
    title: 'לבדוק את תהליך ההתאמה הלילי ולתקן את הכשל בקובץ הסליקה',
    labels: ['דחוף', 'backend'],
  },
  globals: { dir: 'rtl' },
};
export const FlagsOff: Story = { args: { showDueDate: false, showComments: false } };

export const ClickReports: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(/Migrate the payment ledger/));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
