import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShareToolbar } from './ShareToolbar';
import { makeAnalysisReport } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/ShareToolbar',
  component: ShareToolbar,
  decorators: [withContainer()],
} satisfies Meta<typeof ShareToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { report: makeAnalysisReport() },
};
