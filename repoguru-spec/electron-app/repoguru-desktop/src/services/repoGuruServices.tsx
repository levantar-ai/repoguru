// DesktopServices — implements @repoguru/ui's RepoGuruServices using the
// gRPC sidecar (the Rust `repoanalyze` CLI). Same interface the browser
// host satisfies, so the SAME shared pages from @repoguru/ui mount on the
// desktop with no per-host page code.

import { type RepoGuruServices, type ReportCardData, type Grade, type RepoPickerProps } from '@repoguru/ui';
import { grpcClient, type ScoreResponse } from '@/services/grpc-client';
import { RepoPicker as DesktopFsPicker } from '@/components/common/RepoPicker';

function asGrade(g: string): Grade {
  if (g === 'A' || g === 'B' || g === 'C' || g === 'D' || g === 'F') return g;
  return 'F';
}
function asWinner(w: string): 'a' | 'b' | 'tie' {
  return w === 'a' || w === 'b' ? w : 'tie';
}
function parseOwnerRepo(repoPath: string): { owner: string; repo: string } {
  const parts = repoPath.split('/').filter(Boolean);
  if (parts.length >= 2) return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
  return { owner: '', repo: parts[0] ?? repoPath };
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
      signals: c.signals.map((s) => ({ name: s.name, found: s.found, details: s.details || undefined })),
    })),
    strengths: score.strengths,
    risks: score.risks,
    nextSteps: score.next_steps,
    analyzedAt: score.scored_at,
  };
}

interface CompareResponseWire {
  report_card_a: ScoreResponse;
  report_card_b: ScoreResponse;
  deltas: Array<{ category: string; score_a: number; score_b: number; delta: number; winner: string }>;
  winner: string;
  score_delta: number;
}

/** Desktop RepoPicker adapter: forwards the @repoguru/ui RepoPicker
 *  contract to the desktop's filesystem-aware picker (browse button +
 *  recent paths + GitHub search). */
function DesktopRepoPicker({ inputId, label, value, onChange, onSubmit, disabled }: RepoPickerProps) {
  return (
    <DesktopFsPicker
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      label={label}
      placeholder="/path/to/repo"
      showRecent
      trackRecent={false}
      // @ts-expect-error — DesktopFsPicker wasn't built around inputId yet, fine.
      inputId={inputId}
      disabled={disabled}
    />
  );
}

export const desktopServices: RepoGuruServices = {
  repoLabelSingular: 'local repo',
  isDesktop: true,
  RepoPicker: (props) => <DesktopRepoPicker {...props} />,
  compare: {
    async run(repoA, repoB) {
      const res = (await grpcClient.compareRepos(repoA, repoB)) as CompareResponseWire;
      const cardA = scoreToReportCardData(res.report_card_a, repoA);
      const cardB = scoreToReportCardData(res.report_card_b, repoB);
      return {
        reportA: cardA,
        reportB: cardB,
        deltas: res.deltas.map((d) => ({
          category: d.category,
          scoreA: d.score_a,
          scoreB: d.score_b,
          delta: d.delta,
          winner: asWinner(d.winner),
        })),
        winner: asWinner(res.winner),
        scoreDelta: res.score_delta,
      };
    },
  },
  score: {
    async run() { throw new Error('score not yet wired in DesktopServices'); },
  },
  techDetect: {
    async run() { throw new Error('techDetect not yet wired in DesktopServices'); },
  },
  policy: {
    listPresets: () => [],
    async evaluate() { throw new Error('policy not yet wired in DesktopServices'); },
  },
  orgScan: {
    async run() { throw new Error('orgScan not yet wired in DesktopServices'); },
  },
};
