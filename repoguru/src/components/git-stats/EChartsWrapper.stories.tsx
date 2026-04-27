import type { Meta, StoryObj } from '@storybook/react-vite';
import { EChartsWrapper } from './EChartsWrapper';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Charts/ECharts/EChartsWrapper',
  component: EChartsWrapper,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EChartsWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BarChart: Story = {
  args: {
    option: {
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      yAxis: { type: 'value' },
      series: [{ data: [120, 200, 150, 80, 70], type: 'bar' }],
    },
    height: '300px',
  },
};

export const LineChart: Story = {
  args: {
    option: {
      xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
      yAxis: { type: 'value' },
      series: [{ data: [820, 932, 901, 934, 1290, 1330], type: 'line', smooth: true }],
    },
    height: '300px',
  },
};

export const PieChart: Story = {
  args: {
    option: {
      series: [
        {
          type: 'pie',
          data: [
            { value: 1048, name: 'TypeScript' },
            { value: 735, name: 'JavaScript' },
            { value: 580, name: 'CSS' },
            { value: 484, name: 'HTML' },
          ],
        },
      ],
    },
    height: '350px',
  },
};
