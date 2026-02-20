import type { Meta, StoryObj } from '@storybook/react-vite';
import { GitStatsProgress } from './GitStatsProgress';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Git Stats/GitStatsProgress',
  component: GitStatsProgress,
  decorators: [withContainer()],
} satisfies Meta<typeof GitStatsProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FetchingCommits: Story = {
  args: {
    state: {
      step: 'fetching-commits',
      progress: 35,
      commitsFetched: 120,
      detailsFetched: 0,
      statusMessage: 'Fetching commits...',
      rawData: null,
      analysis: null,
      error: null,
    },
  },
};

export const FetchingDetails: Story = {
  args: {
    state: {
      step: 'fetching-details',
      progress: 68,
      commitsFetched: 350,
      detailsFetched: 240,
      statusMessage: 'Fetching commit details...',
      rawData: null,
      analysis: null,
      error: null,
    },
  },
};

export const Analyzing: Story = {
  args: {
    state: {
      step: 'analyzing',
      progress: 90,
      commitsFetched: 482,
      detailsFetched: 482,
      statusMessage: 'Computing statistics...',
      rawData: null,
      analysis: null,
      error: null,
    },
  },
};

export const Error: Story = {
  args: {
    state: {
      step: 'error',
      progress: 0,
      commitsFetched: 0,
      detailsFetched: 0,
      statusMessage: '',
      rawData: null,
      analysis: null,
      error: 'Failed to fetch commit history. Repository may be too large.',
    },
  },
};
