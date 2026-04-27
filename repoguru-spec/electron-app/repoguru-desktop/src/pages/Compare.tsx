import { useState } from 'react';
import { grpcClient, type ScoreResponse, type CategoryScore } from '@/services/grpc-client';
import { LetterGrade } from '@/components/report/LetterGrade';
import { RepoPicker } from '@/components/common/RepoPicker';

interface CompareResult {
  report_card_a: ScoreResponse;
  report_card_b: ScoreResponse;
  deltas: Array<{ category: string; score_a: number; score_b: number; delta: number; winner: string }>;
  winner: string;
  score_delta: number;
}

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444',
};

export function Compare() {
  const [pathA, setPathA] = useState('');
  const [pathB, setPathB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  const handleCompare = async () => {
    if (!pathA || !pathB) return;
    setLoading(true);
    setError(null);
    try {
      const res = await grpcClient.compareRepos(pathA, pathB) as CompareResult;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const nameA = pathA.split('/').pop() || 'Repo A';
  const nameB = pathB.split('/').pop() || 'Repo B';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Compare Repositories</h2>
      <p className="text-sm text-gray-500 mb-6">Side-by-side analysis of two repositories.</p>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <RepoPicker
          value={pathA}
          onChange={setPathA}
          label="Repository A"
          placeholder="/path/to/repo"
          showRecent
          trackRecent={false}
          onSubmit={handleCompare}
        />
        <RepoPicker
          value={pathB}
          onChange={setPathB}
          label="Repository B"
          placeholder="/path/to/repo"
          showRecent
          trackRecent={false}
          onSubmit={handleCompare}
        />
      </div>

      <button
        onClick={handleCompare}
        disabled={!pathA || !pathB || loading}
        className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors mb-6"
      >
        {loading ? 'Comparing...' : 'Compare'}
      </button>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Overall comparison */}
          <div className="grid grid-cols-3 gap-4">
            <ScoreCard name={nameA} score={result.report_card_a} isWinner={result.winner === 'a'} />
            <div className="flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white tabular-nums">
                {result.score_delta > 0 ? '+' : ''}{result.score_delta}
              </span>
              <span className="text-xs text-gray-500 mt-1">
                {result.winner === 'tie' ? 'Tie' : `${result.winner === 'a' ? nameA : nameB} wins`}
              </span>
            </div>
            <ScoreCard name={nameB} score={result.report_card_b} isWinner={result.winner === 'b'} />
          </div>

          {/* Category deltas */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {result.deltas.map((d) => {
                const catA = result.report_card_a.categories.find((c: CategoryScore) => c.key === d.category);
                return (
                  <div key={d.category} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-28 truncate capitalize">{catA?.label || d.category}</span>
                    {/* Bar A */}
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-6 text-right tabular-nums">{d.score_a}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${d.score_a}%` }} />
                      </div>
                    </div>
                    {/* Delta */}
                    <span className={`text-xs tabular-nums w-8 text-center font-medium ${
                      d.delta > 0 ? 'text-green-400' : d.delta < 0 ? 'text-red-400' : 'text-gray-600'
                    }`}>
                      {d.delta > 0 ? '+' : ''}{d.delta}
                    </span>
                    {/* Bar B */}
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${d.score_b}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-6 tabular-nums">{d.score_b}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-gray-800 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> {nameA}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> {nameB}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ name, score, isWinner }: { name: string; score: ScoreResponse; isWinner: boolean }) {
  return (
    <div className={`rounded-lg border p-4 flex flex-col items-center ${isWinner ? 'border-green-500/30 bg-green-500/5' : 'border-gray-800 bg-gray-900/50'}`}>
      {isWinner && <span className="text-[10px] text-green-500 uppercase tracking-wider mb-2">Winner</span>}
      <span className="text-sm font-medium text-gray-200 mb-3">{name}</span>
      <LetterGrade grade={score.grade} score={score.overall_score} size="lg" animated />
    </div>
  );
}
