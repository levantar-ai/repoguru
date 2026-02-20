import type { Meta, StoryObj } from '@storybook/react-vite';
import { InsightsList } from './InsightsList';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/InsightsList',
  component: InsightsList,
  decorators: [withContainer()],
} satisfies Meta<typeof InsightsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Strengths: Story = {
  args: {
    title: 'Strengths',
    icon: 'check',
    color: 'green',
    items: [
      'Comprehensive documentation with API reference',
      'Active community with quick issue response times',
      'Well-structured CI/CD pipeline with automated testing',
    ],
  },
};

export const Risks: Story = {
  args: {
    title: 'Risks',
    icon: 'warning',
    color: 'yellow',
    items: [
      'Some dependencies are outdated by 2+ major versions',
      'No SECURITY.md or vulnerability disclosure policy',
    ],
  },
};

export const NextSteps: Story = {
  args: {
    title: 'Next Steps',
    icon: 'arrow',
    color: 'blue',
    items: [
      'Add a SECURITY.md file',
      'Update outdated dependencies',
      'Add branch protection rules',
    ],
  },
};

export const Empty: Story = {
  args: {
    title: 'Empty Section',
    icon: 'check',
    color: 'green',
    items: [],
  },
};
