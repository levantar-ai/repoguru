import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeToggle } from './ThemeToggle';
import { withAppContext } from '../../stories/decorators';

const meta = {
  title: 'Layout/ThemeToggle',
  component: ThemeToggle,
  decorators: [withAppContext()],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
