// DesktopServices — implements @repoguru/ui's RepoGuruServices using the
// gRPC sidecar (the Rust `repoanalyze` CLI). Same interface the browser
// host satisfies, so the SAME shared pages from @repoguru/ui mount on the
// desktop with no per-host page code.

import {
  type RepoGuruServices,
  type ReportCardData,
  type Grade,
  type RepoSuggestion,
} from '@repoguru/ui';
import { grpcClient, type ScoreResponse } from '@/services/grpc-client';
import { getRecentRepos } from '@/services/storage';

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

export const desktopServices: RepoGuruServices = {
  isDesktop: true,
  repoBrowse: {
    hint: 'Type a local path or click Browse to pick a folder',
    async browse() {
      try {
        const picked = await window.repoGuru.selectDirectory();
        return picked || null;
      } catch {
        return null;
      }
    },
    recents(): RepoSuggestion[] {
      return getRecentRepos().map<RepoSuggestion>((r) => {
        const slug = r.path.split('/').filter(Boolean).slice(-2).join('/') || r.path;
        return { value: r.path, label: slug, hint: r.path };
      });
    },
  },
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
    async run(repo) {
      const score = (await grpcClient.scoreReportCard(repo)) as ScoreResponse;
      return { report: scoreToReportCardData(score, repo) };
    },
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
