import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { PageId } from '../types';

/** A single tab's identity. `kind === 'launcher'` shows the tile
 *  picker; any other kind shows the matching page. `repo` and `title`
 *  are populated as the user works inside the tab so the tab strip
 *  reflects what's loaded. */
export interface Tab {
  id: string;
  kind: 'launcher' | PageId;
  /** Optional repo slug or path the tab was opened with — used to
   *  pre-fill the tab's page on first render and to render in the
   *  tab title once an analysis completes. */
  repo?: string;
  /** Human-readable tab title shown in the tab strip. Defaults to
   *  the tool name; pages may update via `useTab().setTitle()`. */
  title: string;
}

interface TabsState {
  tabs: Tab[];
  activeId: string;
}

type TabsAction =
  | { type: 'OPEN_TAB'; kind: Tab['kind']; repo?: string; activate?: boolean }
  | { type: 'REPLACE_ACTIVE'; kind: Tab['kind']; repo?: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'CLOSE'; id: string }
  | { type: 'SET_TITLE'; id: string; title: string }
  | { type: 'SET_REPO'; id: string; repo: string }
  | { type: 'HYDRATE'; state: TabsState };

const STORAGE_KEY = 'repoguru:tabs';

function defaultTitle(kind: Tab['kind']): string {
  switch (kind) {
    case 'launcher':   return 'New Tab';
    case 'home':       return 'Report Card';
    case 'git-stats':  return 'Git Stats';
    case 'tech-detect':return 'Tech Stack';
    case 'compare':    return 'Compare';
    case 'org-scan':   return 'Org Scan';
    case 'policy':     return 'Policy';
    case 'portfolio':  return 'Portfolio';
    case 'discover':   return 'Search';
    case 'docs':       return 'Help';
    default:           return 'New Tab';
  }
}

function newId(): string {
  // Short opaque id — only used as a React key + stable handle.
  return Math.random().toString(36).slice(2, 11);
}

function makeTab(kind: Tab['kind'], repo?: string): Tab {
  return {
    id: newId(),
    kind,
    repo,
    title: repo ? `${defaultTitle(kind)} · ${repo}` : defaultTitle(kind),
  };
}

const INITIAL: TabsState = (() => {
  const t = makeTab('launcher');
  return { tabs: [t], activeId: t.id };
})();

function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'OPEN_TAB': {
      const t = makeTab(action.kind, action.repo);
      return {
        tabs: [...state.tabs, t],
        activeId: action.activate === false ? state.activeId : t.id,
      };
    }
    case 'REPLACE_ACTIVE': {
      const tabs = state.tabs.map((t) =>
        t.id === state.activeId
          ? {
              ...t,
              kind: action.kind,
              repo: action.repo,
              title: action.repo
                ? `${defaultTitle(action.kind)} · ${action.repo}`
                : defaultTitle(action.kind),
            }
          : t,
      );
      return { ...state, tabs };
    }
    case 'SET_ACTIVE':
      return state.tabs.find((t) => t.id === action.id)
        ? { ...state, activeId: action.id }
        : state;
    case 'CLOSE': {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      if (idx === -1) return state;
      // Closing the last tab opens a fresh launcher tab so the user
      // never lands on an empty app.
      if (state.tabs.length === 1) {
        const t = makeTab('launcher');
        return { tabs: [t], activeId: t.id };
      }
      const tabs = state.tabs.filter((t) => t.id !== action.id);
      let activeId = state.activeId;
      if (state.activeId === action.id) {
        activeId = (tabs[idx] ?? tabs[idx - 1] ?? tabs[0]).id;
      }
      return { tabs, activeId };
    }
    case 'SET_TITLE': {
      const tabs = state.tabs.map((t) =>
        t.id === action.id ? { ...t, title: action.title } : t,
      );
      return { ...state, tabs };
    }
    case 'SET_REPO': {
      const tabs = state.tabs.map((t) =>
        t.id === action.id ? { ...t, repo: action.repo } : t,
      );
      return { ...state, tabs };
    }
    case 'HYDRATE':
      return action.state;
  }
}

interface TabsContextValue {
  state: TabsState;
  openTab: (kind: Tab['kind'], opts?: { repo?: string; activate?: boolean }) => void;
  replaceActive: (kind: Tab['kind'], repo?: string) => void;
  setActive: (id: string) => void;
  close: (id: string) => void;
  setTitle: (id: string, title: string) => void;
  setRepo: (id: string, repo: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  // Hydrate from storage exactly once on mount.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TabsState;
      if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return;
      // Validate each tab — drop anything malformed.
      const valid: Tab[] = parsed.tabs
        .filter((t): t is Tab => !!t && typeof t.id === 'string' && typeof t.kind === 'string')
        .map((t) => ({ ...t, title: t.title || defaultTitle(t.kind) }));
      if (valid.length === 0) return;
      const activeId = valid.find((t) => t.id === parsed.activeId)?.id ?? valid[0].id;
      dispatch({ type: 'HYDRATE', state: { tabs: valid, activeId } });
    } catch { /* ignore — drop saved state */ }
  }, []);

  // Persist on every change after the initial hydrate.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore quota errors */ }
  }, [state]);

  // Keyboard shortcuts: ⌘T new tab, ⌘W close active.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        dispatch({ type: 'OPEN_TAB', kind: 'launcher' });
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        dispatch({ type: 'CLOSE', id: state.activeId });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.activeId]);

  const value = useMemo<TabsContextValue>(
    () => ({
      state,
      openTab: (kind, opts) =>
        dispatch({ type: 'OPEN_TAB', kind, repo: opts?.repo, activate: opts?.activate }),
      replaceActive: (kind, repo) => dispatch({ type: 'REPLACE_ACTIVE', kind, repo }),
      setActive: (id) => dispatch({ type: 'SET_ACTIVE', id }),
      close: (id) => dispatch({ type: 'CLOSE', id }),
      setTitle: (id, title) => dispatch({ type: 'SET_TITLE', id, title }),
      setRepo: (id, repo) => dispatch({ type: 'SET_REPO', id, repo }),
    }),
    [state],
  );

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used within TabsProvider');
  return ctx;
}

/** Inside a page's render, get the tab the page is being rendered in
 *  plus a way to update its title. The CurrentTabProvider is mounted
 *  per-tab in App.tsx so each page reads its own tab. */
const CurrentTabContext = createContext<{
  tab: Tab;
  setTitle: (title: string) => void;
  setRepo: (repo: string) => void;
} | null>(null);

export function CurrentTabProvider({ tab, children }: { tab: Tab; children: ReactNode }) {
  const { setTitle, setRepo } = useTabs();
  const value = useMemo(
    () => ({
      tab,
      setTitle: (title: string) => setTitle(tab.id, title),
      setRepo: (repo: string) => setRepo(tab.id, repo),
    }),
    [tab, setTitle, setRepo],
  );
  return <CurrentTabContext.Provider value={value}>{children}</CurrentTabContext.Provider>;
}

const NULL_TAB_VALUE = {
  tab: { id: '', kind: 'home' as Tab['kind'], title: '' },
  setTitle: () => {},
  setRepo: () => {},
};

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentTab() {
  const ctx = useContext(CurrentTabContext);
  // Pages mounted outside of a tab context (legacy / direct usage)
  // get a no-op so they don't crash.
  return ctx ?? NULL_TAB_VALUE;
}
