import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingScreen } from './LoadingScreen';

const meta = {
  title: 'Common/LoadingScreen',
  component: LoadingScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LoadingScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
