import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileChurnTable } from './FileChurnTable';
import { makeFileChurn } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Git Stats/FileChurnTable',
  component: FileChurnTable,
  decorators: [withContainer()],
} satisfies Meta<typeof FileChurnTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { fileChurn: makeFileChurn() },
};

export const ManyFiles: Story = {
  args: { fileChurn: makeFileChurn(10) },
};

export const FewFiles: Story = {
  args: { fileChurn: makeFileChurn(2) },
};
