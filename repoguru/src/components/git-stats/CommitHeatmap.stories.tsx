import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitHeatmap } from './CommitHeatmap';
import { withContainer } from '../../stories/decorators';
import { makeCommitActivity } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CommitHeatmap',
  component: CommitHeatmap,
  decorators: [withContainer(1000)],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitHeatmap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { commitActivity: makeCommitActivity() },
};

export const SparseActivity: Story = {
  args: {
    commitActivity: makeCommitActivity().map((w) => ({
      ...w,
      days: w.days.map((d) => Math.max(0, d - 7)),
      total: Math.max(0, w.total - 49),
    })),
  },
};
