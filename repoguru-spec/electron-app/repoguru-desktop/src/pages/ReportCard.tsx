import { useState, useMemo } from 'react';
import { useReportCard } from '@/hooks/useReportCard';
import { LetterGrade } from '@/components/report/LetterGrade';
import { CategoryCard } from '@/components/report/CategoryCard';
import { RadarChart } from '@/components/charts/RadarChart';
import { RepoPicker } from '@/components/common/RepoPicker';
import { grpcClient } from '@/services/grpc-client';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444',
};

export function ReportCard() {
  const [repoPath, setRepoPath] = useState('');
  const { loading, score, error, scoreRepo } = useReportCard();

  const handleAnalyze = () => {
    if (repoPath) {
      scoreRepo(repoPath);
    }
  };

  const repoName = useMemo(() => repoPath.split('/').pop() || repoPath, [repoPath]);

  // Export handler
  const handleExport = async (format: string) => {
    if (!score) return;
    try {
      const result = await grpcClient.exportReport(format, score, repoName) as { content?: string };
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
          <p className="text-gray-400 mt-1 text-sm">Score a repository across 8 health categories.</p>
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
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 mb-4">
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
              Retry
            </button>
          </div>
        </div>
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
          <strong>Error scoring repository:</strong> {error}
        </div>
      </div>
    );
  }

  if (!score) return null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header with repo picker for rescoring */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 mr-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-md">
              <RepoPicker
                value={repoPath}
                onChange={setRepoPath}
                onSubmit={handleAnalyze}
                label=""
                showRecent
                trackRecent
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!repoPath || loading}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
            >
              Rescore
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Scored {new Date(score.scored_at).toLocaleString()}
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2">
          {['csv', 'markdown', 'json', 'badge-svg'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
            >
              {fmt === 'badge-svg' ? 'Badge' : fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: Grade + Radar | Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Overall grade + Radar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Overall grade card */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 flex flex-col items-center">
            <span className="text-xs text-gray-500 uppercase tracking-wider mb-3">Overall Score</span>
            <LetterGrade grade={score.grade} score={score.overall_score} size="lg" animated />
            <div className="mt-4 text-center">
              <span
                className="text-sm font-medium"
                style={{ color: GRADE_COLORS[score.grade] }}
              >
                {score.grade === 'A' ? 'Excellent' :
                 score.grade === 'B' ? 'Good' :
                 score.grade === 'C' ? 'Fair' :
                 score.grade === 'D' ? 'Needs Work' : 'Critical'}
              </span>
            </div>
          </div>

          {/* Radar chart */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2 text-center">Health Radar</h3>
            <RadarChart categories={score.categories} size={260} />
          </div>

          {/* Strengths & Risks */}
          {score.strengths.length > 0 && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="text-xs font-semibold text-green-500 uppercase tracking-wider mb-2">Strengths</h3>
              <ul className="space-y-1.5">
                {score.strengths.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-green-500 mt-0.5">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {score.risks.length > 0 && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Risks</h3>
              <ul className="space-y-1.5">
                {score.risks.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-red-400 mt-0.5">!</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: Category cards */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            Categories
            <span className="text-gray-600 font-normal ml-2">({score.categories.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {score.categories.map((cat: any, i: number) => (
              <CategoryCard key={cat.key} category={cat} index={i} />
            ))}
          </div>

          {/* Next steps */}
          {score.next_steps.length > 0 && (
            <div className="mt-6 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">
                Recommended Next Steps
              </h3>
              <ol className="space-y-2">
                {score.next_steps.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
