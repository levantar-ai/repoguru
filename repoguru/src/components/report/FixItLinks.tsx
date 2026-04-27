import type { AnalysisReport } from '../../types';

interface Props {
  report: AnalysisReport;
  owner: string;
  repo: string;
  branch: string;
}

interface MissingSignal {
  name: string;
  category: string;
  fixUrl: string;
}

/** Constructs a GitHub new-file URL for a given path. */
function githubNewFileUrl(owner: string, repo: string, branch: string, path: string): string {
  return `https://github.com/${owner}/${repo}/new/${branch}?filename=${encodeURIComponent(path)}`;
}

/** Map of known signals to their fix file paths. */
const SIGNAL_FIX_PATHS: Record<string, { path: string; why: string }> = {
  'README.md': {
    path: 'README.md',
    why: 'A README helps users and contributors understand what the project does and how to use it.',
  },
  'CONTRIBUTING.md': {
    path: 'CONTRIBUTING.md',
    why: 'Contribution guidelines encourage community involvement and set clear expectations.',
  },
  LICENSE: {
    path: 'LICENSE',
    why: 'A license file clarifies how others can use, modify, and distribute your code.',
  },
  'CODE_OF_CONDUCT.md': {
    path: 'CODE_OF_CONDUCT.md',
    why: 'A code of conduct fosters a welcoming and inclusive community.',
  },
  'SECURITY.md': {
    path: 'SECURITY.md',
    why: 'A security policy tells users how to responsibly report vulnerabilities.',
  },
  'CHANGELOG.md': {
    path: 'CHANGELOG.md',
    why: 'A changelog helps users track changes between releases.',
  },
  CODEOWNERS: {
    path: '.github/CODEOWNERS',
    why: 'CODEOWNERS ensures the right people review changes to critical files.',
  },
  '.github/FUNDING.yml': {
    path: '.github/FUNDING.yml',
    why: 'A funding file lets supporters know how to sponsor the project.',
  },
  'Issue Templates': {
    path: '.github/ISSUE_TEMPLATE/bug_report.md',
    why: 'Issue templates help users file structured, actionable bug reports.',
  },
  'PR Template': {
    path: '.github/PULL_REQUEST_TEMPLATE.md',
    why: 'A PR template standardizes contributions and improves review quality.',
  },
  'Dependabot Config': {
    path: '.github/dependabot.yml',
    why: 'Dependabot keeps dependencies up to date automatically.',
  },
  '.editorconfig': {
    path: '.editorconfig',
    why: 'EditorConfig ensures consistent coding styles across different editors.',
  },
};

export function FixItLinks({ report, owner, repo, branch }: Props) {
  // Collect missing signals that have fix URLs
  const missing: MissingSignal[] = [];

  for (const cat of report.categories) {
    for (const signal of cat.signals) {
      if (signal.found) continue;
      const fix = SIGNAL_FIX_PATHS[signal.name];
      if (fix) {
        missing.push({
          name: signal.name,
          category: cat.label,
          fixUrl: githubNewFileUrl(owner, repo, branch, fix.path),
        });
      }
    }
  }

  // Show top 5
  const top = missing.slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
        Quick Fixes
      </h3>
      <div className="space-y-2">
        {top.map((item) => {
          const info = SIGNAL_FIX_PATHS[item.name];
          return (
            <div
              key={item.name}
              className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-surface-alt"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="h-4 w-4 text-grade-f/60 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span className="text-sm font-medium text-text">{item.name}</span>
                  <span className="text-xs text-text-muted">{item.category}</span>
                </div>
                {info && <p className="text-xs text-text-muted ml-6">{info.why}</p>}
              </div>
              <a
                href={item.fixUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neon/25 bg-neon/10 text-neon hover:bg-neon/20 transition-colors"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Create on GitHub
                <span className="sr-only">for {item.name} (opens in new tab)</span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
