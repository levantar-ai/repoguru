import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitsByYear } from './CommitsByYear';
import { withContainer } from '../../stories/decorators';
import { makeGitStatsAnalysis } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CommitsByYear',
  component: CommitsByYear,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitsByYear>;

export default meta;
type Story = StoryObj<typeof meta>;

const analysis = makeGitStatsAnalysis();

export const Default: Story = {
  args: { commitsByYear: analysis.commitsByYear },
};

export const LongHistory: Story = {
  args: {
    commitsByYear: [
      { year: 2018, count: 45 },
      { year: 2019, count: 120 },
      { year: 2020, count: 200 },
      { year: 2021, count: 310 },
      { year: 2022, count: 280 },
      { year: 2023, count: 350 },
      { year: 2024, count: 420 },
    ],
  },
};

export const SingleYear: Story = {
  args: { commitsByYear: [{ year: 2025, count: 42 }] },
};
