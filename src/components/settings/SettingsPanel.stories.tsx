import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsPanel } from './SettingsPanel';
import { withAppContext } from '../../stories/decorators';

const meta = {
  title: 'Settings/SettingsPanel',
  component: SettingsPanel,
  decorators: [withAppContext({ settingsOpen: true })],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
