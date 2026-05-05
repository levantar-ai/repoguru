import type { Meta, StoryObj } from '@storybook/react-vite';
import { FixItLinks } from './FixItLinks';
import { makeAnalysisReport } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/FixItLinks',
  component: FixItLinks,
  decorators: [withContainer()],
} satisfies Meta<typeof FixItLinks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    report: makeAnalysisReport(),
    owner: 'facebook',
    repo: 'react',
    branch: 'main',
  },
};

export const LowGrade: Story = {
  args: {
    report: makeAnalysisReport({ grade: 'F' }),
    owner: 'test',
    repo: 'bad-repo',
    branch: 'main',
  },
};
