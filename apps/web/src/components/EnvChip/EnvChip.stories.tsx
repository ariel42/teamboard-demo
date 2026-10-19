import type { Meta, StoryObj } from '@storybook/react-vite';
import { EnvChip } from './EnvChip';

const meta = {
  title: 'Components/EnvChip',
  component: EnvChip,
  args: { kind: 'mise', user: 'maya' },
  argTypes: { kind: { control: 'text' }, user: { control: 'text' } },
} satisfies Meta<typeof EnvChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mise: Story = {};
export const Devcontainer: Story = { args: { kind: 'devcontainer', user: 'daniel' } };
export const Coder: Story = { args: { kind: 'coder', user: 'priya' } };
/** An unknown environment kind still renders, with a stable hash-based accent. */
export const Unknown: Story = { args: { kind: 'sandbox-17', user: 'guest' } };
export const AllKinds: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <EnvChip kind="mise" user="maya" />
      <EnvChip kind="devcontainer" user="daniel" />
      <EnvChip kind="coder" user="priya" />
      <EnvChip kind="sandbox-17" user="guest" />
    </div>
  ),
};
