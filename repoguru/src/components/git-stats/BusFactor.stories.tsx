import type { Meta, StoryObj } from '@storybook/react-vite';
import type { HealthSection } from '@repoguru/core';
import { BusFactor } from './BusFactor';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Charts/D3/BusFactor',
  component: BusFactor,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BusFactor>;

export default meta;
type Story = StoryObj<typeof meta>;

const balanced: HealthSection['busFactor'] = {
  factor: 3,
  herfindahlIndex: 0.22,
  lorenz: [0.4, 0.65, 0.82, 0.92, 0.97, 1],
  cumulativeContributors: [
    { contributorId: 'alice', cumulativePercentage: 40 },
    { contributorId: 'bob', cumulativePercentage: 65 },
    { contributorId: 'charlie', cumulativePercentage: 82 },
    { contributorId: 'diana', cumulativePercentage: 92 },
    { contributorId: 'eve', cumulativePercentage: 97 },
    { contributorId: 'frank', cumulativePercentage: 100 },
  ],
};

export const Default: Story = {
  args: { busFactor: balanced },
};

export const HighRisk: Story = {
  args: {
    busFactor: {
      factor: 1,
      herfindahlIndex: 0.85,
      lorenz: [0.95, 1],
      cumulativeContributors: [
        { contributorId: 'solo-dev', cumulativePercentage: 95 },
        { contributorId: 'occasional', cumulativePercentage: 100 },
      ],
    },
  },
};

export const Healthy: Story = {
  args: {
    busFactor: {
      ...balanced,
      factor: 8,
      herfindahlIndex: 0.08,
    },
  },
};
