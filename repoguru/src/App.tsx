import { useEffect, lazy, Suspense, type ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import { AppProvider, useApp } from './context/AppContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { BrowserServicesProvider } from './services/BrowserServicesProvider';
import {
  TabsProvider,
  useTabs,
  CurrentTabProvider,
  type Tab,
} from './context/TabsContext';
import { TabBar } from './components/tabs/TabBar';
import { TileLauncher } from './components/tabs/TileLauncher';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { LoadingScreen } from './components/common/LoadingScreen';
import { ReportCardPage, CommandPalette, TooltipProvider, type PaletteCommand } from '@repoguru/ui';
import { trackEvent } from './utils/analytics';
import {
  handleOAuthCallback,
  handleInstallationCallback,
  isInstallationCallback,
  getInstallationManageUrl,
} from './utils/oauth';
import { saveGithubToken } from './services/persistence/credentials';
import { fetchInstallations } from './services/github/org';

// Lazy-load heavier pages for code splitting
const HowItWorksPage = lazy(() =>
  import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })),
);
const OrgScanPage = lazy(() =>
  import('@repoguru/ui').then((m) => ({ default: m.OrgScanPage })),
);
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

function AppContent() {
  const { state: tabsState, openTab, replaceActive } = useTabs();
  const { state: appState, dispatch } = useApp();
  const token = appState.githubToken || '';

  // OAuth callback handling — fires once on mount when ?code= is in URL.
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
          toast.success('Organization access updated');
        } else if (accessToken) {
          const manageUrl = getInstallationManageUrl();
          if (manageUrl) {
            try {
              const installs = await fetchInstallations(accessToken);
              if (installs.length === 0) {
                window.open(manageUrl, '_blank');
                toast.info('Connected — select which organisations to grant access to.');
                return;
              }
            } catch {
              /* still connected, skip auto-redirect */
            }
          }
          toast.success('Connected to GitHub');
        }
      })
      .catch((err) => {
        console.error('OAuth callback failed:', err);
        toast.error(err instanceof Error ? err.message : 'OAuth sign-in failed.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘K palette tools — pick a tool spawns a fresh tab so the user
  // never loses an in-flight session by switching tools.
  const paletteTools: Omit<PaletteCommand, 'group'>[] = [
    { id: 't:home',        label: 'Report Card',  shortcut: 'g r', onSelect: () => openTab('home') },
    { id: 't:git-stats',   label: 'Git Stats',    shortcut: 'g s', onSelect: () => openTab('git-stats') },
    { id: 't:tech-detect', label: 'Tech Stack',   shortcut: 'g t', onSelect: () => openTab('tech-detect') },
    { id: 't:compare',     label: 'Compare',      shortcut: 'g c', onSelect: () => openTab('compare') },
    { id: 't:org-scan',    label: 'Org Scan',     shortcut: 'g o', onSelect: () => openTab('org-scan') },
    { id: 't:policy',      label: 'Policy',                       onSelect: () => openTab('policy') },
    { id: 't:portfolio',   label: 'Portfolio',    shortcut: 'g p', onSelect: () => openTab('portfolio') },
    { id: 't:discover',    label: 'Search',                       onSelect: () => openTab('discover') },
    { id: 't:docs',        label: 'Help',                         onSelect: () => openTab('docs') },
  ];
  const paletteActions: Omit<PaletteCommand, 'group'>[] = [
    { id: 'a:new-tab',  label: 'New Tab',          shortcut: '⌘T', onSelect: () => openTab('launcher') },
    { id: 'a:settings', label: 'Open Settings',                    onSelect: () => dispatch({ type: 'TOGGLE_SETTINGS' }) },
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

  // Recents palette pick → open the slug in a fresh Report Card tab.
  // Replaces the old "navigate active page" behaviour — under tabs the
  // user expects each pick to be a separate session.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ value: string }>).detail;
      if (detail?.value) openTab('home', { repo: detail.value });
    };
    window.addEventListener('repoguru:palette-pick-repo', onPick);
    return () => window.removeEventListener('repoguru:palette-pick-repo', onPick);
  }, [openTab]);

  return (
    <div className="flex flex-col h-screen bg-surface text-text bg-gradient-dark">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <CommandPalette tools={paletteTools} actions={paletteActions} />
      <TabBar />
      <main
        id="main-content"
        className="flex-1 overflow-y-auto"
        tabIndex={-1}
      >
        {tabsState.tabs.map((tab) => (
          <TabContent
            key={tab.id}
            tab={tab}
            active={tab.id === tabsState.activeId}
            token={token}
            defaultUsername={appState.githubUser?.login}
            onSendRepoToReportCard={(repo) => replaceActive('home', repo)}
          />
        ))}
      </main>
    </div>
  );
}

interface TabContentProps {
  tab: Tab;
  active: boolean;
  token: string;
  defaultUsername?: string;
  onSendRepoToReportCard: (repo: string) => void;
}

/** Renders one tab's page in a hidden+inert wrapper so inactive tabs
 *  preserve their state (in-flight scans, partial input) without
 *  showing in the AT tree. Each tab is a fresh React subtree (keyed on
 *  tab.id at the parent) — that's how multiple instances of the same
 *  page kind keep their state independent. */
function TabContent({
  tab,
  active,
  token,
  defaultUsername,
  onSendRepoToReportCard,
}: TabContentProps) {
  return (
    <div
      style={{ display: active ? undefined : 'none' }}
      inert={!active || undefined}
      role="tabpanel"
      aria-label={tab.title}
    >
      <CurrentTabProvider tab={tab}>
        {renderTab(tab, { token, defaultUsername, onSendRepoToReportCard })}
      </CurrentTabProvider>
    </div>
  );
}

function renderTab(
  tab: Tab,
  ctx: { token: string; defaultUsername?: string; onSendRepoToReportCard: (repo: string) => void },
): ReactNode {
  switch (tab.kind) {
    case 'launcher':
      return <TileLauncher />;
    case 'home':
      return <ReportCardPage initialRepo={tab.repo} />;
    case 'docs':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <HowItWorksPage />
        </Suspense>
      );
    case 'org-scan':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <OrgScanPage />
        </Suspense>
      );
    case 'compare':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <ComparePage />
        </Suspense>
      );
    case 'portfolio':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <PortfolioPage
            onAnalyze={() => {/* no-op under tabs — user closes manually */}}
            githubToken={ctx.token}
            defaultUsername={ctx.defaultUsername}
          />
        </Suspense>
      );
    case 'discover':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <DiscoverPage
            onNavigate={() => {/* no-op under tabs */}}
            onSendToTool={(_, repo) => ctx.onSendRepoToReportCard(repo)}
          />
        </Suspense>
      );
    case 'policy':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <PolicyPage />
        </Suspense>
      );
    case 'git-stats':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <GitStatsPage />
        </Suspense>
      );
    case 'tech-detect':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <TechDetectPage />
        </Suspense>
      );
  }
}

export default function App() {
  return (
    <AppProvider>
      <AnalysisProvider>
        <BrowserServicesProvider>
          <TooltipProvider>
            <TabsProvider>
              <AppContent />
              <SettingsPanel />
              <Toaster
                position="top-center"
                theme="dark"
                closeButton
                richColors
                toastOptions={{ className: 'tabular-nums' }}
              />
            </TabsProvider>
          </TooltipProvider>
        </BrowserServicesProvider>
      </AnalysisProvider>
    </AppProvider>
  );
}
