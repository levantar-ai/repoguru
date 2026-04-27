import type { Meta, StoryObj } from '@storybook/react-vite';
import { RecentReposList } from './RecentReposList';
import { makeRecentRepos } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Input/RecentReposList',
  component: RecentReposList,
  decorators: [withContainer()],
} satisfies Meta<typeof RecentReposList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { repos: makeRecentRepos(), onSelect: () => {}, disabled: false },
};

export const SingleRepo: Story = {
  args: { repos: makeRecentRepos(1), onSelect: () => {}, disabled: false },
};

export const Disabled: Story = {
  args: { repos: makeRecentRepos(3), onSelect: () => {}, disabled: true },
};

export const Empty: Story = {
  args: { repos: [], onSelect: () => {}, disabled: false },
};
