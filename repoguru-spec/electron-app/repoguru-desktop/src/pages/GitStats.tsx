import { useState } from 'react';
import { GitStatsView } from '@repoguru/ui';
import { useGitStats } from '@/hooks/useGitStats';
import { useScan } from '@/hooks/useScan';
import { RepoPicker } from '@/components/common/RepoPicker';
import { ScanProgress } from '@/components/scan/ScanProgress';
import { addRecentRepo } from '@/services/storage';

const DEFAULT_OUT_DIR = '/tmp/repoguru-scan';

export function GitStats() {
  const [repoPath, setRepoPath] = useState('');
  const [outPath] = useState(DEFAULT_OUT_DIR);
  const { loading, analysis, error, loadStats } = useGitStats();
  const { scanning, progress, startScan } = useScan();

  const handleAnalyze = async () => {
    if (!repoPath) return;
    addRecentRepo(repoPath);
    await startScan({
      repo_path: repoPath,
      out_path: outPath,
      renames: true,
      copies: false,
      rename_threshold: 50,
      merge_policy: 'first-parent',
      max_diff_files: 1000,
      merge_diff_limit: 100,
      report: false,
    });
    loadStats(outPath, repoPath);
  };

  if (!analysis && !loading && !error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Git Stats</h2>
          <p className="text-gray-400 mt-1 text-sm">
            Run a full scan to explore the repository dashboard.
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <RepoPicker
                value={repoPath}
                onChange={setRepoPath}
                onSubmit={handleAnalyze}
                showRecent
                trackRecent
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!repoPath || scanning}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
            >
              {scanning ? 'Scanning...' : 'Scan & Analyze'}
            </button>
          </div>
        </div>
        {(scanning || progress) && !progress?.done && progress && (
          <div className="mt-6">
            <ScanProgress progress={progress} />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-gray-800" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-gray-400 mt-4 text-sm">Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
          <strong>Error loading stats:</strong> {error}
        </div>
        <button
          onClick={() => loadStats(outPath, repoPath || undefined)}
          className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <GitStatsView analysis={analysis} />
    </div>
  );
}
