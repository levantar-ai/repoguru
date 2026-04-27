import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContributorBreakdown } from './ContributorBreakdown';
import { withContainer } from '../../stories/decorators';
import { makeContributors } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/ContributorBreakdown',
  component: ContributorBreakdown,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ContributorBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { contributors: makeContributors() },
};

export const SoloMaintainer: Story = {
  args: { contributors: makeContributors(1) },
};

export const LargeTeam: Story = {
  args: { contributors: makeContributors(8) },
};
