import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Common/ProgressBar',
  component: ProgressBar,
  decorators: [withContainer()],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Parsing: Story = {
  args: { step: 'parsing', progress: 10 },
};

export const FetchingFiles: Story = {
  args: { step: 'fetching-files', progress: 45, filesFetched: 32, filesTotal: 72 },
};

export const Analyzing: Story = {
  args: { step: 'analyzing', progress: 75 },
};

export const Complete: Story = {
  args: { step: 'done', progress: 100 },
};

export const LlmEnrichment: Story = {
  args: { step: 'llm-enrichment', progress: 88 },
};
