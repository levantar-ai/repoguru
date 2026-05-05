import type { Meta, StoryObj } from '@storybook/react-vite';
import { HomePage } from './HomePage';
import { withFullPage } from '../stories/decorators';

const meta = {
  title: 'Pages/HomePage',
  component: HomePage,
  decorators: [withFullPage()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onNavigate: () => {} },
};
