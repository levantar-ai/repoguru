import type { Meta, StoryObj } from '@storybook/react-vite';
import { CategoryScores } from './CategoryScores';
import { makeCategories } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/CategoryScores',
  component: CategoryScores,
  decorators: [withContainer()],
} satisfies Meta<typeof CategoryScores>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GradeA: Story = {
  args: { categories: makeCategories('A') },
};

export const GradeB: Story = {
  args: { categories: makeCategories('B') },
};

export const GradeF: Story = {
  args: { categories: makeCategories('F') },
};
