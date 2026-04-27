import type { Meta, StoryObj } from '@storybook/react-vite';
import { Layout } from './Layout';
import { withAppContext } from '../../stories/decorators';

const meta = {
  title: 'Layout/Layout',
  component: Layout,
  decorators: [withAppContext()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onNavigate: () => {},
    currentPage: 'home',
    children: (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>Page Content Area</h2>
        <p>This is where the main page content would render.</p>
      </div>
    ),
  },
};
