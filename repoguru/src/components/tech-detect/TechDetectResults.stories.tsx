import type { Meta, StoryObj } from '@storybook/react-vite';
import { TechDetectResults } from './TechDetectResults';
import { makeTechDetectResult } from '../../stories/mocks';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Tech Detect/TechDetectResults',
  component: TechDetectResults,
  decorators: [withContainer(1000)],
} satisfies Meta<typeof TechDetectResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { result: makeTechDetectResult() },
};

export const MultiCloud: Story = {
  args: {
    result: makeTechDetectResult({
      aws: [
        {
          service: 'S3',
          sdkPackage: '@aws-sdk/client-s3',
          source: 'package.json',
          via: 'js-sdk-v3',
        },
        { service: 'Lambda', source: 'serverless.yml', via: 'cloudformation' },
      ],
      azure: [
        {
          service: 'Blob Storage',
          sdkPackage: '@azure/storage-blob',
          source: 'package.json',
          via: 'npm-sdk',
        },
      ],
      gcp: [
        {
          service: 'Cloud Storage',
          sdkPackage: '@google-cloud/storage',
          source: 'package.json',
          via: 'npm-sdk',
        },
      ],
    }),
  },
};

export const MinimalResult: Story = {
  args: {
    result: makeTechDetectResult({
      aws: [],
      azure: [],
      gcp: [],
      python: [],
      go: [],
      java: [],
      node: [{ name: 'express', version: '^4.18.2', source: 'package.json' }],
      manifestFiles: ['package.json'],
    }),
  },
};
