import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { Layout } from './components/layout/Layout';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { LoadingScreen } from './components/common/LoadingScreen';
import { HomePage } from './pages/HomePage';
import { trackPageView, trackEvent } from './utils/analytics';
import { handleOAuthCallback } from './utils/oauth';
import { saveGithubToken } from './services/persistence/credentials';
import type { PageId } from './types';

// Lazy-load heavier pages for code splitting
const HowItWorksPage = lazy(() =>
  import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })),
);
const OrgScanPage = lazy(() =>
  import('./pages/OrgScanPage').then((m) => ({ default: m.OrgScanPage })),
);
const ComparePage = lazy(() =>
  import('./pages/ComparePage').then((m) => ({ default: m.ComparePage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })),
);
const DiscoverPage = lazy(() =>
  import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })),
);
const PolicyPage = lazy(() =>
  import('./pages/PolicyPage').then((m) => ({ default: m.PolicyPage })),
);
const GitStatsPage = lazy(() =>
  import('./pages/GitStatsPage').then((m) => ({ default: m.GitStatsPage })),
);
const TechDetectPage = lazy(() =>
  import('./pages/TechDetectPage').then((m) => ({ default: m.TechDetectPage })),
);

function OAuthToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-grade-a/10 border border-grade-a/30 text-sm text-grade-a shadow-lg">
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
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
  const [pendingRepo, setPendingRepo] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(() =>
    new URLSearchParams(window.location.search).has('code'),
  );
  const [oauthToast, setOauthToast] = useState<string | null>(null);
  const { state: appState, dispatch } = useApp();
  const token = appState.githubToken || '';

  const handleNavigate = useCallback((targetPage: PageId) => {
    setPendingRepo(null);
    setPage(targetPage);
  }, []);

  const handleNavigateWithRepo = useCallback((targetPage: PageId, repo: string) => {
    setPendingRepo(repo);
    setPage(targetPage);
  }, []);

  useEffect(() => {
    trackPageView(page);
  }, [page]);

  // Handle OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('code')) return;

    handleOAuthCallback()
      .then(async (accessToken) => {
        if (accessToken) {
          dispatch({ type: 'SET_GITHUB_TOKEN', token: accessToken });
          await saveGithubToken(accessToken);
          trackEvent('token_added', { method: 'oauth' });
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
      <Suspense fallback={<LoadingScreen />}>
        {page === 'home' && <HomePage onNavigate={handleNavigate} initialRepo={pendingRepo} />}
        {page === 'docs' && <HowItWorksPage />}
        {page === 'org-scan' && (
          <OrgScanPage onAnalyze={() => handleNavigate('home')} githubToken={token} />
        )}
        {page === 'compare' && <ComparePage githubToken={token} />}
        {page === 'portfolio' && (
          <PortfolioPage onAnalyze={() => handleNavigate('home')} githubToken={token} />
        )}
        {page === 'discover' && (
          <DiscoverPage
            onNavigate={handleNavigate as (page: string) => void}
            onSendToTool={handleNavigateWithRepo}
          />
        )}
        {page === 'policy' && <PolicyPage onNavigate={handleNavigate as (page: string) => void} />}
        {page === 'git-stats' && <GitStatsPage initialRepo={pendingRepo} />}
        {page === 'tech-detect' && <TechDetectPage initialRepo={pendingRepo} />}
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AnalysisProvider>
        <AppContent />
        <SettingsPanel />
      </AnalysisProvider>
    </AppProvider>
  );
}
