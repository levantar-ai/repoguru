import type { Decorator } from '@storybook/react-vite';
import { AppProvider } from '../context/AppContext';

// ── Decorators ────────────────────────────────────────────

/**
 * Wraps story in AppContext (real provider — IDB calls fail gracefully
 * in Storybook and fall back to defaults).
 */
export function withAppContext(): Decorator {
  return (Story) => (
    <AppProvider>
      <Story />
    </AppProvider>
  );
}

/**
 * Wraps story in a fixed-width container — useful for charts.
 */
export function withContainer(maxWidth = 800): Decorator {
  return (Story) => (
    <div
      style={{
        maxWidth,
        width: '100%',
        margin: '0 auto',
        padding: 16,
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
      }}
    >
      <Story />
    </div>
  );
}

/**
 * Full page decorator — AppContext + centered container + background.
 */
export function withFullPage(): Decorator {
  return (Story) => (
    <AppProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
        }}
      >
        <Story />
      </div>
    </AppProvider>
  );
}
