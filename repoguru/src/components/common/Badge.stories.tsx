import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Common/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Default Badge' },
};

export const Primary: Story = {
  args: { children: 'Primary', variant: 'primary' },
};

export const Success: Story = {
  args: { children: 'Passing', variant: 'success' },
};

export const Warning: Story = {
  args: { children: 'Outdated', variant: 'warning' },
};

export const AllVariants: Story = {
  args: { children: 'All Variants' },
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge>Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
    </div>
  ),
};
