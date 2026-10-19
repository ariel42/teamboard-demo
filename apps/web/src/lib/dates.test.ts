import { describe, expect, it } from 'vitest';
import { daysUntil, formatDueDate, formatRelativeTime } from './dates';

const now = new Date(2026, 9, 19, 15, 30); // 19 Oct 2026, local time

describe('daysUntil', () => {
  it('counts calendar days regardless of time of day', () => {
    expect(daysUntil('2026-10-19', now)).toBe(0);
    expect(daysUntil('2026-10-20', now)).toBe(1);
    expect(daysUntil('2026-10-16', now)).toBe(-3);
    expect(daysUntil('2026-11-19', now)).toBe(31);
  });
});

describe('formatDueDate', () => {
  it('uses relative words close to today', () => {
    expect(formatDueDate('2026-10-19', now, 'en')).toMatchObject({
      text: 'today',
      status: 'today',
    });
    expect(formatDueDate('2026-10-20', now, 'en')).toMatchObject({
      text: 'tomorrow',
      status: 'soon',
    });
    expect(formatDueDate('2026-10-22', now, 'en')).toMatchObject({
      text: 'in 3 days',
      status: 'soon',
    });
    expect(formatDueDate('2026-10-23', now, 'en')).toMatchObject({
      text: 'in 4 days',
      status: 'later',
    });
  });

  it('marks past dates overdue', () => {
    expect(formatDueDate('2026-10-18', now, 'en')).toMatchObject({
      text: 'yesterday',
      status: 'overdue',
    });
    expect(formatDueDate('2026-10-16', now, 'en')).toMatchObject({
      text: '3 days ago',
      status: 'overdue',
    });
  });

  it('falls back to a short date beyond a week, adding the year for other years', () => {
    expect(formatDueDate('2026-11-06', now, 'en').text).toBe('Nov 6');
    expect(formatDueDate('2027-01-05', now, 'en').text).toBe('Jan 5, 2027');
  });

  it('localizes for Hebrew', () => {
    expect(formatDueDate('2026-10-22', now, 'he').text).not.toBe('in 3 days');
  });
});

describe('formatRelativeTime', () => {
  const at = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it('formats recent times', () => {
    expect(formatRelativeTime(at(10_000), now, 'en')).toBe('now');
    expect(formatRelativeTime(at(5 * 60_000), now, 'en')).toBe('5 minutes ago');
    expect(formatRelativeTime(at(3 * 3_600_000), now, 'en')).toBe('3 hours ago');
    expect(formatRelativeTime(at(86_400_000 * 2), now, 'en')).toBe('2 days ago');
  });
  it('uses a short date after a week and tolerates garbage', () => {
    expect(formatRelativeTime(at(86_400_000 * 20), now, 'en')).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    expect(formatRelativeTime('nope', now, 'en')).toBe('');
  });
});
