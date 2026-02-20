import type { Meta, StoryObj } from '@storybook/react-vite';
import { TechStack } from './TechStack';
import { makeTechStack } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Report/TechStack',
  component: TechStack,
  decorators: [withContainer()],
} satisfies Meta<typeof TechStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { items: makeTechStack() },
};

export const SingleItem: Story = {
  args: { items: [{ name: 'Python', category: 'language' }] },
};

export const Empty: Story = {
  args: { items: [] },
};
