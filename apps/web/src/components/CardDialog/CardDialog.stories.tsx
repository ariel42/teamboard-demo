import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DEFAULT_FLAGS } from '../../lib/flags';
import { SAMPLE_CARD, SAMPLE_COMMENTS, SAMPLE_USERS } from '../../stories/support/sample';
import { CardDialog } from './CardDialog';

/** The dialog renders in a portal on document.body, so queries go through `within(document.body)`. */
const dialogOf = () => within(document.body).getByRole('dialog');

const meta = {
  title: 'Compositions/CardDialog',
  component: CardDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    card: SAMPLE_CARD,
    columnName: 'In Progress',
    users: SAMPLE_USERS,
    flags: DEFAULT_FLAGS,
    comments: SAMPLE_COMMENTS,
    commentAuthor: SAMPLE_USERS[0],
    onClose: fn(),
    onSave: fn(),
    onDelete: fn(),
    onAddComment: fn(),
  },
} satisfies Meta<typeof CardDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithComments: Story = {};
export const NoComments: Story = { args: { comments: [] } };
export const LoadingComments: Story = { args: { comments: [], commentsLoading: true } };
export const CommentsFailed: Story = {
  args: { comments: [], commentsError: 'Could not load comments.' },
};
export const CommentsOff: Story = { args: { flags: { ...DEFAULT_FLAGS, cardComments: false } } };
export const DueDatesOff: Story = { args: { flags: { ...DEFAULT_FLAGS, dueDates: false } } };
export const SaveFailed: Story = {
  args: { error: 'Could not save the card. The server said: title too long.' },
};
export const Saving: Story = { args: { saving: true } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const Rtl: Story = {
  args: {
    card: {
      ...SAMPLE_CARD,
      title: 'להוסיף תשלום ב-Apple Pay',
      description: 'לתאם עם צוות התשלומים.',
    },
    columnName: 'בעבודה',
  },
  globals: { dir: 'rtl' },
};

export const ValidationErrors: Story = {
  play: async ({ args, step }) => {
    const dialog = within(dialogOf());
    await step('clearing the required title disables saving', async () => {
      const title = dialog.getByRole('textbox', { name: 'Title' });
      await userEvent.clear(title);
      await expect(title).toBeRequired();
      await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });
    await step('whitespace only is still invalid', async () => {
      await userEvent.type(dialog.getByRole('textbox', { name: 'Title' }), '   ');
      await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      await expect(args.onSave).not.toHaveBeenCalled();
    });
    await step('a valid title enables saving and sends a trimmed patch', async () => {
      await userEvent.type(dialog.getByRole('textbox', { name: 'Title' }), ' Renamed ');
      await userEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
      await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Renamed' }));
    });
  },
};

export const FocusTrapAndEscape: Story = {
  play: async ({ args, step }) => {
    const dialogEl = dialogOf();
    const dialog = within(dialogEl);
    await step('focus starts on the title field', async () => {
      await waitFor(() => expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveFocus());
    });
    await step('Tab never leaves the dialog, even after a full lap', async () => {
      for (let i = 0; i < 30; i++) {
        await userEvent.tab();
        await expect(dialogEl).toContainElement(document.activeElement as HTMLElement);
      }
    });
    await step('Shift+Tab wraps backwards too', async () => {
      for (let i = 0; i < 5; i++) {
        await userEvent.tab({ shift: true });
        await expect(dialogEl).toContainElement(document.activeElement as HTMLElement);
      }
    });
    await step('Escape asks to close', async () => {
      await userEvent.keyboard('{Escape}');
      await expect(args.onClose).toHaveBeenCalled();
    });
  },
};

export const AddComment: Story = {
  play: async ({ args, step }) => {
    const dialog = within(dialogOf());
    await step('type a comment', async () => {
      await userEvent.type(dialog.getByRole('textbox', { name: /add a comment/i }), 'Looks good');
    });
    await step('submit with the Comment button', async () => {
      await userEvent.click(dialog.getByRole('button', { name: 'Comment' }));
      await expect(args.onAddComment).toHaveBeenCalledWith('Looks good');
    });
  },
};

export const DeleteNeedsConfirmation: Story = {
  play: async ({ args }) => {
    const dialog = within(dialogOf());
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await expect(args.onDelete).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: 'Yes, delete' }));
    await expect(args.onDelete).toHaveBeenCalledOnce();
  },
};
