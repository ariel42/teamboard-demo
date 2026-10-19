import { afterEach, describe, expect, it } from 'vitest';
import { applyDirection, resolveDirection } from './direction';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  storeThemePreference,
} from './theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-dir');
  document.documentElement.removeAttribute('data-theme');
});

describe('direction', () => {
  it('?dir=rtl wins, then data-dir, else ltr', () => {
    expect(resolveDirection('?dir=rtl', null)).toBe('rtl');
    expect(resolveDirection('?dir=ltr', 'rtl')).toBe('ltr');
    expect(resolveDirection('', 'rtl')).toBe('rtl');
    expect(resolveDirection('?dir=weird', null)).toBe('ltr');
    expect(resolveDirection('', null)).toBe('ltr');
  });

  it('sets dir and lang on the root element', () => {
    expect(applyDirection('?dir=rtl')).toBe('rtl');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    document.documentElement.setAttribute('data-dir', 'ltr');
    applyDirection('');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
  });
});

describe('theme', () => {
  it('parses unknown values as system', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('purple')).toBe('system');
    expect(parseThemePreference(null)).toBe('system');
  });

  it('resolves system from the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('stores explicit choices and clears the key for system', () => {
    storeThemePreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readThemePreference()).toBe('dark');
    storeThemePreference('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readThemePreference()).toBe('system');
  });

  it('applies data-theme to the root', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
