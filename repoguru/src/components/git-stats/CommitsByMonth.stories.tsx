import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitsByMonth } from './CommitsByMonth';
import { withContainer } from '../../stories/decorators';
import { makeGitStatsAnalysis } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CommitsByMonth',
  component: CommitsByMonth,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitsByMonth>;

export default meta;
type Story = StoryObj<typeof meta>;

const analysis = makeGitStatsAnalysis();

export const Default: Story = {
  args: { commitsByMonth: analysis.commitsByMonth },
};

export const HighActivity: Story = {
  args: { commitsByMonth: [120, 135, 180, 145, 200, 175, 210, 195, 160, 140, 130, 155] },
};

export const LowActivity: Story = {
  args: { commitsByMonth: [2, 5, 3, 1, 4, 2, 6, 3, 2, 1, 3, 2] },
};
