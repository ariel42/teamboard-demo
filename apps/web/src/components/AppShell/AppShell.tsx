import { useState, type ReactNode } from 'react';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import type { FlagItem } from '../../lib/flags';
import type { ThemePreference } from '../../lib/theme';
import { Button } from '../Button/Button';
import { EnvChip } from '../EnvChip/EnvChip';
import { FeatureFlagsPanel } from '../FeatureFlagsPanel/FeatureFlagsPanel';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import './AppShell.css';

export interface AppShellProps {
  boards: { id: number; name: string }[];
  boardId: number | null;
  onBoardChange: (id: number) => void;
  env?: { kind: string; user: string };
  flags: FlagItem[];
  onToggleFlag: (key: string, enabled: boolean) => void;
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  children: ReactNode;
}

/**
 * Page frame: sticky header (brand, board switcher, env chip, flags, theme) and the main area.
 * On narrow screens the secondary controls collapse behind a menu button.
 */
export function AppShell({
  boards,
  boardId,
  onBoardChange,
  env,
  flags,
  onToggleFlag,
  theme,
  onThemeChange,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="tb-shell">
      <a className="tb-shell__skip" href="#main">
        Skip to board
      </a>
      <header className="tb-shell__header">
        <div className="tb-shell__bar">
          <span className="tb-shell__brand">
            <LayoutDashboard size={20} aria-hidden="true" />
            <span className="tb-shell__brand-text">Teamboard</span>
          </span>
          <div className="tb-shell__switcher">
            <label className="sr-only" htmlFor="tb-board-select">
              Board
            </label>
            <select
              id="tb-board-select"
              className="tb-shell__select"
              value={boardId ?? ''}
              disabled={boards.length === 0}
              onChange={(e) => onBoardChange(Number(e.target.value))}
            >
              {boardId === null && <option value="">Select a board</option>}
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            className="tb-shell__menu-button"
            variant="ghost"
            iconOnly
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="tb-shell-tools"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </Button>
          <div
            id="tb-shell-tools"
            className="tb-shell__tools"
            data-open={menuOpen ? 'true' : 'false'}
          >
            {env && <EnvChip kind={env.kind} user={env.user} />}
            <FeatureFlagsPanel flags={flags} onToggle={onToggleFlag} />
            <ThemeToggle value={theme} onChange={onThemeChange} />
          </div>
        </div>
      </header>
      <main id="main" className="tb-shell__main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
