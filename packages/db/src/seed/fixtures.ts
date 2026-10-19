import type { BoardPayload, Priority } from '../types.ts';
import { PRIORITIES } from '../types.ts';
import { toPayload } from './model.ts';
import type { SeedBoard, SeedCard } from './model.ts';
import { TEAM } from './people.ts';
import { createRng } from './rng.ts';
import { TYPICAL_BOARD } from './typical.ts';

export interface Fixture {
  name: string;
  description: string;
  data: BoardPayload;
}

// ---- empty ------------------------------------------------------------------------------------

const EMPTY_BOARD: SeedBoard = {
  name: 'Sprint 25',
  description: 'Planning has not started yet. Add the first card to get going.',
  users: TEAM,
  columns: [
    { name: 'Backlog', cards: [] },
    { name: 'In Progress', cards: [] },
    { name: 'Review', cards: [] },
    { name: 'Done', cards: [] },
  ],
};

// ---- overloaded -------------------------------------------------------------------------------

const VERBS = ['Fix', 'Add', 'Refactor', 'Investigate', 'Update', 'Remove', 'Document', 'Optimize'];
const NOUNS = [
  'login redirect loop',
  'invoice PDF layout',
  'search index rebuild',
  'rate limiter config',
  'onboarding checklist',
  'notification preferences',
  'CSV import validation',
  'dashboard loading state',
  'password reset email',
  'webhook signature check',
  'audit log export',
  'billing address form',
  'mobile navigation drawer',
  'cache invalidation rules',
  'timezone handling in reports',
  'team permissions matrix',
  'file upload progress bar',
  'dark mode icon set',
  'API pagination cursor',
  'background job retries',
];
const LABELS = ['bug', 'design', 'backend', 'frontend', 'infrastructure', 'testing', 'docs'];

function overloadedBoard(): SeedBoard {
  const rng = createRng(24);
  const sizes: [string, number][] = [
    ['Backlog', 34],
    ['In Progress', 58],
    ['Review', 14],
    ['Done', 16],
  ];
  let n = 100;
  return {
    name: 'Launch week',
    description: 'Everything is on fire the week before launch. Far too much work in progress.',
    users: TEAM,
    columns: sizes.map(([name, count]) => ({
      name,
      cards: Array.from({ length: count }, (): SeedCard => {
        n += 1;
        const labelCount = rng.int(0, 3);
        return {
          title: `${rng.pick(VERBS)} ${rng.pick(NOUNS)}`,
          description: rng.chance(0.7)
            ? `TB-${n}: ${rng.pick(VERBS)} ${rng.pick(NOUNS)} before the release candidate is cut.`
            : '',
          assignee: rng.chance(0.85) ? rng.pick(TEAM).name : null,
          priority: rng.pick<Priority>(['low', 'medium', 'medium', 'high', 'urgent']),
          due: rng.chance(0.5) ? `2026-10-${String(rng.int(19, 31))}` : null,
          labels: Array.from(new Set(Array.from({ length: labelCount }, () => rng.pick(LABELS)))),
          commentCount: rng.chance(0.4) ? rng.int(1, 9) : 0,
        };
      }),
    })),
  };
}

// ---- long-text --------------------------------------------------------------------------------

const LONG_SENTENCE =
  'Investigate why the quarterly invoice export times out for customers with more than ten thousand line items when the billing address contains non-Latin characters';
const LONG_PARAGRAPH =
  'This ticket started as a small bug report from a single customer and has since grown into a cross-team investigation. We have verified the behavior in staging, captured traces from three different regions, and compared the output of the old and the new export pipelines line by line. So far the evidence points to a combination of an unbounded query, a serializer that buffers the entire response in memory, and a proxy timeout that nobody remembered configuring. ';

const LONG_TEXT_BOARD: SeedBoard = {
  name: 'Text stress test: a board whose name is deliberately much longer than any header should ever be',
  description: `${LONG_PARAGRAPH}${LONG_PARAGRAPH}`,
  users: [
    {
      name: 'Maximilian Alexander von Hohenzollern-Schwarzenberg',
      initials: 'MH',
      color: '#8b5cf6',
    },
    { name: 'Wolfeschlegelsteinhausenbergerdorff Jr.', initials: 'WJ', color: '#14b8a6' },
    { name: 'Maya Chen', initials: 'MC', color: '#6366f1' },
  ],
  columns: [
    {
      name: 'A column name that is far too long to fit in a header without wrapping or truncating',
      cards: [
        {
          title: `${LONG_SENTENCE}. ${LONG_SENTENCE}.`,
          description: [LONG_PARAGRAPH, LONG_PARAGRAPH, LONG_PARAGRAPH, LONG_PARAGRAPH]
            .map((p, i) => `Paragraph ${i + 1}. ${p.repeat(2)}`)
            .join('\n\n'),
          assignee: 'Maximilian Alexander von Hohenzollern-Schwarzenberg',
          priority: 'urgent',
          due: '2026-10-30',
          labels: [
            'customer-reported',
            'needs-investigation',
            'performance-regression-in-export-pipeline',
            'backend',
            'billing',
            'p1',
            'timeout',
            'proxy',
            'memory',
            'serializer',
            'regional',
            'follow-up',
          ],
          commentCount: 1280,
        },
        {
          title:
            'https://example.com/reports/quarterly/2026/q3/invoices/export?customer=acme&format=csv&include=all&timezone=Europe/Berlin&page=1&pageSize=10000#section-unbroken-url-without-spaces',
          description:
            'Unbroken strings such as https://example.com/a/really/long/path/that/never/contains/a/single/space/and/keeps/going/and/going/until/the/container/overflows/unless/it/wraps.json must not break the layout.',
          assignee: 'Wolfeschlegelsteinhausenbergerdorff Jr.',
          priority: 'high',
          labels: ['layout', 'overflow'],
          commentCount: 3,
        },
        {
          title: '🚀🔥 Launch day checklist ✅✅✅ 👩🏽‍💻👨‍👩‍👧‍👦 🇮🇱🇩🇪🇯🇵 🎉',
          description:
            'Emoji everywhere 🎉🎉🎉: 🧪 test the release, 📦 package it, 🚢 ship it, 🧹 clean up, 📣 announce it. Combined sequences: 👩🏽‍🚀 🏳️‍🌈 👨🏿‍🦱 ❤️‍🔥.',
          assignee: 'Maya Chen',
          priority: 'medium',
          due: '2026-11-01',
          labels: ['🚀 launch', '📣 comms'],
          commentCount: 12,
        },
      ],
    },
    {
      name: 'Short',
      cards: [
        { title: 'x', priority: 'low', commentCount: 0 },
        {
          title: 'Ünïcödé dïäcrïtîcs, 日本語のタイトル, and العربية mixed with English',
          description:
            'Mixed scripts: 日本語の説明文がここに入ります。Ελληνικά, Русский, हिन्दी, 한국어, and עברית all in one description.',
          assignee: 'Maya Chen',
          priority: 'medium',
          labels: ['i18n'],
          commentCount: 2,
        },
        {
          title: 'Title with\nan embedded newline and trailing spaces   ',
          description: `${'Line of text that goes on. '.repeat(40)}\n${'W'.repeat(400)}`,
          priority: 'high',
          commentCount: 99,
        },
      ],
    },
  ],
};

// ---- rtl-hebrew -------------------------------------------------------------------------------

const HEBREW_BOARD: SeedBoard = {
  name: 'ספרינט 24',
  description: 'שיפור חוויית התשלום והקשחת התשתית. ספרינט 24, 12 עד 23 באוקטובר.',
  users: [
    { name: 'נועה כהן', initials: 'נכ', color: '#6366f1' },
    { name: 'יונתן לוי', initials: 'יל', color: '#f59e0b' },
    { name: 'מיכל אברהם', initials: 'מא', color: '#10b981' },
    { name: 'אורי שפירא', initials: 'אש', color: '#ef4444' },
    { name: 'תמר ביטון', initials: 'תב', color: '#0ea5e9' },
  ],
  columns: [
    {
      name: 'לביצוע',
      cards: [
        {
          title: 'הוספת תמיכה ב-Apple Pay בתהליך התשלום',
          description:
            'יש להוסיף Apple Pay כאמצעי תשלום באתר. נדרש אימות סוחר ומסלול חלופי למקרה שהארנק אינו זמין.',
          priority: 'medium',
          labels: ['backend', 'תשלומים'],
        },
        {
          title: 'בדיקת ניגודיות צבעים במסכי ההגדרות',
          description:
            'להריץ בדיקת ניגודיות על כל מסכי ההגדרות ולרשום את הצירופים שאינם עומדים בתקן WCAG AA, כולל מצב כהה.',
          assignee: 'תמר ביטון',
          priority: 'low',
          due: '2026-11-06',
          labels: ['עיצוב', 'נגישות'],
        },
        {
          title: 'ייצוא הלוח לקובץ CSV',
          description: 'לאפשר הורדה של הלוח הנוכחי כקובץ CSV, שורה אחת לכל כרטיס.',
          priority: 'low',
          labels: ['פיצ׳ר'],
        },
      ],
    },
    {
      name: 'בתהליך',
      cards: [
        {
          title: 'עיצוב מחדש של כרטיס סיכום ההזמנה',
          description:
            'פריסה חדשה לסיכום ההזמנה: פריטים מתקפלים אחרי שלושה, והסכום הכולל נשאר צמוד לתחתית במובייל. הקישור ל-Figma נמצא בשרשור.',
          assignee: 'מיכל אברהם',
          priority: 'high',
          due: '2026-10-21',
          labels: ['עיצוב', 'frontend'],
          commentCount: 3,
        },
        {
          title: 'תיקון כפילות בשליחת webhook',
          description:
            'ספק התשלומים שולח ניסיונות חוזרים שיוצרים אירועי הזמנה כפולים. צריך להוסיף מפתח idempotency לכל משלוח ולהתעלם מחזרות בתוך 24 שעות.',
          assignee: 'יונתן לוי',
          priority: 'urgent',
          due: '2026-10-20',
          labels: ['באג', 'backend'],
          commentCount: 4,
        },
        {
          title: 'מעבר לאחסון סשנים ב-Redis',
          description:
            'להעביר את אחסון הסשנים מצומת Redis בודד לאשכול החדש. לתכנן חלון של כתיבה כפולה כדי שאף אחד לא יתנתק.',
          assignee: 'אורי שפירא',
          priority: 'medium',
          due: '2026-10-23',
          labels: ['תשתיות', 'backend'],
        },
      ],
    },
    {
      name: 'בבדיקה',
      cards: [
        {
          title: 'תרגום הודעות השגיאה בתהליך התשלום',
          description:
            'להעביר את הודעות השגיאה מהקוד לקובצי התרגום ולהוסיף גרמנית, צרפתית ועברית. הנוסח בעברית דורש בדיקה של דוברת שפת אם.',
          assignee: 'נועה כהן',
          priority: 'medium',
          due: '2026-10-22',
          labels: ['i18n', 'frontend'],
          commentCount: 2,
        },
        {
          title: 'טיפול בקופונים שפג תוקפם',
          description:
            'להציג הודעה ברורה ולהסיר את הקופון מהעגלה כשפג תוקפו, במקום הודעת שגיאה כללית.',
          assignee: 'נועה כהן',
          priority: 'high',
          due: '2026-10-21',
          labels: ['באג', 'frontend'],
          commentCount: 1,
        },
      ],
    },
    {
      name: 'הושלם',
      cards: [
        {
          title: 'הקמת בדיקות עשן עם Playwright לתהליך התשלום',
          description: 'מסלול תקין ומסלול כשל אחד, רצים ב-CI בכל בקשת מיזוג.',
          assignee: 'אורי שפירא',
          priority: 'medium',
          due: '2026-10-16',
          labels: ['בדיקות'],
        },
        {
          title: 'שדרוג סביבת הריצה ל-Node.js 24',
          description:
            'עדכון הגרסה ב-CI, בתמונות Docker ובכלי הפיתוח המקומיים. הוסרו שני דגלים שהוצאו משימוש.',
          assignee: 'יונתן לוי',
          priority: 'medium',
          due: '2026-10-15',
          labels: ['תשתיות'],
          commentCount: 2,
        },
        {
          title: 'תיקון גלישת טקסט בבורר התאריכים ב-Safari',
          description: 'חלון לוח השנה נחתך במסכים צרים ב-Safari 17.',
          assignee: 'תמר ביטון',
          priority: 'low',
          labels: ['באג', 'frontend'],
        },
        {
          title: 'כתיבת מסמך החלטות ארכיטקטורה (ADR) לפיצול שירות התמחור',
          description: 'מתעד למה התמחור הופך לשירות נפרד, אילו חלופות נפסלו ומהו מסלול המעבר.',
          assignee: 'נועה כהן',
          priority: 'low',
          labels: ['תיעוד'],
        },
      ],
    },
  ],
};

// ---- all-priorities ---------------------------------------------------------------------------

const DUE_BY_PRIORITY: Record<Priority, string> = {
  low: '2026-11-30',
  medium: '2026-10-30',
  high: '2026-10-22',
  urgent: '2026-10-18',
};

function allPrioritiesBoard(): SeedBoard {
  return {
    name: 'Priority showcase',
    description: 'One card for every combination of priority, due date and labels.',
    users: TEAM,
    columns: PRIORITIES.map((priority, i) => {
      const label = priority[0]!.toUpperCase() + priority.slice(1);
      const assignee = (n: number) => TEAM[(i + n) % TEAM.length]!.name;
      return {
        name: label,
        cards: [
          {
            title: `${label}: due date and labels`,
            description: 'Has a due date and two labels.',
            assignee: assignee(0),
            priority,
            due: DUE_BY_PRIORITY[priority],
            labels: ['bug', 'backend'],
            commentCount: 2,
          },
          {
            title: `${label}: due date only`,
            description: 'Has a due date but no labels.',
            assignee: assignee(1),
            priority,
            due: DUE_BY_PRIORITY[priority],
          },
          {
            title: `${label}: labels only`,
            description: 'Has labels but no due date.',
            assignee: assignee(2),
            priority,
            labels: ['design', 'frontend', 'accessibility'],
            commentCount: 1,
          },
          {
            title: `${label}: bare card, unassigned`,
            priority,
          },
        ],
      };
    }),
  };
}

// ---- registry ---------------------------------------------------------------------------------

export function buildFixtures(): Fixture[] {
  return [
    {
      name: 'typical',
      description: 'A normal mid-sprint board: 4 columns, 13 cards, 5 users, comments.',
      data: toPayload(TYPICAL_BOARD),
    },
    {
      name: 'empty',
      description: 'Columns without any cards.',
      data: toPayload(EMPTY_BOARD),
    },
    {
      name: 'overloaded',
      description: '120+ cards; the In Progress column is far beyond the WIP limit of 5.',
      data: toPayload(overloadedBoard()),
    },
    {
      name: 'long-text',
      description: 'Very long titles, descriptions, labels and names; unbroken strings; emoji.',
      data: toPayload(LONG_TEXT_BOARD),
    },
    {
      name: 'rtl-hebrew',
      description: 'Hebrew content with mixed Latin terms, for right-to-left layout checks.',
      data: toPayload(HEBREW_BOARD),
    },
    {
      name: 'all-priorities',
      description: 'Every priority, with and without due date, labels and assignee.',
      data: toPayload(allPrioritiesBoard()),
    },
  ];
}
