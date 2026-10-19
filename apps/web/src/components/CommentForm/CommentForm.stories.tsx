import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CommentForm } from './CommentForm';

const meta = {
  title: 'Components/CommentForm',
  component: CommentForm,
  args: { onSubmit: fn(), author: { name: 'Maya Chen' } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CommentForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Submitting: Story = { args: { submitting: true } };
export const WithError: Story = { args: { error: 'Could not post the comment. Try again.' } };
export const Rtl: Story = { globals: { dir: 'rtl' } };

export const TypeAndSubmit: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    const send = canvas.getByRole('button', { name: 'Comment' });
    await step('the button is disabled until there is text', async () => {
      await expect(send).toBeDisabled();
    });
    await step('type a comment and submit', async () => {
      await userEvent.type(canvas.getByRole('textbox', { name: /add a comment/i }), '  Ship it  ');
      await userEvent.click(send);
      await expect(args.onSubmit).toHaveBeenCalledWith('Ship it');
    });
    await step('the field is cleared and focused again', async () => {
      const box = canvas.getByRole('textbox', { name: /add a comment/i });
      await expect(box).toHaveValue('');
      await expect(box).toHaveFocus();
    });
  },
};
