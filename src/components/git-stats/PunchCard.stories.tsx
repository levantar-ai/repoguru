import type { Meta, StoryObj } from '@storybook/react-vite';
import { PunchCard } from './PunchCard';
import { withContainer } from '../../stories/decorators';
import { makePunchCardData } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/PunchCard',
  component: PunchCard,
  decorators: [withContainer(900)],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PunchCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { punchCard: makePunchCardData() },
};

export const NineToFive: Story = {
  args: {
    punchCard: makePunchCardData().map((p) => ({
      ...p,
      commits: p.day >= 1 && p.day <= 5 && p.hour >= 9 && p.hour <= 17 ? p.commits * 3 : 0,
    })),
  },
};
