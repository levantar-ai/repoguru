import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignalTooltip } from './SignalTooltip';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/SignalTooltip',
  component: SignalTooltip,
  decorators: [withContainer()],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SignalTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithEducation: Story = {
  args: {
    signal: 'README.md',
    education: {
      why: 'A README is the first thing people see when visiting your repository.',
      howToFix:
        'Create a README.md with project description, setup instructions, and usage examples.',
      fixUrl: 'https://github.com/owner/repo/new/main?filename=README.md',
    },
    children: <span style={{ color: 'var(--color-text)', cursor: 'pointer' }}>README.md</span>,
  },
};

export const WithoutEducation: Story = {
  args: {
    signal: 'Custom signal',
    children: <span style={{ color: 'var(--color-text)' }}>Custom signal</span>,
  },
};
