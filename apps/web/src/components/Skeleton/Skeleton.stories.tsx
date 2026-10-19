import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoardSkeleton, Skeleton } from './Skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  args: { width: '240px', height: '20px' },
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};
export const Block: Story = { args: { width: '320px', height: '96px' } };
export const BoardPlaceholder: StoryObj<typeof BoardSkeleton> = {
  render: (args) => <BoardSkeleton {...args} />,
  args: { columns: 4 },
};
export const BoardPlaceholderThreeColumns: StoryObj<typeof BoardSkeleton> = {
  render: (args) => <BoardSkeleton {...args} />,
  args: { columns: 3 },
};
