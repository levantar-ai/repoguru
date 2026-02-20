import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnimatedGradeReveal } from './AnimatedGradeReveal';

const meta = {
  title: 'Report/AnimatedGradeReveal',
  component: AnimatedGradeReveal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AnimatedGradeReveal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GradeA: Story = {
  args: { grade: 'A', score: 94, onComplete: () => {} },
};

export const GradeB: Story = {
  args: { grade: 'B', score: 78, onComplete: () => {} },
};

export const GradeF: Story = {
  args: { grade: 'F', score: 22, onComplete: () => {} },
};
