import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitsByExtension } from './CommitsByExtension';
import { withContainer } from '../../stories/decorators';
import { makeGitStatsAnalysis } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CommitsByExtension',
  component: CommitsByExtension,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitsByExtension>;

export default meta;
type Story = StoryObj<typeof meta>;

const analysis = makeGitStatsAnalysis();

export const Default: Story = {
  args: { commitsByExtension: analysis.commitsByExtension },
};

export const ManyExtensions: Story = {
  args: {
    commitsByExtension: [
      { ext: '.ts', count: 180 },
      { ext: '.tsx', count: 145 },
      { ext: '.css', count: 52 },
      { ext: '.json', count: 48 },
      { ext: '.md', count: 35 },
      { ext: '.yml', count: 22 },
      { ext: '.py', count: 18 },
      { ext: '.sh', count: 12 },
      { ext: '.sql', count: 8 },
      { ext: '.html', count: 5 },
    ],
  },
};
