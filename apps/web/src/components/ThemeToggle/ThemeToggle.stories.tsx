import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { ThemePreference } from '../../lib/theme';
import { ThemeToggle } from './ThemeToggle';

const meta = {
  title: 'Components/ThemeToggle',
  component: ThemeToggle,
  args: { value: 'light', onChange: fn() },
  argTypes: { value: { control: 'inline-radio', options: ['light', 'dark', 'system'] } },
} satisfies Meta<typeof ThemeToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { args: { value: 'dark' } };
export const System: Story = { args: { value: 'system' } };

/** Controlled wrapper: choosing an option updates the selection. */
export const Interactive: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<ThemePreference>(args.value);
    return (
      <ThemeToggle
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Dark' }));
    await expect(args.onChange).toHaveBeenCalledWith('dark');
    await expect(canvas.getByRole('radio', { name: 'Dark' })).toBeChecked();
  },
};
