import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEFAULT_FLAGS } from '../../lib/flags';
import { StatefulBoard } from '../support/StatefulBoard';
import type { BoardPayload } from '../../lib/types';

const variants = [
  { label: 'Light', theme: 'light', dir: 'ltr', lang: 'en' },
  { label: 'Dark', theme: 'dark', dir: 'ltr', lang: 'en' },
  { label: 'Dark, right to left (Hebrew)', theme: 'dark', dir: 'rtl', lang: 'he' },
  { label: 'Light, right to left (Hebrew)', theme: 'light', dir: 'rtl', lang: 'he' },
] as const;

const panel: CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--text)',
  padding: 16,
  borderRadius: 12,
  border: '1px solid var(--border, #8884)',
  overflowX: 'auto',
};

/**
 * One board, side by side in every theme and direction. Each panel scopes its own `data-theme`,
 * `dir` and `lang`, so a regression in one combination is visible at a glance.
 */
const meta = {
  title: 'Layout/Gallery',
  parameters: {
    layout: 'fullscreen',
    fixture: 'typical',
    // Exception: this story deliberately repeats the same board four times, so the board and
    // column landmarks cannot have unique names. Every other rule still applies.
    a11y: {
      test: 'error',
      config: {
        rules: [
          { id: 'region', enabled: false },
          { id: 'landmark-unique', enabled: false },
        ],
      },
    },
  },
  render: (_args, { loaded }) => (
    <div style={{ display: 'grid', gap: 24, padding: 24 }}>
      {variants.map((v) => (
        <section key={v.label} aria-label={v.label}>
          <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>{v.label}</h2>
          <div data-theme={v.theme} dir={v.dir} lang={v.lang} style={panel}>
            <StatefulBoard
              data={loaded.fixture as BoardPayload}
              flags={{ ...DEFAULT_FLAGS, wipLimits: true }}
              wipLimit={3}
            />
          </div>
        </section>
      ))}
    </div>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ThemesAndDirections: Story = {};
export const RtlFixture: Story = { parameters: { fixture: 'rtl-hebrew' } };
