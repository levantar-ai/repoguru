import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitPatterns } from './CommitPatterns';
import { withContainer } from '../../stories/decorators';
import { makeCommitMessageStats } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CommitPatterns',
  component: CommitPatterns,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitPatterns>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { commitMessages: makeCommitMessageStats() },
};

export const HighConventional: Story = {
  args: {
    commitMessages: makeCommitMessageStats({
      conventionalPercentage: 95,
      totalCommits: 800,
    }),
  },
};

export const LowConventional: Story = {
  args: {
    commitMessages: makeCommitMessageStats({
      conventionalPercentage: 12,
      totalCommits: 50,
    }),
  },
};
