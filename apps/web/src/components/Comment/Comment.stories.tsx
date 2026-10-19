import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXED_NOW, SAMPLE_USERS } from '../../stories/support/sample';
import { Comment } from './Comment';

const meta = {
  title: 'Components/Comment',
  component: Comment,
  args: {
    author: SAMPLE_USERS[0],
    body: 'Looks good to me, shipping it after the review.',
    createdAt: '2026-10-19T08:30:00',
    now: FIXED_NOW,
  },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Comment>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Long: Story = {
  args: {
    body: 'This change touches the settlement path, so please run the full regression suite before merging. '.repeat(
      4,
    ),
  },
};
export const UnbrokenString: Story = {
  args: {
    body: 'https://example.internal/a/very/long/url/that/has/no/spaces/and/must/not/overflow/the/comment/box/0123456789',
  },
};
export const Rtl: Story = {
  args: { author: SAMPLE_USERS[4], body: 'נראה לי טוב, אפשר למזג אחרי הביקורת.' },
  globals: { dir: 'rtl' },
};
