import type { Tab } from '../../context/TabsContext';
import { useTabs } from '../../context/TabsContext';
import { useApp } from '../../context/AppContext';

/** Iconography for the tab strip — small glyph beside the title so the
 *  user can tell tabs apart at a glance even when many are open. Path
 *  data mirrors the launcher tiles + sidebar nav so visuals stay
 *  consistent. */
const TAB_ICONS: Record<Tab['kind'], string> = {
  launcher:    'M12 4v16m8-8H4', // plus
  home:        'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  'git-stats': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  'tech-detect': 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  compare:     'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  'org-scan':  'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5',
  policy:      'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622',
  portfolio:   'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  discover:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  docs:        'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253',
};

export function TabBar() {
  const { state, openTab, setActive, close } = useTabs();
  const { state: appState, dispatch } = useApp();

  return (
    <div className="flex items-center gap-1 px-2 h-11 border-b border-border bg-surface-alt">
      {/* Wordmark — clicking opens a fresh launcher tab */}
      <button
        type="button"
        onClick={() => openTab('launcher')}
        className="flex items-center gap-2 pl-2 pr-3 py-1 text-sm font-semibold text-text hover:text-neon transition-colors"
        aria-label="RepoGuru — open new tab"
      >
        <img src="/logo.png" alt="" className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">RepoGuru</span>
      </button>

      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Open sessions"
        className="flex-1 flex items-center gap-0.5 overflow-x-auto"
      >
        {state.tabs.map((tab) => {
          const isActive = tab.id === state.activeId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`group flex items-center gap-1.5 max-w-[220px] pl-2.5 pr-1 py-1 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-surface text-text border border-border'
                  : 'text-text-secondary hover:bg-surface-hover/50 hover:text-text border border-transparent'
              }`}
            >
              <button
                type="button"
                onClick={() => setActive(tab.id)}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={TAB_ICONS[tab.kind]} />
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
          className="ml-1 p-1.5 rounded-md text-text-muted hover:text-neon hover:bg-surface-hover/50 transition-colors"
          title="New tab (⌘T)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Right rail — settings + auth identity */}
      <div className="flex items-center gap-1 pl-2 border-l border-border">
        {appState.githubUser ? (
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
            className="flex items-center gap-2 px-2 py-1 rounded-md text-text-secondary hover:text-text hover:bg-surface-hover/50 transition-colors"
            aria-label={`Connected as @${appState.githubUser.login} — open settings`}
          >
            {appState.githubUser.avatarUrl ? (
              <img
                src={appState.githubUser.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full"
                aria-hidden="true"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-surface-hover" aria-hidden="true" />
            )}
            <span className="hidden sm:inline text-xs font-medium">@{appState.githubUser.login}</span>
            {appState.rateLimit && (
              <span
                className="hidden md:inline px-1.5 py-0.5 rounded text-[10px] tabular-nums shrink-0"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color:
                    appState.rateLimit.remaining < 10
                      ? 'var(--color-grade-f)'
                      : 'var(--color-text-muted)',
                }}
              >
                {appState.rateLimit.remaining}
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-text-secondary hover:text-neon transition-colors"
            aria-label="Open settings"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}
      </div>
    </div>
  );
}
