import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitsByWeekday } from './CommitsByWeekday';
import { withContainer } from '../../stories/decorators';
import { makeGitStatsAnalysis } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CommitsByWeekday',
  component: CommitsByWeekday,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitsByWeekday>;

export default meta;
type Story = StoryObj<typeof meta>;

const analysis = makeGitStatsAnalysis();

export const Default: Story = {
  args: { commitsByWeekday: analysis.commitsByWeekday },
};

export const WeekendWarrior: Story = {
  args: { commitsByWeekday: [85, 20, 25, 22, 18, 15, 90] },
};

export const EvenDistribution: Story = {
  args: { commitsByWeekday: [50, 52, 48, 55, 50, 53, 49] },
};
