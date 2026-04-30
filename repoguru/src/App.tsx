import { useState, useCallback, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { BrowserServicesProvider } from './services/BrowserServicesProvider';
import { Layout } from './components/layout/Layout';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { LoadingScreen } from './components/common/LoadingScreen';
import { ReportCardPage, CommandPalette, type PaletteCommand } from '@repoguru/ui';
import { trackPageView, trackEvent } from './utils/analytics';
import {
  handleOAuthCallback,
  handleInstallationCallback,
  isInstallationCallback,
  getInstallationManageUrl,
} from './utils/oauth';
import { saveGithubToken } from './services/persistence/credentials';
import { fetchInstallations } from './services/github/org';
import type { PageId } from './types';

// Lazy-load heavier pages for code splitting
const HowItWorksPage = lazy(() =>
  import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })),
);
const OrgScanPage = lazy(() =>
  import('@repoguru/ui').then((m) => ({ default: m.OrgScanPage })),
);
// ComparePage now lives in @repoguru/ui — both the browser and the
// desktop mount the same React component. The browser wires a
// BrowserServices implementation via <RepoGuruProvider>; the desktop
// wires a gRPC-backed DesktopServices.
const ComparePage = lazy(() =>
  import('@repoguru/ui').then((m) => ({ default: m.ComparePage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })),
);
const DiscoverPage = lazy(() =>
  import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })),
);
const PolicyPage = lazy(() =>
  import('@repoguru/ui').then((m) => ({ default: m.PolicyPage })),
);
const GitStatsPage = lazy(() =>
  import('@repoguru/ui').then((m) => ({ default: m.GitStatsPage })),
);
const TechDetectPage = lazy(() =>
  import('@repoguru/ui').then((m) => ({ default: m.TechDetectPage })),
);

function OAuthToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    // role=status + aria-live=polite so the OAuth-success toast is
    // announced (most NVDA/JAWS configs surface polite live updates
    // even on a fixed-position element). aria-atomic=true so the whole
    // message is read each time it changes.
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-grade-a/10 border border-grade-a/30 text-sm text-grade-a shadow-lg">
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {message}
      </div>
    </div>
  );
}

function AppContent() {
  const [page, setPage] = useState<PageId>('home');
  const [visitedPages, setVisitedPages] = useState<Set<PageId>>(() => new Set(['home']));
  const [pendingRepo, setPendingRepo] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') || params.has('setup_action');
  });
  const [oauthToast, setOauthToast] = useState<string | null>(null);
  const { state: appState, dispatch } = useApp();
  const token = appState.githubToken || '';

  const handleNavigate = useCallback((targetPage: PageId) => {
    setPendingRepo(null);
    setVisitedPages((prev) => (prev.has(targetPage) ? prev : new Set(prev).add(targetPage)));
    setPage(targetPage);
  }, []);

  const handleNavigateWithRepo = useCallback((targetPage: PageId, repo: string) => {
    setPendingRepo(repo);
    setVisitedPages((prev) => (prev.has(targetPage) ? prev : new Set(prev).add(targetPage)));
    setPage(targetPage);
  }, []);

  useEffect(() => {
    trackPageView(page);
  }, [page]);

  // Handle OAuth or installation callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('code') && !params.has('setup_action')) return;

    const handleCallback = isInstallationCallback()
      ? handleInstallationCallback()
      : handleOAuthCallback();

    handleCallback
      .then(async (accessToken) => {
        if (accessToken) {
          dispatch({ type: 'SET_GITHUB_TOKEN', token: accessToken });
          await saveGithubToken(accessToken);
          trackEvent('token_added', {
            method: isInstallationCallback() ? 'installation' : 'oauth',
          });
        }

        if (isInstallationCallback()) {
          setOauthToast('Organization access updated!');
        } else if (accessToken) {
          // After OAuth, check for installations — if none, open the org picker
          const manageUrl = getInstallationManageUrl();
          if (manageUrl) {
            try {
              const installs = await fetchInstallations(accessToken);
              if (installs.length === 0) {
                window.open(manageUrl, '_blank');
                setOauthToast('Connected! Select which organizations to grant access to.');
                return;
              }
            } catch {
              // Ignore — still connected, just skip the auto-redirect
            }
          }
          setOauthToast('Connected to GitHub!');
        }
      })
      .catch((err) => {
        console.error('OAuth callback failed:', err);
        setOauthToast(err instanceof Error ? err.message : 'OAuth sign-in failed.');
      })
      .finally(() => setOauthLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (oauthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-text-secondary">
          <svg className="h-5 w-5 text-neon animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Connecting to GitHub...
        </div>
      </div>
    );
  }

  // ⌘K command palette: jump to nav destinations + recents + settings
  // actions. Tools mirror the sidebar one-for-one. Actions surface
  // settings + theme toggle so power users never have to mouse.
  const paletteTools: Omit<PaletteCommand, 'group'>[] = [
    { id: 't:home',        label: 'Report Card',  shortcut: 'g r', onSelect: () => handleNavigate('home') },
    { id: 't:git-stats',   label: 'Git Stats',    shortcut: 'g s', onSelect: () => handleNavigate('git-stats') },
    { id: 't:tech-detect', label: 'Tech Stack',   shortcut: 'g t', onSelect: () => handleNavigate('tech-detect') },
    { id: 't:compare',     label: 'Compare',      shortcut: 'g c', onSelect: () => handleNavigate('compare') },
    { id: 't:org-scan',    label: 'Org Scan',     shortcut: 'g o', onSelect: () => handleNavigate('org-scan') },
    { id: 't:policy',      label: 'Policy',                       onSelect: () => handleNavigate('policy') },
    { id: 't:portfolio',   label: 'Portfolio',    shortcut: 'g p', onSelect: () => handleNavigate('portfolio') },
    { id: 't:discover',    label: 'Search',                       onSelect: () => handleNavigate('discover') },
    { id: 't:docs',        label: 'Help',                         onSelect: () => handleNavigate('docs') },
  ];
  const paletteActions: Omit<PaletteCommand, 'group'>[] = [
    { id: 'a:settings', label: 'Open Settings', onSelect: () => dispatch({ type: 'TOGGLE_SETTINGS' }) },
    {
      id: 'a:theme',
      label: appState.settings.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme',
      onSelect: () =>
        dispatch({
          type: 'SET_THEME',
          theme: appState.settings.theme === 'light' ? 'dark' : 'light',
        }),
    },
  ];

  // The palette dispatches a custom event when a recents row is picked
  // — bring the user back to Report Card with the slug pre-filled.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ value: string }>).detail;
      if (detail?.value) {
        handleNavigateWithRepo('home', detail.value);
      }
    };
    window.addEventListener('repoguru:palette-pick-repo', onPick);
    return () => window.removeEventListener('repoguru:palette-pick-repo', onPick);
  }, [handleNavigateWithRepo]);

  return (
    <Layout onNavigate={handleNavigate} currentPage={page}>
      <CommandPalette tools={paletteTools} actions={paletteActions} />
      {oauthToast && <OAuthToast message={oauthToast} onDone={() => setOauthToast(null)} />}
      <PageMount active={page === 'home'}>
        <ReportCardPage initialRepo={pendingRepo ?? undefined} />
      </PageMount>
      <PageMount active={page === 'docs'}>
        {visitedPages.has('docs') && (
          <Suspense fallback={<LoadingScreen />}>
            <HowItWorksPage />
          </Suspense>
        )}
      </PageMount>
      <PageMount active={page === 'org-scan'}>
        {visitedPages.has('org-scan') && (
          <Suspense fallback={<LoadingScreen />}>
            <OrgScanPage />
          </Suspense>
        )}
      </PageMount>
      <PageMount active={page === 'compare'}>
        {visitedPages.has('compare') && (
          <Suspense fallback={<LoadingScreen />}>
            <ComparePage />
          </Suspense>
        )}
      </PageMount>
      <PageMount active={page === 'portfolio'}>
        {visitedPages.has('portfolio') && (
          <Suspense fallback={<LoadingScreen />}>
            <PortfolioPage
              onAnalyze={() => handleNavigate('home')}
              githubToken={token}
              defaultUsername={appState.githubUser?.login}
            />
          </Suspense>
        )}
      </PageMount>
      <PageMount active={page === 'discover'}>
        {visitedPages.has('discover') && (
          <Suspense fallback={<LoadingScreen />}>
            <DiscoverPage
              onNavigate={handleNavigate as (page: string) => void}
              onSendToTool={handleNavigateWithRepo}
            />
          </Suspense>
        )}
      </PageMount>
      <PageMount active={page === 'policy'}>
        {visitedPages.has('policy') && (
          <Suspense fallback={<LoadingScreen />}>
            <PolicyPage />
          </Suspense>
        )}
      </PageMount>
      <PageMount active={page === 'git-stats'}>
        {visitedPages.has('git-stats') && (
          <Suspense fallback={<LoadingScreen />}>
            <GitStatsPage />
          </Suspense>
        )}
      </PageMount>
      <PageMount active={page === 'tech-detect'}>
        {visitedPages.has('tech-detect') && (
          <Suspense fallback={<LoadingScreen />}>
            <TechDetectPage />
          </Suspense>
        )}
      </PageMount>
    </Layout>
  );
}

/** Wraps a page so the inactive ones are hidden visually AND removed
 *  from the accessibility tree + focus order. The previous pattern
 *  (display: none) hid them from sighted users but DOM-walking ATs
 *  (JAWS browse mode, VoiceOver) still read every cached page's H1
 *  and landmarks — fails WCAG 1.3.1 / 2.4.6 / 4.1.2. `inert` (baseline
 *  in all evergreen browsers) makes the subtree unreachable for AT,
 *  focus, and pointer events; we keep `display:none` so it doesn't
 *  contribute layout. */
function PageMount({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div style={{ display: active ? undefined : 'none' }} inert={!active || undefined}>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AnalysisProvider>
        <BrowserServicesProvider>
          <AppContent />
          <SettingsPanel />
        </BrowserServicesProvider>
      </AnalysisProvider>
    </AppProvider>
  );
}
