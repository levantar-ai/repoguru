import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

/** A single tab in the studio. `kind === 'launcher'` shows the tile
 *  picker; any other kind shows a host-specific page. The host owns
 *  the kind vocabulary — TabsProvider treats it as an opaque string
 *  so web and desktop can use different page sets. */
export interface Tab {
  id: string;
  kind: string;
  /** Optional repo slug or path the tab was opened with. */
  repo?: string;
  /** Human-readable tab title shown in the tab strip. */
  title: string;
}

interface TabsState {
  tabs: Tab[];
  activeId: string;
}

type TabsAction =
  | { type: 'OPEN_TAB'; kind: string; repo?: string; activate?: boolean; title: string }
  | { type: 'REPLACE_ACTIVE'; kind: string; repo?: string; title: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'CLOSE'; id: string }
  | { type: 'SET_TITLE'; id: string; title: string }
  | { type: 'SET_REPO'; id: string; repo: string }
  | { type: 'HYDRATE'; state: TabsState };

function newId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function makeReducer() {
  return function reducer(state: TabsState, action: TabsAction): TabsState {
    switch (action.type) {
      case 'OPEN_TAB': {
        const t: Tab = { id: newId(), kind: action.kind, repo: action.repo, title: action.title };
        return {
          tabs: [...state.tabs, t],
          activeId: action.activate === false ? state.activeId : t.id,
        };
      }
      case 'REPLACE_ACTIVE': {
        const tabs = state.tabs.map((t) =>
          t.id === state.activeId
            ? { ...t, kind: action.kind, repo: action.repo, title: action.title }
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
        if (state.tabs.length === 1) {
          // Closing the last tab spawns a fresh launcher so the user
          // never lands on an empty app.
          const t: Tab = { id: newId(), kind: 'launcher', title: 'New Tab' };
          return { tabs: [t], activeId: t.id };
        }
        const tabs = state.tabs.filter((t) => t.id !== action.id);
        let activeId = state.activeId;
        if (state.activeId === action.id) {
          activeId = (tabs[idx] ?? tabs[idx - 1] ?? tabs[0]).id;
        }
        return { tabs, activeId };
      }
      case 'SET_TITLE':
        return {
          ...state,
          tabs: state.tabs.map((t) => (t.id === action.id ? { ...t, title: action.title } : t)),
        };
      case 'SET_REPO':
        return {
          ...state,
          tabs: state.tabs.map((t) => (t.id === action.id ? { ...t, repo: action.repo } : t)),
        };
      case 'HYDRATE':
        return action.state;
    }
  };
}

interface TabsContextValue {
  state: TabsState;
  /** Add a new tab. Defaults to becoming the active tab. */
  openTab: (kind: string, opts?: { repo?: string; activate?: boolean }) => void;
  /** Replace the currently-active tab's kind/repo/title — used when
   *  the user picks a tile from the launcher. */
  replaceActive: (kind: string, repo?: string) => void;
  setActive: (id: string) => void;
  close: (id: string) => void;
  setTitle: (id: string, title: string) => void;
  setRepo: (id: string, repo: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProviderProps {
  /** Resolve a tab title from its kind + optional repo. The host
   *  owns the kind vocabulary; this lets each platform render its
   *  own labels (e.g. "Report Card" on web, "Score" on desktop). */
  titleFor: (kind: string, repo?: string) => string;
  /** Persistence key for localStorage. Defaults to "repoguru:tabs"
   *  on web; pass a different key for desktop so the two surfaces
   *  don't share state if they ever run side by side. */
  storageKey?: string;
  children: ReactNode;
}

export function TabsProvider({ titleFor, storageKey = 'repoguru:tabs', children }: TabsProviderProps) {
  const reducer = useMemo(makeReducer, []);
  const initial = useMemo<TabsState>(() => {
    const t: Tab = { id: newId(), kind: 'launcher', title: titleFor('launcher') };
    return { tabs: [t], activeId: t.id };
  }, [titleFor]);
  const [state, dispatch] = useReducer(reducer, initial);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TabsState;
      if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return;
      const valid: Tab[] = parsed.tabs
        .filter((t): t is Tab => !!t && typeof t.id === 'string' && typeof t.kind === 'string')
        .map((t) => ({ ...t, title: t.title || titleFor(t.kind, t.repo) }));
      if (valid.length === 0) return;
      const activeId = valid.find((t) => t.id === parsed.activeId)?.id ?? valid[0].id;
      dispatch({ type: 'HYDRATE', state: { tabs: valid, activeId } });
    } catch { /* drop saved state */ }
  }, [storageKey, titleFor]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch { /* ignore quota */ }
  }, [state, storageKey]);

  // ⌘T new tab, ⌘W close active.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        dispatch({ type: 'OPEN_TAB', kind: 'launcher', title: titleFor('launcher') });
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        dispatch({ type: 'CLOSE', id: state.activeId });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.activeId, titleFor]);

  const value = useMemo<TabsContextValue>(
    () => ({
      state,
      openTab: (kind, opts) =>
        dispatch({
          type: 'OPEN_TAB',
          kind,
          repo: opts?.repo,
          activate: opts?.activate,
          title: titleFor(kind, opts?.repo),
        }),
      replaceActive: (kind, repo) =>
        dispatch({ type: 'REPLACE_ACTIVE', kind, repo, title: titleFor(kind, repo) }),
      setActive: (id) => dispatch({ type: 'SET_ACTIVE', id }),
      close: (id) => dispatch({ type: 'CLOSE', id }),
      setTitle: (id, title) => dispatch({ type: 'SET_TITLE', id, title }),
      setRepo: (id, repo) => dispatch({ type: 'SET_REPO', id, repo }),
    }),
    [state, titleFor],
  );

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used within TabsProvider');
  return ctx;
}

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
  tab: { id: '', kind: 'home', title: '' },
  setTitle: () => {},
  setRepo: () => {},
};

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentTab() {
  return useContext(CurrentTabContext) ?? NULL_TAB_VALUE;
}

// ───────────────────────── Tile launcher ─────────────────────────

export interface TileDef {
  /** The tab kind that gets opened when the user clicks this tile. */
  kind: string;
  title: string;
  description: string;
  /** Heroicons-style stroke path. */
  d: string;
}

export interface TileLauncherProps {
  tiles: TileDef[];
  /** Top-of-launcher subtitle. Defaults to a generic studio pitch. */
  subtitle?: string;
  /** Optional banner rendered above the tiles (e.g. a privacy strip). */
  banner?: ReactNode;
}

export function TileLauncher({ tiles, subtitle, banner }: TileLauncherProps) {
  const { replaceActive } = useTabs();
  return (
    <div className="w-full max-w-5xl mx-auto px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-semibold text-text tracking-tight">
          Repo<span className="text-text-secondary">Guru Studio</span>
        </h1>
        {subtitle && (
          <p className="mt-3 text-base text-text-secondary max-w-xl mx-auto">{subtitle}</p>
        )}
        {banner && <div className="mt-4">{banner}</div>}
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        role="grid"
        aria-label="Choose a tool"
      >
        {tiles.map((tile) => (
          <button
            key={tile.kind}
            type="button"
            onClick={() => replaceActive(tile.kind)}
            className="group text-left p-5 rounded-xl border border-border bg-surface-alt hover:border-neon/40 hover:bg-surface-hover/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon focus-visible:outline-offset-2"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="rounded-lg bg-surface border border-border p-2 text-text-secondary group-hover:text-neon transition-colors shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tile.d} />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-text">{tile.title}</div>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{tile.description}</p>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center text-xs text-text-muted">
        <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">⌘T</kbd> new tab ·{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">⌘W</kbd> close tab ·{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">⌘K</kbd> command palette
      </div>
    </div>
  );
}

// ───────────────────────── Tab bar ─────────────────────────

export interface TabBarProps {
  /** Resolve a glyph SVG path for a given tab kind. The launcher
   *  always uses a "+" icon regardless. */
  iconForKind: (kind: string) => string;
  /** Wordmark / logo rendered on the left edge of the tab bar. The
   *  shared chrome doesn't ship branding assets — each host supplies
   *  its own (web uses /logo.png, desktop uses an inline SVG since
   *  Electron's file:// protocol won't resolve absolute paths). */
  wordmark?: ReactNode;
  /** Optional content rendered on the right edge of the tab bar
   *  (e.g. @user identity, settings button, theme toggle). */
  rightRail?: ReactNode;
}

const DEFAULT_WORDMARK: ReactNode = (
  <span className="inline-flex items-center gap-2">
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-neon"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M9 10l3 3 3-3" />
    </svg>
    <span className="hidden sm:inline">RepoGuru</span>
  </span>
);

export function TabBar({ iconForKind, wordmark = DEFAULT_WORDMARK, rightRail }: TabBarProps) {
  const { state, openTab, setActive, close } = useTabs();
  const launcherIcon = 'M12 4v16m8-8H4';

  return (
    // Tab strip mounts as a single bar with a bottom border. The
    // active tab covers a 1px slice of that border (via `top-px` on
    // the tab body + matching surface colour) so it visually merges
    // with the content area below — the conventional Chrome /
    // VS Code shape.
    <div className="relative flex items-end gap-1 px-2 pt-1.5 h-10 bg-surface-alt border-b border-border">
      <button
        type="button"
        onClick={() => openTab('launcher')}
        className="flex items-center pl-1 pr-3 pb-1 text-sm font-semibold text-text hover:text-neon transition-colors"
        aria-label="RepoGuru — open new tab"
      >
        {wordmark}
      </button>

      <div role="tablist" aria-label="Open sessions" className="flex-1 flex items-end gap-0.5 overflow-x-auto">
        {state.tabs.map((tab) => {
          const isActive = tab.id === state.activeId;
          const d = tab.kind === 'launcher' ? launcherIcon : iconForKind(tab.kind);
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`group relative flex items-center gap-1.5 max-w-[220px] h-8 pl-3 pr-1.5 text-sm transition-colors ${
                isActive
                  ? // Active: same bg as the content area, top-rounded,
                    // 1px border on top/left/right that visually steps
                    // up out of the bar; -mb-px slides it down to cover
                    // the bar's bottom border. No bottom border on the
                    // tab itself — that's how it "merges" with content.
                    'bg-surface text-text rounded-t-md border-t border-l border-r border-border -mb-px'
                  : // Inactive: subtle hover lift, no chrome — looks
                    // recessed compared to the active tab.
                    'text-text-secondary hover:bg-surface-hover/40 hover:text-text rounded-t-md'
              }`}
            >
              <button
                type="button"
                onClick={() => setActive(tab.id)}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left h-full"
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={d} />
                </svg>
                <span className="truncate">{tab.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  close(tab.id);
                }}
                aria-label={`Close ${tab.title}`}
                className={`shrink-0 p-0.5 rounded hover:bg-surface-hover hover:text-text transition-colors ${
                  isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-70 focus:opacity-100'
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => openTab('launcher')}
          aria-label="New tab"
          className="ml-1 mb-1 p-1 rounded-md text-text-muted hover:text-neon hover:bg-surface-hover/50 transition-colors"
          title="New tab (⌘T)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {rightRail && (
        <div className="flex items-center gap-1 pl-2 pb-1 ml-2 border-l border-border">{rightRail}</div>
      )}
    </div>
  );
}
