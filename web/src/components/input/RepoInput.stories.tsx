import type { Meta, StoryObj } from '@storybook/react-vite';
import { RepoInput } from './RepoInput';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Input/RepoInput',
  component: RepoInput,
  decorators: [withContainer()],
} satisfies Meta<typeof RepoInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onSubmit: () => {}, isLoading: false },
};

export const Loading: Story = {
  args: { onSubmit: () => {}, isLoading: true },
};
