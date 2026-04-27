import type { Meta, StoryObj } from '@storybook/react-vite';
import { ComparePage } from './ComparePage';
import { withFullPage } from '../stories/decorators';

const meta = {
  title: 'Pages/ComparePage',
  component: ComparePage,
  decorators: [withFullPage()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ComparePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { githubToken: '' },
};

export const WithToken: Story = {
  args: { githubToken: 'ghp_mock_token_for_storybook' },
};
