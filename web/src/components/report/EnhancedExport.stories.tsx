import type { Meta, StoryObj } from '@storybook/react-vite';
import { EnhancedExport } from './EnhancedExport';
import { makeAnalysisReport } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/EnhancedExport',
  component: EnhancedExport,
  decorators: [withContainer()],
} satisfies Meta<typeof EnhancedExport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { report: makeAnalysisReport() },
};

export const GradeA: Story = {
  args: { report: makeAnalysisReport({ grade: 'A' }) },
};
