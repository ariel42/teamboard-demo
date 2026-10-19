import type { SeedBoard } from './model.ts';
import { TEAM } from './people.ts';

/** A realistic mid-sprint board: 4 columns, 13 cards, 5 users, comments. Also the starter board. */
export const TYPICAL_BOARD: SeedBoard = {
  name: 'Sprint 24',
  description: 'Checkout redesign and platform hardening. Sprint 24, Oct 12 to Oct 23.',
  users: TEAM,
  columns: [
    {
      name: 'Backlog',
      cards: [
        {
          title: 'Add Apple Pay to checkout',
          description:
            'Support Apple Pay as a payment method on web checkout. Needs merchant validation and a sensible fallback when the wallet is unavailable.',
          priority: 'medium',
          labels: ['backend', 'payments'],
        },
        {
          title: 'Audit color contrast on the settings pages',
          description:
            'Run the contrast checker over every settings screen and list the combinations below WCAG AA. Include dark mode.',
          assignee: 'Sofia Rossi',
          priority: 'low',
          due: '2026-11-06',
          labels: ['design', 'accessibility'],
        },
        {
          title: 'Export board as CSV',
          description: 'Let people download the current board as a CSV: one row per card.',
          priority: 'low',
          labels: ['feature'],
        },
      ],
    },
    {
      name: 'In Progress',
      cards: [
        {
          title: 'Redesign order summary card',
          description:
            'New layout for the order summary: line items collapse after three, totals stay pinned on mobile. Figma link is in the thread.',
          assignee: 'Sofia Rossi',
          priority: 'high',
          due: '2026-10-21',
          labels: ['design', 'frontend'],
          comments: [
            {
              author: 'Sofia Rossi',
              body: 'First pass is up in Figma. The pinned totals bar is the part I am least sure about.',
              at: '2026-10-14T10:12:00Z',
            },
            {
              author: 'Maya Chen',
              body: 'Love the collapsed line items. Can we keep the promo code field above the fold?',
              at: '2026-10-14T13:40:00Z',
            },
            {
              author: 'Sofia Rossi',
              body: 'Yes, moved it. Updated frames are in the same file.',
              at: '2026-10-15T08:05:00Z',
            },
          ],
        },
        {
          title: 'Fix duplicate webhook deliveries',
          description:
            'Payment provider retries are creating duplicate order events. Add an idempotency key per delivery and ignore repeats within 24h.',
          assignee: 'Daniel Okafor',
          priority: 'urgent',
          due: '2026-10-20',
          labels: ['bug', 'backend'],
          comments: [
            {
              author: 'Daniel Okafor',
              body: 'Reproduced locally. The provider retries after 5s when we answer slower than that, and we process both.',
              at: '2026-10-13T15:21:00Z',
            },
            {
              author: 'Lucas Meyer',
              body: 'Our p99 on that endpoint is around 7s during the nightly job, which explains the pattern.',
              at: '2026-10-13T16:02:00Z',
            },
            {
              author: 'Daniel Okafor',
              body: 'Going with an idempotency table plus moving the heavy work off the request path.',
              at: '2026-10-14T09:30:00Z',
            },
            {
              author: 'Priya Nair',
              body: 'Happy to review as soon as the migration is up.',
              at: '2026-10-14T09:48:00Z',
            },
          ],
        },
        {
          title: 'Migrate sessions to the Redis cluster',
          description:
            'Move session storage from the single Redis node to the new cluster. Plan a dual-write window so nobody gets logged out.',
          assignee: 'Lucas Meyer',
          priority: 'medium',
          due: '2026-10-23',
          labels: ['infrastructure', 'backend'],
        },
        {
          title: 'Add retry with backoff to the email worker',
          description:
            'Transient SMTP failures currently drop the message. Retry up to 5 times with exponential backoff and jitter.',
          assignee: 'Priya Nair',
          priority: 'medium',
          labels: ['backend'],
        },
      ],
    },
    {
      name: 'Review',
      cards: [
        {
          title: 'Localize checkout error messages',
          description:
            'Move the hard-coded checkout errors into the translation files and add German, French and Hebrew.',
          assignee: 'Priya Nair',
          priority: 'medium',
          due: '2026-10-22',
          labels: ['frontend', 'i18n'],
          comments: [
            {
              author: 'Priya Nair',
              body: 'All strings extracted. Hebrew still needs a native review before we ship.',
              at: '2026-10-16T11:15:00Z',
            },
            {
              author: 'Maya Chen',
              body: 'I asked Noa from support to read through the Hebrew copy tomorrow.',
              at: '2026-10-16T14:50:00Z',
            },
          ],
        },
        {
          title: 'Handle expired coupons gracefully',
          description:
            'Show a clear message and remove the coupon from the cart when it has expired, instead of a generic error.',
          assignee: 'Maya Chen',
          priority: 'high',
          due: '2026-10-21',
          labels: ['bug', 'frontend'],
          comments: [
            {
              author: 'Lucas Meyer',
              body: 'Tested with an expired and a not-yet-valid code. Both behave. One nit on the copy.',
              at: '2026-10-17T09:20:00Z',
            },
          ],
        },
      ],
    },
    {
      name: 'Done',
      cards: [
        {
          title: 'Set up Playwright smoke tests for checkout',
          description: 'Happy path plus one failure path, running in CI on every pull request.',
          assignee: 'Lucas Meyer',
          priority: 'medium',
          due: '2026-10-16',
          labels: ['testing'],
        },
        {
          title: 'Upgrade Node.js runtime to 24',
          description:
            'Bump the runtime in CI, Docker images and local tooling. Dropped two deprecated flags along the way.',
          assignee: 'Daniel Okafor',
          priority: 'medium',
          due: '2026-10-15',
          labels: ['infrastructure'],
          comments: [
            {
              author: 'Daniel Okafor',
              body: 'Rolled out to staging, no regressions in the last 48h.',
              at: '2026-10-15T16:00:00Z',
            },
            {
              author: 'Lucas Meyer',
              body: 'Production deploy went smoothly. Closing this out.',
              at: '2026-10-16T08:10:00Z',
            },
          ],
        },
        {
          title: 'Fix Safari date picker overflow',
          description: 'The calendar popup was clipped on narrow viewports in Safari 17.',
          assignee: 'Maya Chen',
          priority: 'low',
          labels: ['bug', 'frontend'],
        },
        {
          title: 'Write ADR for the pricing service split',
          description:
            'Documents why pricing becomes its own service, the alternatives we rejected, and the migration path.',
          assignee: 'Maya Chen',
          priority: 'low',
          labels: ['docs'],
        },
      ],
    },
  ],
};
