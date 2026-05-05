import type { Meta, StoryObj } from '@storybook/react-vite';
import { BadgeGenerator } from './BadgeGenerator';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/BadgeGenerator',
  component: BadgeGenerator,
  decorators: [withContainer()],
} satisfies Meta<typeof BadgeGenerator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GradeA: Story = {
  args: { owner: 'facebook', repo: 'react', grade: 'A', score: 94 },
};

export const GradeB: Story = {
  args: { owner: 'vercel', repo: 'next.js', grade: 'B', score: 78 },
};

export const GradeF: Story = {
  args: { owner: 'test', repo: 'abandoned', grade: 'F', score: 18 },
};
