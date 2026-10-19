import type { BoardPayloadCard, Comment, User } from '../../lib/types';

/** Static sample data for stories of pure-props components (no database involved). */
export const SAMPLE_USERS: User[] = [
  { id: 1, name: 'Maya Chen', initials: 'MC', color: '#6366f1' },
  { id: 2, name: 'Daniel Okafor', initials: 'DO', color: '#0ea5e9' },
  { id: 3, name: 'Priya Raman', initials: 'PR', color: '#f59e0b' },
  { id: 4, name: 'Lukas Weber', initials: 'LW', color: '#10b981' },
  { id: 5, name: 'Noa Levi', initials: 'NL', color: '#ec4899' },
];

/** A fixed "today" so date-dependent stories (overdue, soon) render the same on every run. */
export const FIXED_NOW = new Date(2026, 9, 19, 12, 0, 0);

export const SAMPLE_COMMENTS: Comment[] = [
  {
    id: 1,
    cardId: 1,
    authorId: 1,
    author: SAMPLE_USERS[0] as User,
    body: 'Looks good to me, shipping it after the review.',
    createdAt: '2026-10-18T08:30:00Z',
  },
  {
    id: 2,
    cardId: 1,
    authorId: 2,
    author: SAMPLE_USERS[1] as User,
    body: 'Can we split this into two smaller cards?',
    createdAt: '2026-10-19T07:45:00Z',
  },
];

/** A card as it appears in a board payload, for stories that need one without a fixture. */
export const SAMPLE_CARD: BoardPayloadCard = {
  id: 1,
  title: 'Add Apple Pay to checkout',
  description:
    'Support Apple Pay in the web checkout, behind a feature flag.\nCoordinate with the payments team.',
  assignee: SAMPLE_USERS[0] as User,
  priority: 'high',
  dueDate: '2026-11-20',
  labels: ['payments', 'frontend'],
  position: 0,
  commentCount: 2,
};
