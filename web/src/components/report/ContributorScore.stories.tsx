import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContributorScore } from './ContributorScore';
import { makeContributorFriendliness } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/ContributorScore',
  component: ContributorScore,
  decorators: [withContainer()],
} satisfies Meta<typeof ContributorScore>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data: makeContributorFriendliness() },
};

export const HighScore: Story = {
  args: {
    data: makeContributorFriendliness({
      score: 95,
      readinessChecklist: [
        { label: 'Contributing guide', passed: true, description: 'CONTRIBUTING.md exists' },
        { label: 'Issue templates', passed: true, description: 'Bug and feature templates found' },
        { label: 'Code of Conduct', passed: true, description: 'CODE_OF_CONDUCT.md found' },
      ],
    }),
  },
};

export const LowScore: Story = {
  args: {
    data: makeContributorFriendliness({
      score: 20,
      readinessChecklist: [
        { label: 'Contributing guide', passed: false, description: 'No CONTRIBUTING.md' },
        { label: 'Issue templates', passed: false, description: 'No issue templates' },
        { label: 'Code of Conduct', passed: false, description: 'No CODE_OF_CONDUCT.md' },
      ],
    }),
  },
};
