import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { FlagItem } from '../../lib/flags';
import { FeatureFlagsPanel } from './FeatureFlagsPanel';

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

const meta = {
  title: 'Components/FeatureFlagsPanel',
  component: FeatureFlagsPanel,
  args: { flags: FLAGS, onToggle: fn() },
  // The popover is absolutely positioned; give it room in the docs page and the canvas.
  decorators: [
    (Story) => (
      <div style={{ minBlockSize: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeatureFlagsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
export const AllOn: Story = {
  args: { defaultOpen: true, flags: FLAGS.map((f) => ({ ...f, enabled: true })) },
};

export const ToggleAndEscape: Story = {
  render: function Render(args) {
    const [flags, setFlags] = useState(args.flags);
    return (
      <FeatureFlagsPanel
        flags={flags}
        onToggle={(key, enabled) => {
          args.onToggle(key, enabled);
          setFlags((all) => all.map((f) => (f.key === key ? { ...f, enabled } : f)));
        }}
      />
    );
  },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('open the panel', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /flags/i }));
      await expect(canvas.getByRole('switch', { name: /wip limits/i })).not.toBeChecked();
    });
    await step('turn WIP limits on', async () => {
      await userEvent.click(canvas.getByRole('switch', { name: /wip limits/i }));
      await expect(args.onToggle).toHaveBeenCalledWith('wip_limits', true);
      await expect(canvas.getByRole('switch', { name: /wip limits/i })).toBeChecked();
    });
    await step('Escape closes it and returns focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(canvas.queryByRole('switch')).not.toBeInTheDocument());
      await expect(canvas.getByRole('button', { name: /flags/i })).toHaveFocus();
    });
  },
};
