import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrendChart } from './TrendChart';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Charts/SVG/TrendChart',
  component: TrendChart,
  decorators: [withContainer()],
} satisfies Meta<typeof TrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entries: [
      { date: '2024-06-01', score: 62 },
      { date: '2024-07-15', score: 68 },
      { date: '2024-09-01', score: 71 },
      { date: '2024-10-20', score: 75 },
      { date: '2024-12-05', score: 82 },
      { date: '2025-01-10', score: 85 },
    ],
  },
};

export const SingleEntry: Story = {
  args: {
    entries: [{ date: '2025-01-10', score: 78 }],
  },
};

export const Declining: Story = {
  args: {
    entries: [
      { date: '2024-06-01', score: 90 },
      { date: '2024-08-01', score: 82 },
      { date: '2024-10-01', score: 68 },
      { date: '2024-12-01', score: 55 },
      { date: '2025-01-01', score: 42 },
    ],
  },
};

export const Tall: Story = {
  args: {
    height: 300,
    entries: [
      { date: '2024-01-01', score: 50 },
      { date: '2024-04-01', score: 60 },
      { date: '2024-07-01', score: 72 },
      { date: '2024-10-01', score: 80 },
      { date: '2025-01-01', score: 88 },
    ],
  },
};
