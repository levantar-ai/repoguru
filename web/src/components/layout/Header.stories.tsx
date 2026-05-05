import type { Meta, StoryObj } from '@storybook/react-vite';
import { Header } from './Header';
import { withAppContext } from '../../stories/decorators';

const meta = {
  title: 'Layout/Header',
  component: Header,
  decorators: [withAppContext()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onNavigate: () => {}, currentPage: 'home' },
};

export const GitStatsActive: Story = {
  args: { onNavigate: () => {}, currentPage: 'git-stats' },
};

export const CompareActive: Story = {
  args: { onNavigate: () => {}, currentPage: 'compare' },
};
