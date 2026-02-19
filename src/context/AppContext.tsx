import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { AppSettings, RateLimitInfo, RecentRepo } from '../types';
import { loadSettings, saveSettings } from '../services/persistence/settingsStore';
import { loadRecentRepos, saveRecentRepo } from '../services/persistence/repoCache';
import { loadGithubToken } from '../services/persistence/credentials';

interface AppState {
  settings: AppSettings;
  githubToken: string;
  anthropicKey: string;
  rateLimit: RateLimitInfo | null;
  recentRepos: RecentRepo[];
  settingsOpen: boolean;
  loaded: boolean;
}

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

const initialState: AppState = {
  settings: { theme: 'dark', llmMode: 'off' },
  githubToken: '',
  anthropicKey: '',
  rateLimit: null,
  recentRepos: [],
  settingsOpen: false,
  loaded: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };
    case 'SET_THEME':
      return { ...state, settings: { ...state.settings, theme: action.theme } };
    case 'SET_LLM_MODE':
      return { ...state, settings: { ...state.settings, llmMode: action.mode } };
    case 'SET_GITHUB_TOKEN':
      return { ...state, githubToken: action.token };
    case 'SET_ANTHROPIC_KEY':
      return { ...state, anthropicKey: action.key };
    case 'SET_RATE_LIMIT':
      return { ...state, rateLimit: action.info };
    case 'SET_RECENT_REPOS':
      return { ...state, recentRepos: action.repos };
    case 'ADD_RECENT_REPO': {
      const filtered = state.recentRepos.filter(
        (r) => !(r.owner === action.repo.owner && r.repo === action.repo.repo)
      );
      return { ...state, recentRepos: [action.repo, ...filtered].slice(0, 10) };
    }
    case 'TOGGLE_SETTINGS':
      return { ...state, settingsOpen: !state.settingsOpen };
    case 'SET_LOADED':
      return { ...state, loaded: true };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  addRecentRepo: (repo: RecentRepo) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load persisted settings and recent repos on mount
  useEffect(() => {
    (async () => {
      try {
        const [settings, recentRepos, savedToken] = await Promise.all([
          loadSettings(),
          loadRecentRepos(),
          loadGithubToken(),
        ]);
        if (settings) {
          // Force 'system' theme to 'dark' — system detection causes
          // white cards on dark backgrounds when OS is in light mode
          if (settings.theme === 'system') {
            settings.theme = 'dark';
          }
          dispatch({ type: 'SET_SETTINGS', settings });
        }
        dispatch({ type: 'SET_RECENT_REPOS', repos: recentRepos });
        if (savedToken) {
          dispatch({ type: 'SET_GITHUB_TOKEN', token: savedToken });
        }
      } catch {
        // Persistence unavailable, use defaults
      }
      dispatch({ type: 'SET_LOADED' });
    })();
  }, []);

  // Persist settings changes
  useEffect(() => {
    if (state.loaded) {
      saveSettings(state.settings).catch(() => {});
    }
  }, [state.settings, state.loaded]);

  // Apply theme — dark is the default base, .light overrides
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (state.settings.theme === 'light') {
      root.classList.add('light');
    } else if (state.settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const apply = () => {
        root.classList.remove('light');
        if (mq.matches) root.classList.add('light');
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    // 'dark' = no class needed, it's the default
  }, [state.settings.theme]);

  const addRecentRepo = useCallback((repo: RecentRepo) => {
    dispatch({ type: 'ADD_RECENT_REPO', repo });
    saveRecentRepo(repo).catch(() => {});
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, addRecentRepo }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
