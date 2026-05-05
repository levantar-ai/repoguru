import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReportCard } from './ReportCard';
import { makeAnalysisReport } from '../../stories/mocks';
import { withAppContext } from '../../stories/decorators';

const meta = {
  title: 'Report/ReportCard',
  component: ReportCard,
  decorators: [withAppContext()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GradeA: Story = {
  args: { report: makeAnalysisReport({ grade: 'A' }), onNewAnalysis: () => {} },
};

export const GradeB: Story = {
  args: { report: makeAnalysisReport({ grade: 'B' }), onNewAnalysis: () => {} },
};

export const GradeC: Story = {
  args: { report: makeAnalysisReport({ grade: 'C' }), onNewAnalysis: () => {} },
};

export const GradeF: Story = {
  args: { report: makeAnalysisReport({ grade: 'F' }), onNewAnalysis: () => {} },
};

export const WithLlmInsights: Story = {
  args: {
    report: makeAnalysisReport({
      grade: 'B',
      llmInsights: {
        summary: 'Well-structured project with room for improvement in security practices.',
        risks: ['Single maintainer dependency', 'Outdated CI configuration'],
        recommendations: ['Add CODEOWNERS', 'Enable branch protection'],
        generatedAt: '2025-01-15T10:31:00Z',
      },
    }),
    onNewAnalysis: () => {},
  },
};
