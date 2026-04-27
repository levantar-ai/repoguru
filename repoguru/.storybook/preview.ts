import type { Preview } from '@storybook/react-vite';
import { withThemeByClassName } from '@storybook/addon-themes';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        dark: '',
        light: 'light',
      },
      defaultTheme: 'dark',
      parentSelector: 'html',
    }),
    (Story) => {
      return Story();
    },
  ],
};

export default preview;
