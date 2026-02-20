import type { Meta, StoryObj } from '@storybook/react-vite';
import { D3Container } from './D3Container';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Charts/D3/D3Container',
  component: D3Container,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof D3Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleCircles: Story = {
  args: {
    height: 200,
    render: (svg, width, height) => {
      const ns = 'http://www.w3.org/2000/svg';
      const colors = ['#06b6d4', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];
      for (let i = 0; i < 5; i++) {
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', String((width / 6) * (i + 1)));
        circle.setAttribute('cy', String(height / 2));
        circle.setAttribute('r', '20');
        circle.setAttribute('fill', colors[i]);
        svg.appendChild(circle);
      }
    },
  },
};
