import { useEffect } from 'react';
import { applyDirection } from '../lib/direction';

/** Applies `dir`/`lang` on <html> from `?dir=rtl` (or a `data-dir` attribute). */
export function useDirection(search: string) {
  useEffect(() => {
    applyDirection(search);
  }, [search]);
}
