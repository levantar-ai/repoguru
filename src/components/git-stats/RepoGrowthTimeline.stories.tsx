import type { Meta, StoryObj } from '@storybook/react-vite';
import { RepoGrowthTimeline } from './RepoGrowthTimeline';
import { withContainer } from '../../stories/decorators';
import { makeRepoGrowth } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/RepoGrowthTimeline',
  component: RepoGrowthTimeline,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RepoGrowthTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { repoGrowth: makeRepoGrowth() },
};

export const LongHistory: Story = {
  args: { repoGrowth: makeRepoGrowth(36) },
};

export const ShortHistory: Story = {
  args: { repoGrowth: makeRepoGrowth(3) },
};
