import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadarChart } from './RadarChart';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Charts/SVG/RadarChart',
  component: RadarChart,
  decorators: [withContainer(400)],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RadarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { label: 'Documentation', value: 85 },
      { label: 'Security', value: 72 },
      { label: 'CI/CD', value: 90 },
      { label: 'Dependencies', value: 65 },
      { label: 'Code Quality', value: 88 },
      { label: 'License', value: 95 },
      { label: 'Community', value: 70 },
    ],
  },
};

export const PerfectScores: Story = {
  args: {
    data: [
      { label: 'Docs', value: 100 },
      { label: 'Security', value: 100 },
      { label: 'CI/CD', value: 100 },
      { label: 'Deps', value: 100 },
      { label: 'Quality', value: 100 },
    ],
  },
};

export const LowScores: Story = {
  args: {
    data: [
      { label: 'Documentation', value: 15 },
      { label: 'Security', value: 22 },
      { label: 'CI/CD', value: 8 },
      { label: 'Dependencies', value: 30 },
      { label: 'Code Quality', value: 18 },
      { label: 'License', value: 0 },
      { label: 'Community', value: 12 },
    ],
  },
};

export const SmallSize: Story = {
  args: {
    size: 200,
    data: [
      { label: 'A', value: 80 },
      { label: 'B', value: 60 },
      { label: 'C', value: 90 },
      { label: 'D', value: 45 },
      { label: 'E', value: 75 },
    ],
  },
};
