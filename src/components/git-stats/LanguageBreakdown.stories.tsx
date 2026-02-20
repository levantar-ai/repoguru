import type { Meta, StoryObj } from '@storybook/react-vite';
import { LanguageBreakdown } from './LanguageBreakdown';
import { withContainer } from '../../stories/decorators';
import { makeLanguages } from '../../stories/mocks';

const meta = {
  title: 'Charts/ECharts/LanguageBreakdown',
  component: LanguageBreakdown,
  decorators: [withContainer()],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LanguageBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { languages: makeLanguages() },
};

export const SingleLanguage: Story = {
  args: {
    languages: [{ name: 'Rust', bytes: 500_000, percentage: 100 }],
  },
};

export const ManyLanguages: Story = {
  args: {
    languages: [
      { name: 'TypeScript', bytes: 200_000, percentage: 35 },
      { name: 'Python', bytes: 150_000, percentage: 26 },
      { name: 'Go', bytes: 80_000, percentage: 14 },
      { name: 'Shell', bytes: 50_000, percentage: 9 },
      { name: 'Dockerfile', bytes: 30_000, percentage: 5 },
      { name: 'YAML', bytes: 25_000, percentage: 4 },
      { name: 'JavaScript', bytes: 20_000, percentage: 4 },
      { name: 'HTML', bytes: 15_000, percentage: 3 },
    ],
  },
};
