import type { Meta, StoryObj } from '@storybook/react-vite';
import { MermaidDiagram } from './MermaidDiagram';
import { withContainer } from '../../stories/decorators';

const meta = {
  title: 'Common/MermaidDiagram',
  component: MermaidDiagram,
  decorators: [withContainer()],
} satisfies Meta<typeof MermaidDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Flowchart: Story = {
  args: {
    chart: `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> A`,
  },
};

export const Sequence: Story = {
  args: {
    chart: `sequenceDiagram
    participant U as User
    participant A as App
    participant G as GitHub API
    U->>A: Enter repo URL
    A->>G: Fetch repo info
    G-->>A: Repository data
    A->>A: Analyze
    A-->>U: Show report`,
  },
};

export const InvalidChart: Story = {
  args: {
    chart: 'this is not valid mermaid syntax }{][',
  },
};
