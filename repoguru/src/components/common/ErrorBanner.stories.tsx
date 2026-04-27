import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorBanner } from './ErrorBanner';

const meta = {
  title: 'Common/ErrorBanner',
  component: ErrorBanner,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ErrorBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: 'Failed to fetch repository. Please check the URL and try again.' },
};

export const Dismissible: Story = {
  args: {
    message: 'Rate limit exceeded. Please wait a few minutes before retrying.',
    onDismiss: () => {},
  },
};

export const LongMessage: Story = {
  args: {
    message:
      'An unexpected error occurred while analyzing the repository. This could be due to the repository being too large, a network timeout, or the GitHub API being temporarily unavailable. Please try again later or use a GitHub token for higher rate limits.',
  },
};
