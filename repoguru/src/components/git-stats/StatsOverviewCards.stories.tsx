import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatsOverviewCards } from './StatsOverviewCards';
import { makeGitStatsAnalysis } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Git Stats/StatsOverviewCards',
  component: StatsOverviewCards,
  decorators: [withContainer(1000)],
} satisfies Meta<typeof StatsOverviewCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { analysis: makeGitStatsAnalysis() },
};

export const HighActivity: Story = {
  args: {
    analysis: makeGitStatsAnalysis({
      totalCommits: 5200,
      totalLinesOfCode: 250_000,
      repoAgeDays: 2500,
    }),
  },
};

export const NewRepo: Story = {
  args: {
    analysis: makeGitStatsAnalysis({
      totalCommits: 15,
      totalLinesOfCode: 1200,
      repoAgeDays: 14,
    }),
  },
};
