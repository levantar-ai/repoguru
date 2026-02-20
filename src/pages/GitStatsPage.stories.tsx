import type { Meta, StoryObj } from '@storybook/react-vite';
import { GitStatsPage } from './GitStatsPage';
import { withFullPage } from '../stories/decorators';

const meta = {
  title: 'Pages/GitStatsPage',
  component: GitStatsPage,
  decorators: [withFullPage()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GitStatsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onBack: () => {} },
};
