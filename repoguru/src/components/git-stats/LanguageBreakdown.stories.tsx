import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PatternsSection } from '@repoguru/core';
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

// Adapt the legacy mock builder to the canonical PatternsSection shape.
const toCanonical = (
  raw: { name: string; bytes: number; percentage: number }[],
): PatternsSection['languageBreakdown'] =>
  raw.map((l) => ({ language: l.name, percentage: l.percentage, bytes: l.bytes }));

export const Default: Story = {
  args: { languages: toCanonical(makeLanguages()) },
};

export const SingleLanguage: Story = {
  args: {
    languages: [{ language: 'Rust', percentage: 100, bytes: 500_000 }],
  },
};

export const ManyLanguages: Story = {
  args: {
    languages: [
      { language: 'TypeScript', percentage: 35, bytes: 200_000 },
      { language: 'Python', percentage: 26, bytes: 150_000 },
      { language: 'Go', percentage: 14, bytes: 80_000 },
      { language: 'Shell', percentage: 9, bytes: 50_000 },
      { language: 'Dockerfile', percentage: 5, bytes: 30_000 },
      { language: 'YAML', percentage: 4, bytes: 25_000 },
      { language: 'JavaScript', percentage: 4, bytes: 20_000 },
      { language: 'HTML', percentage: 3, bytes: 15_000 },
    ],
  },
};
