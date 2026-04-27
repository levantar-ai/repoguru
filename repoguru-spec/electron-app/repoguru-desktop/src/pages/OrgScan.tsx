import { useState } from 'react';
import {
  OrgScanView,
  type OrgScanItem,
  type OrgScanSummary,
  type Grade,
} from '@repoguru/ui';
import { useOrgScan } from '@/hooks/useOrgScan';
import { useGithubToken } from '@/hooks/useGithubToken';

function asGrade(g: string): Grade {
  if (g === 'A' || g === 'B' || g === 'C' || g === 'D' || g === 'F') return g;
  return 'F';
}

interface RepoScoreWire {
  repo_name: string;
  overall_score: number;
  grade: string;
  categories: Array<{ key: string; label: string; score: number }>;
}

function repoScoreToOrgScanItem(r: RepoScoreWire): OrgScanItem {
  // The CLI emits `repo_name` as a single "owner/repo" string.
  const slash = r.repo_name.indexOf('/');
  const owner = slash >= 0 ? r.repo_name.slice(0, slash) : '';
  const repo = slash >= 0 ? r.repo_name.slice(slash + 1) : r.repo_name;
  return {
    repo: { owner, repo },
    grade: asGrade(r.grade),
    overallScore: r.overall_score,
    categories: r.categories.map((c) => ({
      key: c.key,
      label: c.label,
      score: c.score,
    })),
  };
}

function buildSummary(
  items: OrgScanItem[],
  averageScore: number,
  averageGrade: Grade,
): OrgScanSummary {
  const dist: Partial<Record<Grade, number>> = {};
  for (const item of items) {
    dist[item.grade] = (dist[item.grade] ?? 0) + 1;
  }
  return {
    totalRepos: items.length,
    averageScore,
    averageGrade,
    gradeDistribution: dist,
  };
}

export function OrgScan() {
  const [orgName, setOrgName] = useState('');
  const [isUser, setIsUser] = useState(false);
  const [tokenOverride, setTokenOverride] = useState('');
  const [skipForks, setSkipForks] = useState(true);
  const [skipArchived, setSkipArchived] = useState(true);
  const [maxRepos, setMaxRepos] = useState(0);
  const { scanning, progress, error, startOrgScan } = useOrgScan();
  const { token: savedToken, isSet: hasToken } = useGithubToken();

  const effectiveToken = tokenOverride || savedToken;

  const handleScan = () => {
    if (!orgName || !effectiveToken) return;
    startOrgScan({
      org_or_user: orgName,
      is_user: isUser,
      github_token: effectiveToken,
      clone_base_dir: '/tmp/repoguru-orgscan',
      max_repos: maxRepos,
      skip_forks: skipForks,
      skip_archived: skipArchived,
    });
  };

  const repoScores = (progress?.repo_scores ?? []) as RepoScoreWire[];
  const isDone = progress?.phase === 'done';
  const items = repoScores.map(repoScoreToOrgScanItem);
  const summary = isDone
    ? buildSummary(items, progress?.average_score ?? 0, asGrade(progress?.average_grade ?? 'C'))
    : undefined;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Organization Scan</h2>
      <p className="text-sm text-gray-500 mb-6">
        Scan all repositories in a GitHub organization or user portfolio.
      </p>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Organization or Username</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., facebook"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              GitHub Token
              {hasToken && <span className="text-green-500 ml-1">(using saved token)</span>}
            </label>
            <input
              type="password"
              value={tokenOverride}
              onChange={(e) => setTokenOverride(e.target.value)}
              placeholder={hasToken ? 'Using token from Settings...' : 'ghp_...'}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-sky-500"
            />
            {!hasToken && (
              <p className="text-[10px] text-gray-600 mt-1">
                Set a token in Settings to avoid re-entering it each time.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-gray-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isUser}
              onChange={(e) => setIsUser(e.target.checked)}
              className="rounded border-gray-600"
            />
            User portfolio (not org)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={skipForks}
              onChange={(e) => setSkipForks(e.target.checked)}
              className="rounded border-gray-600"
            />
            Skip forks
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={skipArchived}
              onChange={(e) => setSkipArchived(e.target.checked)}
              className="rounded border-gray-600"
            />
            Skip archived
          </label>
          <div className="flex items-center gap-1.5">
            <span>Max repos:</span>
            <input
              type="number"
              value={maxRepos || ''}
              onChange={(e) => setMaxRepos(Number(e.target.value) || 0)}
              placeholder="all"
              className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
            />
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={!orgName || !effectiveToken || scanning}
          className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
        >
          {scanning ? 'Scanning...' : 'Start Scan'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {scanning && progress && (
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">
              {progress.phase === 'listing'
                ? 'Listing repositories...'
                : progress.phase === 'cloning'
                  ? `Cloning ${progress.repo_name}...`
                  : progress.phase === 'scanning'
                    ? `Scanning ${progress.repo_name}...`
                    : progress.phase === 'scoring'
                      ? `Scoring ${progress.repo_name}...`
                      : 'Complete'}
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              {progress.repos_completed}/{progress.repos_total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-300"
              style={{
                width: `${progress.repos_total ? (progress.repos_completed / progress.repos_total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {items.length > 0 && <OrgScanView items={items} summary={summary} />}
    </div>
  );
}
