import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeFrequencyChart } from './CodeFrequencyChart';
import { withContainer } from '../../stories/decorators';
import { makeCodeFrequency } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/CodeFrequencyChart',
  component: CodeFrequencyChart,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CodeFrequencyChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { codeFrequency: makeCodeFrequency() },
};
