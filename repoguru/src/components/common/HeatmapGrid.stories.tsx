import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeatmapGrid } from './HeatmapGrid';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Common/HeatmapGrid',
  component: HeatmapGrid,
  decorators: [withContainer(1000)],
} satisfies Meta<typeof HeatmapGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const categoryKeys = ['documentation', 'security', 'cicd', 'dependencies', 'codeQuality'];
const categoryLabels: Record<string, string> = {
  documentation: 'Docs',
  security: 'Security',
  cicd: 'CI/CD',
  dependencies: 'Deps',
  codeQuality: 'Quality',
};

export const Default: Story = {
  args: {
    categoryKeys,
    categoryLabels,
    repos: [
      {
        name: 'facebook/react',
        overallScore: 92,
        grade: 'A',
        categories: {
          documentation: 95,
          security: 88,
          cicd: 92,
          dependencies: 85,
          codeQuality: 90,
        },
      },
      {
        name: 'vercel/next.js',
        overallScore: 85,
        grade: 'B',
        categories: {
          documentation: 90,
          security: 78,
          cicd: 88,
          dependencies: 82,
          codeQuality: 85,
        },
      },
      {
        name: 'denoland/deno',
        overallScore: 65,
        grade: 'C',
        categories: {
          documentation: 70,
          security: 55,
          cicd: 72,
          dependencies: 60,
          codeQuality: 68,
        },
      },
      {
        name: 'small/project',
        overallScore: 35,
        grade: 'F',
        categories: {
          documentation: 20,
          security: 30,
          cicd: 10,
          dependencies: 50,
          codeQuality: 45,
        },
      },
    ],
  },
};

export const SingleRepo: Story = {
  args: {
    categoryKeys,
    categoryLabels,
    repos: [
      {
        name: 'my/repo',
        overallScore: 78,
        grade: 'B',
        categories: {
          documentation: 80,
          security: 75,
          cicd: 82,
          dependencies: 72,
          codeQuality: 78,
        },
      },
    ],
  },
};
