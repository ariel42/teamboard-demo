const DAY_MS = 86_400_000;

/** Locale for formatting: the document language (set to "he" in RTL mode), else English. */
export function getLocale(): string {
  return (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
}

/** Whole calendar days from `now`'s local date to the "YYYY-MM-DD" date (negative = past). */
export function daysUntil(dueDate: string, now: Date = new Date()): number {
  const [y, m, d] = dueDate.split('-').map(Number) as [number, number, number];
  const due = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / DAY_MS);
}

export type DueStatus = 'overdue' | 'today' | 'soon' | 'later';

export interface DueInfo {
  text: string;
  status: DueStatus;
  days: number;
}

function shortDate(dueDate: string, now: Date, locale: string): string {
  const [y, m, d] = dueDate.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(y !== now.getFullYear() ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date);
}

/** Relative text for a due date ("today", "in 3 days", "2 days ago", "Nov 6") and its urgency. */
export function formatDueDate(
  dueDate: string,
  now: Date = new Date(),
  locale = getLocale(),
): DueInfo {
  const days = daysUntil(dueDate, now);
  const status: DueStatus =
    days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : 'later';
  const text =
    Math.abs(days) <= 7
      ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day')
      : shortDate(dueDate, now, locale);
  return { text, status, days };
}

/** "5 minutes ago", "yesterday", or a short date for anything older than a week. */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
  locale = getLocale(),
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 45 * 60) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 22 * 3600) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(seconds / 86_400), 'day');
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(new Date(then).getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(then);
}
