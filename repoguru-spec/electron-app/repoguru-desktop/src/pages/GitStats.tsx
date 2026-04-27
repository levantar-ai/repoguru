import { useState } from 'react';
import { useGitStats } from '@/hooks/useGitStats';
import { useScan } from '@/hooks/useScan';
import { RepoPicker } from '@/components/common/RepoPicker';
import { ScanProgress } from '@/components/scan/ScanProgress';
import { addRecentRepo } from '@/services/storage';

// Charts
import { CommitHeatmap } from '@/components/charts/CommitHeatmap';
import { PunchCardChart } from '@/components/charts/PunchCardChart';
import { CodeFrequencyChart } from '@/components/charts/CodeFrequencyChart';
import { ContributorChart } from '@/components/charts/ContributorChart';
import { CommitSizeHistogram } from '@/components/charts/CommitSizeHistogram';
import { RepoGrowthChart } from '@/components/charts/RepoGrowthChart';
import { FileChurnTable } from '@/components/charts/FileChurnTable';
import { FileCouplingTable } from '@/components/charts/FileCouplingTable';
import {
  BusFactorChart,
  CommitsByHourChart,
  CommitsByMonthChart,
  CommitsByWeekdayChart,
  CommitsByYearChart,
  HealthRadarChart,
} from '@repoguru/ui';
import { LanguageBreakdownChart } from '@/components/charts/LanguageBreakdownChart';
import { WordCloudChart } from '@/components/charts/WordCloudChart';
import { TimezoneChart } from '@/components/charts/TimezoneChart';
import { ConventionalCommitsChart } from '@/components/charts/ConventionalCommitsChart';
import { TagHistoryChart } from '@/components/charts/TagHistoryChart';

type Section = 'overview' | 'activity' | 'contributors' | 'codebase' | 'patterns' | 'health';

const TABS: Array<{ id: Section; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'contributors', label: 'Contributors' },
  { id: 'codebase', label: 'Codebase' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'health', label: 'Health' },
];

const DEFAULT_OUT_DIR = '/tmp/repoguru-scan';

export function GitStats() {
  const [repoPath, setRepoPath] = useState('');
  const [outPath] = useState(DEFAULT_OUT_DIR);
  const { loading, data, canonical, error, loadStats } = useGitStats();
  const { scanning, progress, startScan } = useScan();
  const [tab, setTab] = useState<Section>('overview');

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

  if (!data && !loading && !error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Git Stats</h2>
          <p className="text-gray-400 mt-1 text-sm">Run a full scan to explore 19 interactive charts.</p>
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

  if (!data) return null;

  const repoName = repoPath.split('/').pop() || repoPath || 'Repository';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{repoName} — Git Stats</h2>
        <p className="text-xs text-gray-500 mt-1">15+ interactive charts across activity, contributors, codebase, and patterns</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'text-sky-400 border-sky-500'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)] hover:border-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.weekly_activity && <CommitHeatmap weeklyActivity={data.weekly_activity} />}
          {data.timeseries && <CodeFrequencyChart timeseries={data.timeseries} />}
          {data.cumulative_files && <RepoGrowthChart data={data.cumulative_files} />}
          {data.language_breakdown && <LanguageBreakdownChart data={data.language_breakdown} />}
          {canonical?.health?.radarMetrics && <HealthRadarChart metrics={canonical.health.radarMetrics} />}
          {canonical?.health?.busFactor && <BusFactorChart busFactor={canonical.health.busFactor} />}
        </div>
      )}

      {tab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.weekly_activity && <CommitHeatmap weeklyActivity={data.weekly_activity} />}
          {data.timeseries && <CodeFrequencyChart timeseries={data.timeseries} />}
          {data.cumulative_files && <RepoGrowthChart data={data.cumulative_files} />}
          {canonical?.patterns?.commitsByYear && (
            <CommitsByYearChart data={canonical.patterns.commitsByYear} />
          )}
          {data.tag_history && <TagHistoryChart tags={data.tag_history} />}
        </div>
      )}

      {tab === 'contributors' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.authors && <ContributorChart authors={data.authors} authorNames={data.author_names ?? {}} />}
          {data.timezone_data && <TimezoneChart data={data.timezone_data} />}
          {canonical?.health?.busFactor && <BusFactorChart busFactor={canonical.health.busFactor} />}
        </div>
      )}

      {tab === 'codebase' && (
        <div className="grid grid-cols-1 gap-4">
          {data.hotspots && <FileChurnTable hotspots={data.hotspots} />}
          {data.file_coupling && <FileCouplingTable coupling={data.file_coupling} />}
          {data.language_breakdown && <LanguageBreakdownChart data={data.language_breakdown} />}
        </div>
      )}

      {tab === 'patterns' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.punch_card && <PunchCardChart punchCard={data.punch_card} />}
          {canonical?.patterns?.commitsByWeekday && (
            <CommitsByWeekdayChart data={canonical.patterns.commitsByWeekday} />
          )}
          {canonical?.patterns?.commitsByMonth && (
            <CommitsByMonthChart data={canonical.patterns.commitsByMonth} />
          )}
          {canonical?.patterns?.commitsByHour && (
            <CommitsByHourChart data={canonical.patterns.commitsByHour} />
          )}
          {data.commit_size_histogram && <CommitSizeHistogram data={data.commit_size_histogram} />}
          {data.conventional_commits && <ConventionalCommitsChart data={data.conventional_commits} />}
          {data.word_frequencies && <WordCloudChart words={data.word_frequencies} />}
        </div>
      )}

      {tab === 'health' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {canonical?.health?.radarMetrics && <HealthRadarChart metrics={canonical.health.radarMetrics} />}
          {canonical?.health?.busFactor && <BusFactorChart busFactor={canonical.health.busFactor} />}
          {data.tag_history && <TagHistoryChart tags={data.tag_history} />}
          {data.timezone_data && <TimezoneChart data={data.timezone_data} />}
        </div>
      )}
    </div>
  );
}
