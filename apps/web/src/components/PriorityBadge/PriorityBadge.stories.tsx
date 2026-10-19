import type { Meta, StoryObj } from '@storybook/react-vite';
import { PriorityBadge } from './PriorityBadge';

const meta = {
  title: 'Components/PriorityBadge',
  component: PriorityBadge,
  args: { priority: 'medium' },
  argTypes: {
    priority: { control: 'inline-radio', options: ['low', 'medium', 'high', 'urgent'] },
  },
} satisfies Meta<typeof PriorityBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};
export const Low: Story = { args: { priority: 'low' } };
export const High: Story = { args: { priority: 'high' } };
export const Urgent: Story = { args: { priority: 'urgent' } };
export const IconOnly: Story = { args: { priority: 'urgent', iconOnly: true } };
export const AllPriorities: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
        <PriorityBadge key={p} priority={p} />
      ))}
    </div>
  ),
};
