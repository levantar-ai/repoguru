import { useState } from 'react';
import {
  CompareView,
  PageContainer,
  PageHero,
  PrimaryButton,
  SecondaryButton,
  LoadingPanel,
  ErrorPanel,
  type CompareDelta,
  type ReportCardData,
  type Grade,
} from '@repoguru/ui';
import { grpcClient, type ScoreResponse } from '@/services/grpc-client';
import { RepoPicker } from '@/components/common/RepoPicker';

interface CompareResult {
  report_card_a: ScoreResponse;
  report_card_b: ScoreResponse;
  deltas: Array<{
    category: string;
    score_a: number;
    score_b: number;
    delta: number;
    winner: string;
  }>;
  winner: string;
  score_delta: number;
}

function parseOwnerRepo(repoPath: string): { owner: string; repo: string } {
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

function asWinner(w: string): 'a' | 'b' | 'tie' {
  return w === 'a' || w === 'b' ? w : 'tie';
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
      const res = (await grpcClient.compareRepos(pathA, pathB)) as CompareResult;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <PageContainer>
      <PageHero
        title="Compare"
        highlight="Repositories"
        subtitle="Side-by-side analysis of two local repositories — every commit, every category."
      />

      <div className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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
        <div className="flex justify-center gap-3">
          <PrimaryButton onClick={handleCompare} disabled={!pathA || !pathB || loading}>
            {loading ? 'Comparing...' : 'Compare'}
          </PrimaryButton>
          {result && <SecondaryButton onClick={handleReset}>Reset</SecondaryButton>}
        </div>
      </div>

      {loading && <LoadingPanel message="Comparing repositories..." />}

      {error && <ErrorPanel title="Comparison failed" message={error} />}

      {result && (
        <CompareView
          reportA={scoreToReportCardData(result.report_card_a, pathA)}
          reportB={scoreToReportCardData(result.report_card_b, pathB)}
          deltas={result.deltas.map<CompareDelta>((d) => ({
            category: d.category,
            scoreA: d.score_a,
            scoreB: d.score_b,
            delta: d.delta,
            winner: asWinner(d.winner),
          }))}
          winner={asWinner(result.winner)}
          scoreDelta={result.score_delta}
        />
      )}
    </PageContainer>
  );
}
