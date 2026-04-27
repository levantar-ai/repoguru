import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommitMessageCloud } from './CommitMessageCloud';
import { withContainer } from '../../stories/decorators';
import { makeCommitMessageStats } from '../../stories/mocks';

const meta = {
  title: 'Charts/D3/CommitMessageCloud',
  component: CommitMessageCloud,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CommitMessageCloud>;

export default meta;
type Story = StoryObj<typeof meta>;

const stats = makeCommitMessageStats();

export const Default: Story = {
  args: { wordFrequency: stats.wordFrequency },
};

export const FewWords: Story = {
  args: {
    wordFrequency: [
      { word: 'fix', count: 50 },
      { word: 'update', count: 30 },
      { word: 'add', count: 20 },
    ],
  },
};

export const ManyWords: Story = {
  args: {
    wordFrequency: [
      { word: 'fix', count: 120 },
      { word: 'add', count: 95 },
      { word: 'update', count: 82 },
      { word: 'refactor', count: 65 },
      { word: 'remove', count: 58 },
      { word: 'improve', count: 45 },
      { word: 'feat', count: 42 },
      { word: 'test', count: 38 },
      { word: 'docs', count: 35 },
      { word: 'style', count: 30 },
      { word: 'config', count: 28 },
      { word: 'cleanup', count: 22 },
      { word: 'chore', count: 18 },
      { word: 'merge', count: 15 },
      { word: 'release', count: 12 },
      { word: 'deploy', count: 10 },
      { word: 'security', count: 8 },
      { word: 'perf', count: 6 },
      { word: 'ci', count: 5 },
      { word: 'build', count: 4 },
    ],
  },
};
