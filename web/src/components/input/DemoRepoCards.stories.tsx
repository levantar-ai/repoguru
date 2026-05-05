import type { Meta, StoryObj } from '@storybook/react-vite';
import { DemoRepoCards } from './DemoRepoCards';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Input/DemoRepoCards',
  component: DemoRepoCards,
  decorators: [withContainer()],
} satisfies Meta<typeof DemoRepoCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onSelect: () => {}, disabled: false },
};

export const Disabled: Story = {
  args: { onSelect: () => {}, disabled: true },
};
