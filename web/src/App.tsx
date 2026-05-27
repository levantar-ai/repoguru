import { useEffect, useMemo, lazy, Suspense, type ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import { AppProvider, useApp } from './context/AppContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { BrowserServicesProvider } from './services/BrowserServicesProvider';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { LoadingScreen } from './components/common/LoadingScreen';
import {
  ReportCardPage,
  CommandPalette,
  TooltipProvider,
  TabsProvider,
  useTabs,
  CurrentTabProvider,
  TabBar,
  TileLauncher,
  PrivacyStrip,
  SignalDocsProvider,
  type Tab,
  type TileDef,
  type PaletteCommand,
  type SignalDoc,
} from '@repoguru/ui';
import { SIGNAL_EDUCATION } from './services/analysis/signalEducation';
import { trackEvent } from './utils/analytics';
import {
  handleOAuthCallback,
  handleInstallationCallback,
  isInstallationCallback,
  getInstallationManageUrl,
} from './utils/oauth';
import { saveGithubToken } from './services/persistence/credentials';
import { fetchInstallations } from './services/github/org';
import { ReconnectBanner } from './components/auth/ReconnectBanner';

const HowItWorksPage = lazy(() =>
  import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })),
);
const OrgScanPage = lazy(() => import('@repoguru/ui').then((m) => ({ default: m.OrgScanPage })));
const ComparePage = lazy(() => import('@repoguru/ui').then((m) => ({ default: m.ComparePage })));
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage })),
);
const DiscoverPage = lazy(() =>
  import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })),
);
const PolicyPage = lazy(() => import('@repoguru/ui').then((m) => ({ default: m.PolicyPage })));
const GitStatsPage = lazy(() => import('@repoguru/ui').then((m) => ({ default: m.GitStatsPage })));
const TechDetectPage = lazy(() =>
  import('@repoguru/ui').then((m) => ({ default: m.TechDetectPage })),
);

// ───────────────────────── Web tab vocabulary ────────────────────────

const WEB_TILES: TileDef[] = [
  {
    kind: 'home',
    title: 'Report Card',
    color: 'text-emerald-400',
    description: 'A–F grade across security, docs, CI/CD, and code health.',
    d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    kind: 'git-stats',
    title: 'Git Stats',
    color: 'text-cyan-400',
    description: 'Commits, contributors, ownership, hotspots, heatmaps.',
    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    kind: 'tech-detect',
    title: 'Tech Stack',
    color: 'text-purple-400',
    description: 'Frameworks, databases, cloud, CI/CD, and testing tools.',
    d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  {
    kind: 'compare',
    title: 'Compare',
    color: 'text-amber-400',
    description: 'Score two repositories side-by-side across categories.',
    d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    kind: 'org-scan',
    title: 'Org Scan',
    color: 'text-teal-400',
    description: 'Score every repository in a GitHub organisation.',
    d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    kind: 'policy',
    title: 'Policy',
    color: 'text-rose-400',
    description: 'PASS / FAIL a repo against a compliance ruleset.',
    d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    kind: 'portfolio',
    title: 'Portfolio',
    color: 'text-pink-400',
    description: 'Profile a developer’s public repos at a glance.',
    d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    kind: 'discover',
    title: 'Search',
    color: 'text-indigo-400',
    description: 'Find repositories by topic, language, or stars.',
    d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  // Help intentionally NOT in the launcher tiles — Help isn't a
  // session you'd open in a tab. It lives as a corner-icon in the
  // top-right rail (next to Settings), but the 'docs' kind + title
  // is still registered below so the route + command palette still
  // open the Help tab when invoked.
];

// Help still needs a kind/title mapping so the docs tab + command
// palette continue to work; it's just not in the launcher grid.
const DOCS_ICON_D =
  'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253';

const WEB_TITLE_FOR_KIND: Record<string, string> = {
  launcher: 'New Tab',
  home: 'Report Card',
  'git-stats': 'Git Stats',
  'tech-detect': 'Tech Stack',
  compare: 'Compare',
  'org-scan': 'Org Scan',
  policy: 'Policy',
  portfolio: 'Portfolio',
  discover: 'Search',
  docs: 'Help',
};

const ICON_BY_KIND: Record<string, string> = {
  ...Object.fromEntries(WEB_TILES.map((t) => [t.kind, t.d])),
  // docs/Help isn't in WEB_TILES (removed from launcher grid) but
  // still needs an icon for the tab strip.
  docs: DOCS_ICON_D,
};
const COLOR_BY_KIND: Record<string, string | undefined> = {
  ...Object.fromEntries(WEB_TILES.map((t) => [t.kind, t.color])),
  docs: 'text-text-muted',
};

function webTitleFor(kind: string, repo?: string): string {
  const base = WEB_TITLE_FOR_KIND[kind] ?? 'New Tab';
  return repo ? `${base} · ${repo}` : base;
}

function iconForKind(kind: string): string {
  return ICON_BY_KIND[kind] ?? 'M12 4v16m8-8H4';
}

function colorForKind(kind: string): string | undefined {
  return COLOR_BY_KIND[kind];
}

/** Project a SignalEducation entry into the shared SignalDoc shape. The
 *  shared/ui drawer doesn't care about CategoryKey enums — it just shows
 *  the category label as a string heading. */
function lookupSignalDoc(name: string): SignalDoc | null {
  const e = SIGNAL_EDUCATION[name];
  if (!e) return null;
  return {
    name: e.name,
    category: e.category,
    why: e.why,
    howToFix: e.howToFix,
    fixUrl: e.fixUrl,
    learnMoreUrl: e.learnMoreUrl,
  };
}

function AppContent() {
  const { state: tabsState, openTab, replaceActive } = useTabs();
  const { state: appState, dispatch } = useApp();
  const token = appState.githubToken || '';

  // OAuth callback handling — fires once on mount when ?code= is in URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('code') && !params.has('setup_action')) return;
    const wasInstall = isInstallationCallback();
    const handleCallback = wasInstall ? handleInstallationCallback() : handleOAuthCallback();
    handleCallback
      .then(async (result) => {
        // Installation flow returns the access token as a bare string;
        // OAuth flow returns { accessToken, returnTo }. Normalise.
        const accessToken = typeof result === 'string' ? result : (result?.accessToken ?? null);
        const returnTo = typeof result === 'string' ? null : (result?.returnTo ?? null);

        if (accessToken) {
          dispatch({ type: 'SET_GITHUB_TOKEN', token: accessToken });
          dispatch({ type: 'SET_AUTH_EXPIRED', expired: false });
          await saveGithubToken(accessToken);
          trackEvent('token_added', {
            method: wasInstall ? 'installation' : 'oauth',
          });
        }
        if (wasInstall) {
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
              /* keep going */
            }
          }
          toast.success('Connected to GitHub');
        }

        // Restore the page they were on before reconnecting. Same-origin
        // check already done inside handleOAuthCallback.
        if (returnTo && returnTo !== window.location.pathname + window.location.search) {
          window.history.replaceState({}, '', returnTo);
        }
      })
      .catch((err) => {
        console.error('OAuth callback failed:', err);
        toast.error(err instanceof Error ? err.message : 'OAuth sign-in failed.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const paletteTools: Omit<PaletteCommand, 'group'>[] = useMemo(
    () =>
      WEB_TILES.map((t) => ({
        id: `t:${t.kind}`,
        label: t.title,
        onSelect: () => openTab(t.kind),
      })),
    [openTab],
  );
  const paletteActions: Omit<PaletteCommand, 'group'>[] = [
    { id: 'a:new-tab', label: 'New Tab', shortcut: '⌘T', onSelect: () => openTab('launcher') },
    {
      id: 'a:settings',
      label: 'Open Settings',
      onSelect: () => dispatch({ type: 'TOGGLE_SETTINGS' }),
    },
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

  // Recents-pick custom event opens a fresh Report Card tab pre-filled
  // with the slug.
  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ value: string }>).detail;
      if (detail?.value) openTab('home', { repo: detail.value });
    };
    window.addEventListener('repoguru:palette-pick-repo', onPick);
    return () => window.removeEventListener('repoguru:palette-pick-repo', onPick);
  }, [openTab]);

  const helpButton = (
    <button
      type="button"
      onClick={() => openTab('docs')}
      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-text-secondary hover:text-neon hover:bg-surface-hover/50 transition-colors"
      aria-label="Open Help"
      title="Help"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.7.6-1.5.9-2 2v.5"
        />
        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
      </svg>
    </button>
  );

  const accountButton = appState.githubUser ? (
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="hidden sm:inline">Settings</span>
    </button>
  );

  const rightRail = (
    <div className="flex items-center gap-1">
      {helpButton}
      {accountButton}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-surface text-text bg-gradient-dark">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <CommandPalette tools={paletteTools} actions={paletteActions} />
      <TabBar
        iconForKind={iconForKind}
        colorForKind={colorForKind}
        rightRail={rightRail}
        wordmark={
          <button
            type="button"
            onClick={() => replaceActive('home')}
            className="inline-flex items-center gap-2 -mx-1 px-1 rounded hover:opacity-90"
            aria-label="Repo Guru — home"
          >
            <img
              src="/logo.png"
              alt=""
              className="h-7 w-7 object-contain shrink-0"
              aria-hidden="true"
            />
            <span className="hidden sm:inline font-semibold tracking-tight">RepoGuru</span>
          </button>
        }
      />
      <ReconnectBanner />
      <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
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
      return (
        <TileLauncher
          tiles={WEB_TILES}
          subtitle="A workspace for digging into git repositories. Pick a tool to start a session — open as many in parallel as you like."
          banner={<PrivacyStrip />}
        />
      );
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
            onAnalyze={() => {}}
            githubToken={ctx.token}
            defaultUsername={ctx.defaultUsername}
          />
        </Suspense>
      );
    case 'discover':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <DiscoverPage
            onNavigate={() => {}}
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
    default:
      return null;
  }
}

export default function App() {
  return (
    <AppProvider>
      <AnalysisProvider>
        <BrowserServicesProvider>
          <TooltipProvider>
            <SignalDocsProvider lookup={lookupSignalDoc}>
              <TabsProvider titleFor={webTitleFor} storageKey="repoguru:tabs">
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
            </SignalDocsProvider>
          </TooltipProvider>
        </BrowserServicesProvider>
      </AnalysisProvider>
    </AppProvider>
  );
}
