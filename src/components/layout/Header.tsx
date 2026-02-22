import { useState, useRef, useEffect, useCallback } from 'react';
import type { PageId } from '../../types';
import { ThemeToggle } from './ThemeToggle';
import { useApp } from '../../context/AppContext';

interface Props {
  onNavigate: (page: PageId) => void;
  currentPage: string;
}

function NavIcon({ id }: { id: PageId }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (id) {
    case 'home':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'git-stats':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      );
    case 'org-scan':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      );
    case 'compare':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      );
    case 'portfolio':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    case 'discover':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case 'policy':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case 'tech-detect':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>
      );
    case 'docs':
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      );
    default:
      return null;
  }
}

const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Report Card' },
  { id: 'git-stats', label: 'Git Stats' },
  { id: 'org-scan', label: 'Org Scan' },
  { id: 'compare', label: 'Compare' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'discover', label: 'Discover' },
  { id: 'policy', label: 'Policy' },
  { id: 'tech-detect', label: 'Tech Detect' },
  { id: 'docs', label: 'Docs' },
];

export function Header({ onNavigate, currentPage }: Props) {
  const { state, dispatch } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    },
    [mobileMenuOpen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (mobileMenuOpen && mobileMenuRef.current) {
      const firstButton = mobileMenuRef.current.querySelector('button');
      firstButton?.focus();
    }
  }, [mobileMenuOpen]);

  return (
    <header className="no-print bg-surface/90 backdrop-blur-lg sticky top-0 z-30">
      <div className="px-8 lg:px-12 h-16 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 shrink-0"
            aria-label="Repo Guru — Go to home page"
          >
            <img
              src="/logo.png"
              alt=""
              className="h-14 w-14 object-contain -my-2"
              aria-hidden="true"
            />
            <span className="text-xl font-bold tracking-tight text-text">
              Repo<span className="text-neon neon-text"> Guru</span>
            </span>
          </button>

          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                  currentPage === item.id
                    ? 'text-neon bg-neon/12 shadow-[0_0_8px_rgba(56,189,248,0.15)]'
                    : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                }`}
                aria-current={currentPage === item.id ? 'page' : undefined}
              >
                <NavIcon id={item.id} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <button
            ref={hamburgerRef}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-neon hover:bg-surface-hover transition-all duration-150"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          <ThemeToggle />

          <button
            onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
            className="p-2 rounded-lg text-text-secondary hover:text-neon hover:bg-surface-hover transition-all duration-150"
            aria-label="Open settings"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          {state.rateLimit && (
            <output
              className="hidden md:flex items-center ml-2 px-2.5 py-1 rounded-md text-xs"
              style={{
                background: 'var(--color-surface-alt)',
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
      </div>

      {/* Gradient glow border */}
      <div className="h-px header-glow-border" />

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <section
          id="mobile-nav-menu"
          ref={mobileMenuRef}
          className="lg:hidden border-t border-border bg-surface-alt/95 backdrop-blur-lg"
          aria-label="Mobile navigation"
        >
          <nav className="px-8 lg:px-12 py-3 grid grid-cols-2 gap-1" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg text-left transition-all duration-150 ${
                  currentPage === item.id
                    ? 'text-neon bg-neon/12 shadow-[0_0_8px_rgba(56,189,248,0.15)]'
                    : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                }`}
                aria-current={currentPage === item.id ? 'page' : undefined}
              >
                <NavIcon id={item.id} />
                {item.label}
              </button>
            ))}
          </nav>
        </section>
      )}
    </header>
  );
}
