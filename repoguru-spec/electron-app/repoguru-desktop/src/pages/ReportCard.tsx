import { useState, useMemo } from 'react';
import { ReportCardView, type ReportCardData, type Grade } from '@repoguru/ui';
import { useReportCard } from '@/hooks/useReportCard';
import { RepoPicker } from '@/components/common/RepoPicker';
import { grpcClient, type ScoreResponse } from '@/services/grpc-client';

function parseOwnerRepo(repoPath: string): { owner: string; repo: string } {
  // Local desktop paths are filesystem paths — use the last two segments as owner/repo.
  const parts = repoPath.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
  }
  return { owner: '', repo: parts[0] ?? repoPath };
}

function asGrade(g: string): Grade {
  if (g === 'A' || g === 'B' || g === 'C' || g === 'D' || g === 'F') return g;
  return 'F';
}

function scoreToReportCardData(score: ScoreResponse, repoPath: string): ReportCardData {
  return {
    repo: parseOwnerRepo(repoPath),
    grade: asGrade(score.grade),
    overallScore: score.overall_score,
    categories: score.categories.map((c) => ({
      key: c.key,
      label: c.label,
      score: c.score,
      weight: c.weight,
      signals: c.signals.map((s) => ({
        name: s.name,
        found: s.found,
        details: s.details || undefined,
      })),
    })),
    strengths: score.strengths,
    risks: score.risks,
    nextSteps: score.next_steps,
    analyzedAt: score.scored_at,
  };
}

export function ReportCard() {
  const [repoPath, setRepoPath] = useState('');
  const { loading, score, error, scoreRepo } = useReportCard();

  const handleAnalyze = () => {
    if (repoPath) scoreRepo(repoPath);
  };

  const repoName = useMemo(() => repoPath.split('/').pop() || repoPath, [repoPath]);

  const handleExport = async (format: string) => {
    if (!score) return;
    try {
      const result = (await grpcClient.exportReport(format, score, repoName)) as {
        content?: string;
      };
      if (result?.content) {
        await navigator.clipboard.writeText(result.content);
      }
    } catch {
      // silently fail export
    }
  };

  // No repo selected — show picker
  if (!score && !loading && !error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Report Card</h2>
          <p className="text-gray-400 mt-1 text-sm">
            Score a repository across 8 health categories.
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
              disabled={!repoPath}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
            >
              Score
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-gray-800" />
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-gray-400 mt-4 text-sm">Scoring repository...</p>
        <p className="text-gray-600 text-xs mt-1">{repoName}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Report Card</h2>
        </div>
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
          <strong>Error scoring repository:</strong> {error}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!repoPath}
          className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!score) return null;

  const report = scoreToReportCardData(score, repoPath);
  const actions = (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        {(['csv', 'markdown', 'json', 'badge-svg'] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => handleExport(fmt)}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
          >
            {fmt === 'badge-svg' ? 'Badge' : fmt.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        onClick={handleAnalyze}
        disabled={!repoPath || loading}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-neon/30 transition-all"
      >
        Rescore
      </button>
    </div>
  );

  return <ReportCardView report={report} actions={actions} />;
}
