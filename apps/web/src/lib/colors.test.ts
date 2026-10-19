import { describe, expect, it } from 'vitest';
import { contrastRatio, initialsOf, labelHue, readableTextColor } from './colors';

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#6366f1', '#6366f1')).toBeCloseTo(1, 5);
  });
});

describe('readableTextColor', () => {
  it('picks white on dark and near-black on light backgrounds', () => {
    expect(readableTextColor('#1e1b4b')).toBe('#ffffff');
    expect(readableTextColor('#fde68a')).toBe('#10131a');
  });
  it('always reaches AA for the avatar colors used by the seed data', () => {
    for (const bg of ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444']) {
      expect(contrastRatio(bg, readableTextColor(bg))).toBeGreaterThanOrEqual(3);
    }
  });
  it('falls back to white for non-hex input', () => {
    expect(readableTextColor('red')).toBe('#ffffff');
  });
});

describe('labelHue', () => {
  it('is stable and case-insensitive', () => {
    expect(labelHue('Backend')).toBe(labelHue(' backend '));
    expect(labelHue('backend')).toBe(labelHue('backend'));
  });
  it('stays within the curated hue range', () => {
    for (const l of ['a', 'bug', 'frontend', 'i18n', 'ללא']) {
      expect(labelHue(l)).toBeGreaterThanOrEqual(0);
      expect(labelHue(l)).toBeLessThan(360);
    }
  });
});

describe('initialsOf', () => {
  it('uses first and last name', () => {
    expect(initialsOf('Maya Chen')).toBe('MC');
    expect(initialsOf('  dana  l  oren ')).toBe('DO');
    expect(initialsOf('Plato')).toBe('P');
    expect(initialsOf('   ')).toBe('?');
  });
});
