import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAGS, resolveFlags, resolveWipLimit, toFlagItems, wipState } from './flags';

describe('resolveFlags', () => {
  it('maps API keys to camelCase flags', () => {
    expect(
      resolveFlags({
        card_comments: false,
        due_dates: false,
        wip_limits: true,
        compact_cards: true,
      }),
    ).toEqual({ cardComments: false, dueDates: false, wipLimits: true, compactCards: true });
  });
  it('falls back to defaults for missing flags or no config', () => {
    expect(resolveFlags(undefined)).toEqual(DEFAULT_FLAGS);
    expect(resolveFlags({ wip_limits: true })).toEqual({ ...DEFAULT_FLAGS, wipLimits: true });
  });
});

describe('resolveWipLimit', () => {
  it('accepts positive integers, also as strings', () => {
    expect(resolveWipLimit({ wip_limit: 3 })).toBe(3);
    expect(resolveWipLimit({ wip_limit: '5' })).toBe(5);
  });
  it('rejects everything else', () => {
    for (const bad of [0, -1, 2.5, 'x', null, undefined, {}]) {
      expect(resolveWipLimit({ wip_limit: bad })).toBeNull();
    }
    expect(resolveWipLimit(undefined)).toBeNull();
  });
});

describe('wipState', () => {
  it('is ok below, at-limit at, over above the limit', () => {
    expect(wipState(2, 3)).toBe('ok');
    expect(wipState(3, 3)).toBe('at-limit');
    expect(wipState(4, 3)).toBe('over');
  });
});

describe('toFlagItems', () => {
  it('labels known flags, humanizes unknown ones and sorts by label', () => {
    const items = toFlagItems({ wip_limits: true, beta_thing: false, card_comments: true });
    expect(items.map((i) => i.label)).toEqual(['Beta thing', 'Card comments', 'WIP limits']);
    expect(items[0]).toMatchObject({ key: 'beta_thing', enabled: false });
  });
  it('handles no flags', () => {
    expect(toFlagItems(undefined)).toEqual([]);
  });
});
