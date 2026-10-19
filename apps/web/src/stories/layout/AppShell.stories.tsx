import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AppShell } from '../../components/AppShell/AppShell';
import { StatefulBoard } from '../support/StatefulBoard';
import type { FlagItem } from '../../lib/flags';
import type { ThemePreference } from '../../lib/theme';
import type { BoardPayload } from '../../lib/types';

const FLAGS: FlagItem[] = [
  { key: 'card_comments', label: 'Card comments', description: 'Comments on cards', enabled: true },
  { key: 'due_dates', label: 'Due dates', description: 'Show due dates', enabled: true },
  {
    key: 'wip_limits',
    label: 'WIP limits',
    description: 'Flag columns over the limit',
    enabled: false,
  },
  { key: 'compact_cards', label: 'Compact cards', description: 'Denser cards', enabled: false },
];

/**
 * The page frame around the real Board, rendered at three widths with the viewport toolbar
 * (`globals.viewport`). On narrow screens the secondary controls collapse behind a menu button.
 */
const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen', fixture: 'typical' },
  args: {
    boards: [{ id: 1, name: 'Payments squad' }],
    boardId: 1,
    onBoardChange: fn(),
    env: { kind: 'mise', user: 'Maya' },
    flags: FLAGS,
    onToggleFlag: fn(),
    theme: 'light' as ThemePreference,
    onThemeChange: fn(),
    children: null,
  },
  render: function Render(args, { loaded }) {
    const [theme, setTheme] = useState(args.theme);
    return (
      <AppShell {...args} theme={theme} onThemeChange={setTheme}>
        <StatefulBoard data={loaded.fixture as BoardPayload} />
      </AppShell>
    );
  },
} satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile375: Story = { globals: { viewport: { value: 'mobile', isRotated: false } } };
export const Tablet768: Story = { globals: { viewport: { value: 'tablet', isRotated: false } } };
export const Desktop1440: Story = { globals: { viewport: { value: 'desktop', isRotated: false } } };

export const MobileDarkRtl: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false }, theme: 'dark', dir: 'rtl' },
};

export const MobileMenu: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('the menu button opens the collapsed tools', async () => {
      const button = canvas.getByRole('button', { name: 'Open menu' });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(button);
      await expect(canvas.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
  },
};
