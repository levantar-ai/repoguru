import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { BrowserServicesProvider } from './services/BrowserServicesProvider';
import { Layout } from './components/layout/Layout';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { LoadingScreen } from './components/common/LoadingScreen';
import { ReportCardPage } from '@repoguru/ui';
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

  return (
    <Layout onNavigate={handleNavigate} currentPage={page}>
      {oauthToast && <OAuthToast message={oauthToast} onDone={() => setOauthToast(null)} />}
      <div style={{ display: page === 'home' ? undefined : 'none' }}>
        <ReportCardPage initialRepo={pendingRepo ?? undefined} />
      </div>
      <div style={{ display: page === 'docs' ? undefined : 'none' }}>
        {visitedPages.has('docs') && (
          <Suspense fallback={<LoadingScreen />}>
            <HowItWorksPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: page === 'org-scan' ? undefined : 'none' }}>
        {visitedPages.has('org-scan') && (
          <Suspense fallback={<LoadingScreen />}>
            <OrgScanPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: page === 'compare' ? undefined : 'none' }}>
        {visitedPages.has('compare') && (
          <Suspense fallback={<LoadingScreen />}>
            <ComparePage />
          </Suspense>
        )}
      </div>
      <div style={{ display: page === 'portfolio' ? undefined : 'none' }}>
        {visitedPages.has('portfolio') && (
          <Suspense fallback={<LoadingScreen />}>
            <PortfolioPage onAnalyze={() => handleNavigate('home')} githubToken={token} />
          </Suspense>
        )}
      </div>
      <div style={{ display: page === 'discover' ? undefined : 'none' }}>
        {visitedPages.has('discover') && (
          <Suspense fallback={<LoadingScreen />}>
            <DiscoverPage
              onNavigate={handleNavigate as (page: string) => void}
              onSendToTool={handleNavigateWithRepo}
            />
          </Suspense>
        )}
      </div>
      <div style={{ display: page === 'policy' ? undefined : 'none' }}>
        {visitedPages.has('policy') && (
          <Suspense fallback={<LoadingScreen />}>
            <PolicyPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: page === 'git-stats' ? undefined : 'none' }}>
        {visitedPages.has('git-stats') && (
          <Suspense fallback={<LoadingScreen />}>
            <GitStatsPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: page === 'tech-detect' ? undefined : 'none' }}>
        {visitedPages.has('tech-detect') && (
          <Suspense fallback={<LoadingScreen />}>
            <TechDetectPage />
          </Suspense>
        )}
      </div>
    </Layout>
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
