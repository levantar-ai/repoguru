import type { PageId } from '../../types';
import { useTabs } from '../../context/TabsContext';
import { PrivacyStrip } from '@repoguru/ui';

interface Tile {
  id: PageId;
  title: string;
  description: string;
  /** Heroicons-style stroke path. */
  d: string;
}

const TILES: Tile[] = [
  {
    id: 'home',
    title: 'Report Card',
    description: 'A–F grade across security, docs, CI/CD, and code health.',
    d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 'git-stats',
    title: 'Git Stats',
    description: 'Commits, contributors, ownership, hotspots, heatmaps.',
    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    id: 'tech-detect',
    title: 'Tech Stack',
    description: 'Frameworks, databases, cloud, CI/CD, and testing tools.',
    d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  {
    id: 'compare',
    title: 'Compare',
    description: 'Score two repositories side-by-side across categories.',
    d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    id: 'org-scan',
    title: 'Org Scan',
    description: 'Score every repository in a GitHub organisation.',
    d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    id: 'policy',
    title: 'Policy',
    description: 'PASS / FAIL a repo against a compliance ruleset.',
    d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    description: 'Profile a developer’s public repos at a glance.',
    d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    id: 'discover',
    title: 'Search',
    description: 'Find repositories by topic, language, or stars.',
    d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    id: 'docs',
    title: 'Help',
    description: 'How RepoGuru works, what each metric means.',
    d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
];

/** Tile launcher rendered for any tab whose kind === 'launcher'.
 *  Picking a tile transforms the *current* tab into the chosen tool
 *  (rather than spawning a new tab) — that way the user's launcher tab
 *  becomes the working tab and the studio doesn't accumulate empties.
 *  ⌘T from anywhere opens a fresh launcher tab. */
export function TileLauncher() {
  const { replaceActive } = useTabs();
  return (
    <div className="w-full max-w-5xl mx-auto px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-semibold text-text tracking-tight">
          Repo<span className="text-text-secondary">Guru Studio</span>
        </h1>
        <p className="mt-3 text-base text-text-secondary max-w-xl mx-auto">
          A workspace for digging into git repositories. Pick a tool to start a session — open as many in parallel as you like.
        </p>
        <div className="mt-4">
          <PrivacyStrip />
        </div>
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        role="grid"
        aria-label="Choose a tool"
      >
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => replaceActive(tile.id)}
            className="group text-left p-5 rounded-xl border border-border bg-surface-alt hover:border-neon/40 hover:bg-surface-hover/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon focus-visible:outline-offset-2"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="rounded-lg bg-surface border border-border p-2 text-text-secondary group-hover:text-neon transition-colors shrink-0">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={tile.d} />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-text">{tile.title}</div>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {tile.description}
            </p>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center text-xs text-text-muted">
        <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">⌘T</kbd>{' '}
        new tab ·{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">⌘W</kbd>{' '}
        close tab ·{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">⌘K</kbd>{' '}
        command palette
      </div>
    </div>
  );
}
