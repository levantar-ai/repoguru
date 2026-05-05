import type { Meta, StoryObj } from '@storybook/react-vite';
import { LetterGrade } from './LetterGrade';

const meta = {
  title: 'Report/LetterGrade',
  component: LetterGrade,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LetterGrade>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GradeA: Story = {
  args: { grade: 'A', score: 94 },
};

export const GradeB: Story = {
  args: { grade: 'B', score: 78 },
};

export const GradeC: Story = {
  args: { grade: 'C', score: 62 },
};

export const GradeD: Story = {
  args: { grade: 'D', score: 45 },
};

export const GradeF: Story = {
  args: { grade: 'F', score: 22 },
};

export const SmallSize: Story = {
  args: { grade: 'A', score: 92, size: 'sm' },
};

export const LargeSize: Story = {
  args: { grade: 'B', score: 80, size: 'lg' },
};

export const AllGrades: Story = {
  args: { grade: 'A', score: 95 },
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <LetterGrade grade="A" score={95} />
      <LetterGrade grade="B" score={80} />
      <LetterGrade grade="C" score={62} />
      <LetterGrade grade="D" score={45} />
      <LetterGrade grade="F" score={20} />
    </div>
  ),
};
