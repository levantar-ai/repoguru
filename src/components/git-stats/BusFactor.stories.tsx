import type { Meta, StoryObj } from '@storybook/react-vite';
import { BusFactor } from './BusFactor';
import { withContainer } from '../../stories/decorators';
import { makeBusFactorData } from '../../stories/mocks';

const meta = {
  title: 'Charts/D3/BusFactor',
  component: BusFactor,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BusFactor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { busFactor: makeBusFactorData() },
};

export const HighRisk: Story = {
  args: {
    busFactor: makeBusFactorData({
      busFactor: 1,
      herfindahlIndex: 0.85,
      cumulativeContributors: [
        { login: 'solo-dev', cumulativePercentage: 95 },
        { login: 'occasional', cumulativePercentage: 100 },
      ],
    }),
  },
};

export const Healthy: Story = {
  args: {
    busFactor: makeBusFactorData({
      busFactor: 8,
      herfindahlIndex: 0.08,
    }),
  },
};
