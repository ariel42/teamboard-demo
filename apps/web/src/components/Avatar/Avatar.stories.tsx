import type { Meta, StoryObj } from '@storybook/react-vite';
import { SAMPLE_USERS } from '../../stories/support/sample';
import { Avatar, AvatarGroup } from './Avatar';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  args: { name: 'Maya Chen', color: '#6366f1', size: 'md' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
    color: { control: 'color' },
  },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </div>
  ),
};
/** Pale and dark backgrounds: the text color flips so contrast stays readable. */
export const ContrastAdaptive: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      {['#fde68a', '#fecaca', '#1e293b', '#6366f1', '#0f766e'].map((color) => (
        <Avatar key={color} name="Daniel Okafor" color={color} />
      ))}
    </div>
  ),
};
export const Decorative: Story = {
  args: { decorative: true },
  parameters: {
    docs: {
      description: { story: 'Hidden from assistive tech when the name is shown beside it.' },
    },
  },
};
export const HebrewName: Story = { args: { name: 'נועה לוי' } };

export const Group: StoryObj<typeof AvatarGroup> = {
  render: (args) => <AvatarGroup {...args} />,
  args: { users: SAMPLE_USERS.slice(0, 3), max: 3, size: 'sm' },
};
export const GroupOverflow: StoryObj<typeof AvatarGroup> = {
  render: (args) => <AvatarGroup {...args} />,
  args: { users: SAMPLE_USERS, max: 3, size: 'md' },
};
