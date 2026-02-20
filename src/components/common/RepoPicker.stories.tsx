import type { Meta, StoryObj } from '@storybook/react-vite';
import { RepoPicker } from './RepoPicker';
import { withAppContext } from '../../stories/decorators';

const meta = {
  title: 'Common/RepoPicker',
  component: RepoPicker,
  decorators: [withAppContext()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RepoPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onSelect: () => {} },
};

export const Disabled: Story = {
  args: { onSelect: () => {}, disabled: true },
};
