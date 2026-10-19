import type { Meta, StoryObj } from '@storybook/react-vite';
import { FIXED_NOW, SAMPLE_COMMENTS, SAMPLE_USERS } from '../../stories/support/sample';
import { CommentList } from './CommentList';

const meta = {
  title: 'Components/CommentList',
  component: CommentList,
  args: { comments: SAMPLE_COMMENTS, now: FIXED_NOW },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CommentList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithComments: Story = {};
export const Empty: Story = { args: { comments: [] } };
export const Loading: Story = { args: { comments: [], loading: true } };
export const ErrorState: Story = { args: { comments: [], error: 'Could not load comments.' } };
export const Long: Story = {
  args: {
    comments: Array.from({ length: 12 }, (_, i) => ({
      ...(SAMPLE_COMMENTS[i % 2] as (typeof SAMPLE_COMMENTS)[number]),
      id: i + 1,
      author: SAMPLE_USERS[i % SAMPLE_USERS.length] as (typeof SAMPLE_USERS)[number],
    })),
  },
};
export const Rtl: Story = {
  args: {
    comments: [
      {
        ...(SAMPLE_COMMENTS[0] as (typeof SAMPLE_COMMENTS)[number]),
        author: SAMPLE_USERS[4] as (typeof SAMPLE_USERS)[number],
        body: 'נראה לי טוב, אפשר למזג אחרי הביקורת.',
      },
    ],
  },
  globals: { dir: 'rtl' },
};
