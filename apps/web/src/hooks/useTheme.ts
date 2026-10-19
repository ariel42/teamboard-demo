import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  readThemePreference,
  storeThemePreference,
  type ThemePreference,
} from '../lib/theme';

/** Theme preference (light / dark / system), persisted in localStorage and mirrored to <html data-theme>. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const update = useCallback((next: ThemePreference) => {
    storeThemePreference(next);
    setPreference(next);
  }, []);

  return { preference, setPreference: update };
}
