export interface Flags {
  cardComments: boolean;
  dueDates: boolean;
  wipLimits: boolean;
  compactCards: boolean;
}

/** Used until /api/config has loaded (or if it fails): matches the seeded defaults. */
export const DEFAULT_FLAGS: Flags = {
  cardComments: true,
  dueDates: true,
  wipLimits: false,
  compactCards: false,
};

export function resolveFlags(flags: Record<string, boolean> | undefined): Flags {
  if (!flags) return DEFAULT_FLAGS;
  return {
    cardComments: flags.card_comments ?? DEFAULT_FLAGS.cardComments,
    dueDates: flags.due_dates ?? DEFAULT_FLAGS.dueDates,
    wipLimits: flags.wip_limits ?? DEFAULT_FLAGS.wipLimits,
    compactCards: flags.compact_cards ?? DEFAULT_FLAGS.compactCards,
  };
}

/** `settings.wip_limit` as a positive integer, or null when unset or invalid. */
export function resolveWipLimit(settings: Record<string, unknown> | undefined): number | null {
  const raw = settings?.wip_limit;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

export type WipState = 'ok' | 'at-limit' | 'over';

export function wipState(count: number, limit: number): WipState {
  if (count > limit) return 'over';
  if (count === limit) return 'at-limit';
  return 'ok';
}

export interface FlagItem {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

const FLAG_META: Record<string, { label: string; description: string }> = {
  card_comments: { label: 'Card comments', description: 'Show comments on cards.' },
  due_dates: { label: 'Due dates', description: 'Show and edit due dates.' },
  wip_limits: { label: 'WIP limits', description: 'Warn when a column holds too many cards.' },
  compact_cards: { label: 'Compact cards', description: 'Denser cards with fewer details.' },
};

const humanize = (key: string) => {
  const text = key.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Turns the config flag map into a stable, sorted list for the flags panel. */
export function toFlagItems(flags: Record<string, boolean> | undefined): FlagItem[] {
  return Object.entries(flags ?? {})
    .map(([key, enabled]) => ({
      key,
      enabled,
      label: FLAG_META[key]?.label ?? humanize(key),
      description: FLAG_META[key]?.description ?? '',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
