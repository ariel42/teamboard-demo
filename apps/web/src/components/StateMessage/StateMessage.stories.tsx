import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StateMessage } from './StateMessage';

const meta = {
  title: 'Components/StateMessage',
  component: StateMessage,
  args: { variant: 'empty', title: 'No boards yet', description: 'Create a board to get started.' },
  argTypes: { variant: { control: 'inline-radio', options: ['empty', 'error'] } },
} satisfies Meta<typeof StateMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const ErrorState: Story = {
  args: {
    variant: 'error',
    title: 'Could not load the board',
    description: 'The database is not responding.',
  },
};
export const ErrorWithRetry: Story = {
  args: { ...ErrorState.args, onRetry: fn() },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Try again' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
export const CustomRetryLabel: Story = {
  args: { ...ErrorState.args, onRetry: fn(), retryLabel: 'Reload' },
};
