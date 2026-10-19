import { Outlet, useLocation, useMatch, useNavigate } from 'react-router';
import { useBoards } from '../hooks/useBoards';
import { useConfig, useSetFlag } from '../hooks/useConfig';
import { useDirection } from '../hooks/useDirection';
import { useTheme } from '../hooks/useTheme';
import { AppShell } from '../components/AppShell/AppShell';

/** Route layout: wires the shell (board switcher, env chip, flags, theme) to its data and hooks. */
export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const match = useMatch('/boards/:boardId');
  const boards = useBoards();
  const config = useConfig();
  const setFlag = useSetFlag();
  const { preference, setPreference } = useTheme();
  useDirection(location.search);

  const boardId = match?.params.boardId ? Number(match.params.boardId) : null;

  return (
    <AppShell
      boards={boards.data ?? []}
      boardId={boardId}
      onBoardChange={(id) => {
        // keep ?dir=... but drop the open card, which belongs to the previous board
        const search = new URLSearchParams(location.search);
        search.delete('card');
        const qs = search.toString();
        void navigate({ pathname: `/boards/${id}`, search: qs ? `?${qs}` : '' });
      }}
      env={config.env}
      flags={config.flagItems}
      onToggleFlag={(key, enabled) => setFlag.mutate({ key, enabled })}
      theme={preference}
      onThemeChange={setPreference}
    >
      <Outlet />
    </AppShell>
  );
}
