import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save card', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete card' } };
export const Small: Story = { args: { variant: 'primary', size: 'sm' } };
export const Large: Story = { args: { variant: 'primary', size: 'lg' } };
export const WithIcon: Story = {
  args: { variant: 'primary', icon: <Plus size={16} aria-hidden="true" />, children: 'Add card' },
};
export const IconOnly: Story = {
  args: {
    iconOnly: true,
    variant: 'danger',
    'aria-label': 'Delete card',
    children: <Trash2 size={16} aria-hidden="true" />,
  },
};
export const Loading: Story = { args: { variant: 'primary', loading: true, children: 'Saving' } };
export const Disabled: Story = { args: { variant: 'primary', disabled: true } };

/** Every variant and size side by side, one place to check the whole button family. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
        <div key={variant} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <Button key={size} variant={variant} size={size}>
              {variant} {size}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const ClickCallsHandler: Story = {
  args: { variant: 'primary' },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save card' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const LoadingBlocksClicks: Story = {
  args: { variant: 'primary', loading: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
