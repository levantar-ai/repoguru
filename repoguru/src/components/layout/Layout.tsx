import { type ReactNode } from 'react';
import type { PageId } from '../../types';
import { ThemeToggle } from './ThemeToggle';
import { useApp } from '../../context/AppContext';
import { trackEvent } from '../../utils/analytics';

interface Props {
  children: ReactNode;
  onNavigate: (page: PageId) => void;
  currentPage: string;
}

interface NavItem {
  id: PageId;
  label: string;
  /** Heroicons-style stroke path for the side icon. */
  d: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Report Card',
    d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 'git-stats',
    label: 'Git Stats',
    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    id: 'tech-detect',
    label: 'Tech Detect',
    d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  {
    id: 'compare',
    label: 'Compare',
    d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    id: 'org-scan',
    label: 'Org Scan',
    d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    id: 'policy',
    label: 'Policy',
    d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    id: 'discover',
    label: 'Discover',
    d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    id: 'docs',
    label: 'Docs',
    d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
];

/**
 * App shell with a fixed-width left sidebar nav. Mirrors the desktop
 * Electron build (.../repoguru-spec/electron-app/repoguru-desktop/src/
 * App.tsx) so both apps present the same chrome.
 */
export function Layout({ children, onNavigate, currentPage }: Props) {
  const { state, dispatch } = useApp();

  return (
    <div className="flex h-screen bg-surface text-text bg-gradient-dark">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <nav
        className="w-56 flex-shrink-0 border-r border-border bg-surface-alt flex flex-col"
        aria-label="Main navigation"
      >
        <div className="px-4 py-5 border-b border-border flex items-center justify-between">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 text-left"
            aria-label="Repo Guru — Go to home page"
          >
            <img
              src="/logo.png"
              alt=""
              className="h-8 w-8 object-contain shrink-0"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-text leading-none">
                Repo<span className="text-neon">Guru</span>
              </h1>
              <p className="text-[10px] text-text-muted mt-0.5">In-Browser DevSecOps</p>
            </div>
          </button>
          <ThemeToggle />
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  trackEvent('tool_switch', { target: item.id });
                  onNavigate(item.id);
                }}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${
                  active
                    ? 'bg-surface-hover text-text font-medium border-r-2 border-neon'
                    : 'text-text-secondary hover:text-text hover:bg-surface-hover/50'
                }`}
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
                </svg>
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
            className="text-xs text-text-muted hover:text-neon transition-colors inline-flex items-center gap-1.5"
            aria-label="Open settings"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </button>
          {state.rateLimit && (
            <output
              className="px-1.5 py-0.5 rounded text-[10px] tabular-nums"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color:
                  state.rateLimit.remaining < 10
                    ? 'var(--color-grade-f)'
                    : 'var(--color-text-muted)',
              }}
              aria-label={`GitHub API rate limit: ${state.rateLimit.remaining} of ${state.rateLimit.limit} requests remaining`}
            >
              {state.rateLimit.remaining}/{state.rateLimit.limit}
            </output>
          )}
        </div>
      </nav>

      <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
