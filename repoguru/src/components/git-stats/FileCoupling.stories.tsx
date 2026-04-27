import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileCoupling } from './FileCoupling';
import { makeFileCoupling } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Git Stats/FileCoupling',
  component: FileCoupling,
  decorators: [withContainer()],
} satisfies Meta<typeof FileCoupling>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { fileCoupling: makeFileCoupling() },
};

export const FewPairs: Story = {
  args: { fileCoupling: makeFileCoupling(2) },
};
