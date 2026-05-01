import { useMemo, type ReactNode } from 'react';
import {
  ComparePage,
  ReportCardPage,
  TechDetectPage,
  PolicyPage,
  OrgScanPage,
  GitStatsPage,
  RepoGuruProvider,
  TooltipProvider,
  TabsProvider,
  useTabs,
  CurrentTabProvider,
  TabBar,
  TileLauncher,
  CommandPalette,
  type Tab,
  type TileDef,
  type PaletteCommand,
} from '@repoguru/ui';
import { Settings } from './pages/Settings';
import { ThemeToggle } from './components/common/ThemeToggle';
import { desktopServices } from './services/repoGuruServices';

// ───────────────────────── Desktop tab vocabulary ────────────────────

const DESKTOP_TILES: TileDef[] = [
  { kind: 'home',         title: 'Report Card', color: 'text-emerald-400', description: 'A–F grade across security, docs, CI/CD, and code health.', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { kind: 'git-stats',    title: 'Git Stats',   color: 'text-cyan-400',    description: 'Every commit, contributor, hotspot, sizer-style stats.',   d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { kind: 'tech-detect',  title: 'Tech Stack',  color: 'text-purple-400',  description: 'Frameworks, databases, cloud, CI/CD, and testing tools.',  d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { kind: 'compare',      title: 'Compare',     color: 'text-amber-400',   description: 'Score two repositories side-by-side across categories.',   d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { kind: 'org-scan',     title: 'Org Scan',    color: 'text-teal-400',    description: 'Score every repository in a GitHub organisation.',         d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { kind: 'policy',       title: 'Policy',      color: 'text-rose-400',    description: 'PASS / FAIL a repo against a compliance ruleset.',         d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { kind: 'settings',     title: 'Settings',    color: 'text-slate-400',   description: 'Connect GitHub, Anthropic key, theme, AI Enrichment.',     d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

const DESKTOP_TITLE_FOR_KIND: Record<string, string> = {
  launcher: 'New Tab',
  home: 'Report Card',
  'git-stats': 'Git Stats',
  'tech-detect': 'Tech Stack',
  compare: 'Compare',
  'org-scan': 'Org Scan',
  policy: 'Policy',
  settings: 'Settings',
};

const ICON_BY_KIND: Record<string, string> = Object.fromEntries(DESKTOP_TILES.map((t) => [t.kind, t.d]));
const COLOR_BY_KIND: Record<string, string | undefined> = Object.fromEntries(
  DESKTOP_TILES.map((t) => [t.kind, t.color]),
);

function desktopTitleFor(kind: string, repo?: string): string {
  const base = DESKTOP_TITLE_FOR_KIND[kind] ?? 'New Tab';
  return repo ? `${base} · ${repo}` : base;
}

function iconForKind(kind: string): string {
  return ICON_BY_KIND[kind] ?? 'M12 4v16m8-8H4';
}

function colorForKind(kind: string): string | undefined {
  return COLOR_BY_KIND[kind];
}

function AppContent() {
  const { state: tabsState, openTab, replaceActive } = useTabs();

  const paletteTools: Omit<PaletteCommand, 'group'>[] = useMemo(
    () =>
      DESKTOP_TILES.map((t) => ({
        id: `t:${t.kind}`,
        label: t.title,
        onSelect: () => openTab(t.kind),
      })),
    [openTab],
  );
  const paletteActions: Omit<PaletteCommand, 'group'>[] = [
    { id: 'a:new-tab',  label: 'New Tab', shortcut: '⌘T', onSelect: () => openTab('launcher') },
    { id: 'a:settings', label: 'Open Settings',           onSelect: () => openTab('settings') },
  ];

  return (
    <div className="flex flex-col h-screen bg-surface text-text">
      <CommandPalette tools={paletteTools} actions={paletteActions} />
      <TabBar
        iconForKind={iconForKind}
        colorForKind={colorForKind}
        rightRail={<ThemeToggle />}
      />
      <main className="flex-1 overflow-y-auto" tabIndex={-1}>
        {tabsState.tabs.map((tab) => (
          <TabContent
            key={tab.id}
            tab={tab}
            active={tab.id === tabsState.activeId}
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
  onSendRepoToReportCard: (repo: string) => void;
}

function TabContent({ tab, active, onSendRepoToReportCard }: TabContentProps) {
  return (
    <div
      style={{ display: active ? undefined : 'none' }}
      inert={!active || undefined}
      role="tabpanel"
      aria-label={tab.title}
    >
      <CurrentTabProvider tab={tab}>{renderTab(tab, { onSendRepoToReportCard })}</CurrentTabProvider>
    </div>
  );
}

function renderTab(tab: Tab, _ctx: { onSendRepoToReportCard: (repo: string) => void }): ReactNode {
  switch (tab.kind) {
    case 'launcher':
      return (
        <TileLauncher
          tiles={DESKTOP_TILES}
          subtitle="A workspace for digging into git repositories. Pick a tool to start a session — open as many in parallel as you like."
        />
      );
    case 'home':
      return <ReportCardPage initialRepo={tab.repo} />;
    case 'git-stats':
      return <GitStatsPage />;
    case 'tech-detect':
      return <TechDetectPage />;
    case 'compare':
      return <ComparePage />;
    case 'org-scan':
      return <OrgScanPage />;
    case 'policy':
      return <PolicyPage />;
    case 'settings':
      return <Settings />;
    default:
      return null;
  }
}

export function App() {
  return (
    <RepoGuruProvider services={desktopServices}>
      <TooltipProvider>
        <TabsProvider titleFor={desktopTitleFor} storageKey="repoguru-desktop:tabs">
          <AppContent />
        </TabsProvider>
      </TooltipProvider>
    </RepoGuruProvider>
  );
}
