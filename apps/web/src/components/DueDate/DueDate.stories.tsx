import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXED_NOW } from '../../stories/support/sample';
import { DueDate } from './DueDate';

const meta = {
  title: 'Components/DueDate',
  component: DueDate,
  // "Today" is pinned to 2026-10-19 so the states below never drift.
  args: { dueDate: '2026-10-25', now: FIXED_NOW },
} satisfies Meta<typeof DueDate>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = { args: { dueDate: '2026-11-20' } };
export const DueSoon: Story = { args: { dueDate: '2026-10-20' } };
export const DueToday: Story = { args: { dueDate: '2026-10-19' } };
export const Overdue: Story = { args: { dueDate: '2026-10-10' } };
export const AllStates: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 16 }}>
      {['2026-10-10', '2026-10-19', '2026-10-21', '2026-12-01'].map((d) => (
        <DueDate key={d} {...args} dueDate={d} />
      ))}
    </div>
  ),
};
