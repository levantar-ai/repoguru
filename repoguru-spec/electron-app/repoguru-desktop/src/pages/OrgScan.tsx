import { useState } from 'react';
import { useOrgScan } from '@/hooks/useOrgScan';
import { LetterGrade } from '@/components/report/LetterGrade';
import { useGithubToken } from '@/hooks/useGithubToken';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444',
};

export function OrgScan() {
  const [orgName, setOrgName] = useState('');
  const [isUser, setIsUser] = useState(false);
  const [tokenOverride, setTokenOverride] = useState('');
  const [skipForks, setSkipForks] = useState(true);
  const [skipArchived, setSkipArchived] = useState(true);
  const [maxRepos, setMaxRepos] = useState(0);
  const { scanning, progress, error, startOrgScan } = useOrgScan();
  const { token: savedToken, isSet: hasToken } = useGithubToken();

  // Use saved token from Settings, allow override
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

  const repoScores = progress?.repo_scores || [];
  const isDone = progress?.phase === 'done';

  // Grade distribution
  const gradeDist = repoScores.reduce(
    (acc, r) => { acc[r.grade] = (acc[r.grade] || 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Organization Scan</h2>
      <p className="text-sm text-gray-500 mb-6">Scan all repositories in a GitHub organization or user portfolio.</p>

      {/* Input form */}
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
            <input type="checkbox" checked={isUser} onChange={(e) => setIsUser(e.target.checked)} className="rounded border-gray-600" />
            User portfolio (not org)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={skipForks} onChange={(e) => setSkipForks(e.target.checked)} className="rounded border-gray-600" />
            Skip forks
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={skipArchived} onChange={(e) => setSkipArchived(e.target.checked)} className="rounded border-gray-600" />
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
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Progress */}
      {scanning && progress && (
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">
              {progress.phase === 'listing' ? 'Listing repositories...' :
               progress.phase === 'cloning' ? `Cloning ${progress.repo_name}...` :
               progress.phase === 'scanning' ? `Scanning ${progress.repo_name}...` :
               progress.phase === 'scoring' ? `Scoring ${progress.repo_name}...` :
               'Complete'}
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              {progress.repos_completed}/{progress.repos_total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-300"
              style={{ width: `${progress.repos_total ? (progress.repos_completed / progress.repos_total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Results table */}
      {repoScores.length > 0 && (
        <>
          {/* Summary */}
          {isDone && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-center">
                <div className="text-2xl font-bold text-white">{repoScores.length}</div>
                <div className="text-xs text-gray-500">Repositories</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: GRADE_COLORS[progress?.average_grade || 'C'] }}>
                  {progress?.average_grade || '-'}
                </div>
                <div className="text-xs text-gray-500">Average Grade ({Math.round(progress?.average_score || 0)})</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <div className="flex items-center justify-center gap-3">
                  {['A', 'B', 'C', 'D', 'F'].map((g) => (
                    <div key={g} className="text-center">
                      <div className="text-sm font-bold" style={{ color: GRADE_COLORS[g] }}>{gradeDist[g] || 0}</div>
                      <div className="text-[10px] text-gray-600">{g}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Distribution</div>
              </div>
            </div>
          )}

          {/* Repo list */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left px-4 py-2 font-medium">Repository</th>
                  <th className="text-center px-4 py-2 font-medium">Grade</th>
                  <th className="text-right px-4 py-2 font-medium">Score</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {repoScores.map((repo) => (
                  <tr key={repo.repo_name} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2.5 text-sm text-gray-200">{repo.repo_name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <LetterGrade grade={repo.grade} score={repo.overall_score} size="sm" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${repo.overall_score}%`, backgroundColor: GRADE_COLORS[repo.grade] }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums w-6">{repo.overall_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[10px] text-gray-600">{repo.categories?.length || 0} cats</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
