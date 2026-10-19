import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './Label';

const meta = {
  title: 'Components/Label',
  component: Label,
  args: { name: 'backend' },
  argTypes: { hue: { control: { type: 'range', min: 0, max: 360, step: 5 } } },
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const CustomHue: Story = { args: { name: 'urgent', hue: 15 } };
/** Without a hue, the color is derived from the name, so the same label always looks the same. */
export const StableColors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {['backend', 'frontend', 'bug', 'tech-debt', 'security', 'docs', 'infra', 'ux'].map((n) => (
        <Label key={n} name={n} />
      ))}
    </div>
  ),
};
export const LongName: Story = { args: { name: 'a-very-long-label-name-that-keeps-going' } };
export const Hebrew: Story = { args: { name: 'דחוף' } };
