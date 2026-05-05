import type { Meta, StoryObj } from '@storybook/react-vite';
import { LlmInsightsPanel } from './LlmInsightsPanel';
import { makeLlmInsights } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/LlmInsightsPanel',
  component: LlmInsightsPanel,
  decorators: [withContainer()],
} satisfies Meta<typeof LlmInsightsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { insights: makeLlmInsights() },
};

export const DetailedInsights: Story = {
  args: {
    insights: makeLlmInsights({
      summary:
        'This is a mature, well-architected React application with strong TypeScript usage and comprehensive testing. The codebase follows modern best practices.',
      risks: [
        'Heavy reliance on a single maintainer for core modules',
        'Some third-party dependencies have known CVEs',
        'No automated dependency update process (e.g., Dependabot)',
      ],
      recommendations: [
        'Enable Dependabot or Renovate for automated dependency updates',
        'Add CODEOWNERS file to enforce review requirements',
        'Consider adding end-to-end tests with Playwright',
      ],
    }),
  },
};
