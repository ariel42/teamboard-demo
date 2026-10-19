export type Direction = 'ltr' | 'rtl';

/**
 * Direction for the document: `?dir=rtl` in the URL wins, then a `data-dir` attribute on <html>
 * (handy for tests), otherwise left-to-right.
 */
export function resolveDirection(search: string, dataDir: string | null): Direction {
  const fromQuery = new URLSearchParams(search).get('dir');
  const value = fromQuery ?? dataDir;
  return value === 'rtl' ? 'rtl' : 'ltr';
}

/** Applies `dir` and `lang` (Hebrew for RTL) to the root element. */
export function applyDirection(
  search: string = window.location.search,
  root: HTMLElement = document.documentElement,
): Direction {
  const dir = resolveDirection(search, root.getAttribute('data-dir'));
  root.setAttribute('dir', dir);
  root.setAttribute('lang', dir === 'rtl' ? 'he' : 'en');
  return dir;
}
