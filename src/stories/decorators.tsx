/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import type { Decorator } from '@storybook/react-vite';
import type { AppSettings, RateLimitInfo, RecentRepo } from '../types';
import { makeRecentRepos, makeRateLimit } from './mocks';

// ── Minimal AppContext mock (no IndexedDB / persistence) ──

interface MockAppState {
  settings: AppSettings;
  githubToken: string;
  anthropicKey: string;
  rateLimit: RateLimitInfo | null;
  recentRepos: RecentRepo[];
  settingsOpen: boolean;
  loaded: boolean;
}

const defaultMockState: MockAppState = {
  settings: { theme: 'dark', llmMode: 'off' },
  githubToken: '',
  anthropicKey: '',
  rateLimit: makeRateLimit(),
  recentRepos: makeRecentRepos(),
  settingsOpen: false,
  loaded: true,
};

// We import the real context to provide the right shape
// but bypass persistence by supplying a pre-built value.
import { createContext, useContext, type Dispatch } from 'react';

type AppAction =
  | { type: 'SET_SETTINGS'; settings: AppSettings }
  | { type: 'SET_THEME'; theme: AppSettings['theme'] }
  | { type: 'SET_LLM_MODE'; mode: AppSettings['llmMode'] }
  | { type: 'SET_GITHUB_TOKEN'; token: string }
  | { type: 'SET_ANTHROPIC_KEY'; key: string }
  | { type: 'SET_RATE_LIMIT'; info: RateLimitInfo }
  | { type: 'SET_RECENT_REPOS'; repos: RecentRepo[] }
  | { type: 'ADD_RECENT_REPO'; repo: RecentRepo }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'SET_LOADED' };

interface AppContextValue {
  state: MockAppState;
  dispatch: Dispatch<AppAction>;
  addRecentRepo: (repo: RecentRepo) => void;
}

// Re-create the context with the same shape the real AppContext uses.
// Components call useApp() → useContext(AppContext), so we need to
// provide the identical context object. We import it from the real module.
// However the real AppProvider tries to load from IndexedDB, so instead
// we re-export a thin provider that supplies static data.

const MockAppContext = createContext<AppContextValue | null>(null);

export function useMockApp() {
  const ctx = useContext(MockAppContext);
  if (!ctx) throw new Error('useMockApp must be used within MockAppProvider');
  return ctx;
}

export function MockAppProvider({
  children,
  overrides,
}: {
  children: ReactNode;
  overrides?: Partial<MockAppState>;
}) {
  const state: MockAppState = { ...defaultMockState, ...overrides };
  const noop = () => {};
  const dispatch: Dispatch<AppAction> = noop as Dispatch<AppAction>;
  const addRecentRepo = noop as (repo: RecentRepo) => void;

  // We need to provide the value via the REAL AppContext so useApp() works.
  // Import the real context module and render its Provider directly.
  return (
    <RealAppContextBridge state={state} dispatch={dispatch} addRecentRepo={addRecentRepo}>
      {children}
    </RealAppContextBridge>
  );
}

// Bridge that patches the real AppContext.Provider
// We dynamically access the context from the real module.
import { AppProvider as _RealAppProvider } from '../context/AppContext';

function RealAppContextBridge({
  children,
  state,
  dispatch,
  addRecentRepo,
}: {
  children: ReactNode;
  state: MockAppState;
  dispatch: Dispatch<AppAction>;
  addRecentRepo: (repo: RecentRepo) => void;
}) {
  // The simplest approach: render the real AppProvider but override
  // the document theme class to match. The real provider loads from IDB
  // but since we're in Storybook, IDB calls will just return defaults.
  // We use a context override approach instead.
  void state;
  void dispatch;
  void addRecentRepo;
  void MockAppContext;

  // Actually, the cleanest approach for Storybook is just to wrap with
  // the real AppProvider. In Storybook's jsdom-like env, the IDB calls
  // will fail gracefully (they're wrapped in try/catch) and fall back
  // to defaults, which is exactly what we want.
  return <_RealAppProvider>{children}</_RealAppProvider>;
}

// ── Decorators ────────────────────────────────────────────

/**
 * Wraps story in AppContext (real provider, IDB fails gracefully in Storybook).
 */
export function withAppContext(_overrides?: Partial<MockAppState>): Decorator {
  return (Story) => (
    <MockAppProvider overrides={_overrides}>
      <Story />
    </MockAppProvider>
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
    <MockAppProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
        }}
      >
        <Story />
      </div>
    </MockAppProvider>
  );
}
