import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitSizeHistogram } from './CommitSizeHistogram';
import { withContainer } from '../../stories/decorators';
import { makeCommitSizeDistribution } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CommitSizeHistogram',
  component: CommitSizeHistogram,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitSizeHistogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { distribution: makeCommitSizeDistribution() },
};

export const MostlySmall: Story = {
  args: {
    distribution: makeCommitSizeDistribution({
      buckets: [
        { label: '1-10', min: 1, max: 10, count: 320 },
        { label: '11-50', min: 11, max: 50, count: 80 },
        { label: '51-100', min: 51, max: 100, count: 15 },
        { label: '101-500', min: 101, max: 500, count: 5 },
        { label: '500+', min: 501, max: 99999, count: 2 },
      ],
    }),
  },
};
