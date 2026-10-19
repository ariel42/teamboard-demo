import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '../../app/AppLayout';
import { BoardListRedirect } from '../../pages/BoardListRedirect/BoardListRedirect';
import { BoardPage } from '../../pages/BoardPage/BoardPage';

export interface PageHarnessProps {
  /** Initial URL, e.g. /boards/1 or /boards/1?card=3 */
  path: string;
}

/**
 * The real routes, layout and page of the app, mounted in memory so a story can start anywhere.
 * Same as App.tsx, except: MemoryRouter instead of BrowserRouter, and no query retries, so an
 * error state shows up at once instead of after two backoff delays.
 */
export function PageHarness({ path }: PageHarnessProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<BoardListRedirect />} />
            <Route path="boards/:boardId" element={<BoardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
