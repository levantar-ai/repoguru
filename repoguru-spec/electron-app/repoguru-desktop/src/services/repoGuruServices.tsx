// DesktopServices — implements @repoguru/ui's RepoGuruServices using the
// gRPC sidecar (the Rust `repoanalyze` CLI). Same interface the browser
// host satisfies, so the SAME shared pages from @repoguru/ui mount on the
// desktop with no per-host page code.

import {
  type RepoGuruServices,
  type ReportCardData,
  type Grade,
  type RepoSuggestion,
  type PolicyEvalResult,
  type PolicyEvalRuleResult,
  type PolicySeverity,
  type PolicyPreset,
  type OrgScanItem,
  type OrgScanSummary,
  type OrgScanResult,
  type GitStatsResult,
} from '@repoguru/ui';
import { grpcClient, type ScoreResponse, type ScanRequest, type ScanProgress } from '@/services/grpc-client';
import { GrpcAnalyzer, type GrpcSectionClient } from '@repoguru/desktop-adapter';
import type { GitStatsData as CanonicalGitStatsData } from '@repoguru/core';
import { wireToLegacy } from '@/services/wireToLegacy';
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

const DESKTOP_PRESETS: PolicyPreset[] = [
  { id: 'basic-hygiene', label: 'Basic Hygiene', description: 'README, LICENSE, CI/CD basics' },
  { id: 'production-ready', label: 'Production Ready', description: 'Full CI/CD, security, quality' },
  { id: 'security-focused', label: 'Security Focused', description: 'Strict security and supply chain' },
];

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
    async run(repo) {
      const res = (await grpcClient.detectTech(repo)) as { json?: string };
      const raw = res?.json ? JSON.parse(res.json) as Record<string, unknown> : {};
      const arr = (k: string) => (Array.isArray(raw[k]) ? raw[k] : []);
      return {
        aws: arr('aws'),
        azure: arr('azure'),
        gcp: arr('gcp'),
        python: arr('python'),
        node: arr('node'),
        go: arr('go'),
        java: arr('java'),
        php: arr('php'),
        rust: arr('rust'),
        ruby: arr('ruby'),
        frameworks: arr('frameworks'),
        databases: arr('databases'),
        cicd: arr('cicd'),
        testing: arr('testing'),
        languages: (raw.languages as Record<string, number>) ?? {},
        manifestFiles: (raw.manifest_files as string[]) ?? [],
        totalFiles: (raw.total_files as number) ?? 0,
      };
    },
  },
  policy: {
    listPresets: (): PolicyPreset[] => DESKTOP_PRESETS,
    async evaluate(req): Promise<PolicyEvalResult> {
      const score = (await grpcClient.scoreReportCard(req.repo)) as ScoreResponse;
      const wire = (await grpcClient.evaluatePolicy(req.presetId, score)) as {
        passed: boolean;
        pass_count: number;
        fail_count: number;
        results: Array<{
          rule: { id: string; name: string; description: string; type: string; operator: string; value: number; category: string; signal: string; severity: string };
          passed: boolean;
          actual: string;
          expected: string;
        }>;
      };
      const preset = DESKTOP_PRESETS.find((p) => p.id === req.presetId);
      const asSeverity = (s: string): PolicySeverity => (s === 'error' || s === 'warning' || s === 'info' ? s : 'info');
      return {
        passed: wire.passed,
        passCount: wire.pass_count,
        failCount: wire.fail_count,
        policyName: preset?.label ?? req.presetId,
        repoLabel: req.repo,
        results: wire.results.map<PolicyEvalRuleResult>((r) => ({
          passed: r.passed,
          actual: r.actual,
          expected: r.expected,
          rule: {
            id: r.rule.id,
            name: r.rule.name,
            description: r.rule.description,
            type: r.rule.type,
            operator: r.rule.operator,
            value: r.rule.value,
            category: r.rule.category || undefined,
            signal: r.rule.signal || undefined,
            severity: asSeverity(r.rule.severity),
          },
        })),
      };
    },
  },
  gitStats: {
    async run(repo, opts): Promise<GitStatsResult> {
      const outPath = `/tmp/repoguru-${Date.now()}.bin`;
      // Phase 1: scan the repo, producing a binary report file.
      await new Promise<void>((resolve, reject) => {
        const req: ScanRequest = { repo_path: repo, out_path: outPath };
        grpcClient
          .scan(req, (p: ScanProgress) => {
            if (p.error) reject(new Error(p.error));
            opts?.onProgress?.(p.message || `Scanning... commits ${p.commits_processed}`);
            if (p.done) resolve();
          })
          .catch(reject);
      });
      // Phase 2: stream sections via the canonical GrpcAnalyzer.
      const captured: Record<string, Record<string, unknown>> = {};
      const wrapped: GrpcSectionClient = {
        async getReport(p) {
          const res = (await grpcClient.getReport(p)) as { metrics_json: string };
          try { captured['__report'] = JSON.parse(res.metrics_json) as Record<string, unknown>; } catch { captured['__report'] = {}; }
          return res;
        },
        async getSection(p, s, r) {
          const res = (await grpcClient.getSection(p, s, r)) as { data_json: string };
          try { captured[s] = JSON.parse(res.data_json) as Record<string, unknown>; } catch { captured[s] = {}; }
          return res;
        },
      };
      const analyzer = new GrpcAnalyzer(wrapped);
      const wireData: Record<string, unknown> = {};
      const canonical: CanonicalGitStatsData = {};
      for await (const event of analyzer.analyze({ source: repo, outPath })) {
        if (opts?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        if (event.kind === 'section') {
          (canonical as Record<string, unknown>)[event.section.name] = event.section.data;
          opts?.onProgress?.(`Loaded ${event.section.name}`);
          if (event.section.name === 'overview') {
            const report = captured['__report'] ?? {};
            wireData['author_names'] = report['authors'] ?? {};
          } else {
            const raw = captured[event.section.name] ?? {};
            Object.assign(wireData, raw);
          }
        } else if (event.kind === 'error') {
          throw event.error;
        }
      }
      const reportRaw = (captured['__report'] ?? {}) as Record<string, unknown>;
      const overview = canonical.overview;
      const analysis = wireToLegacy(wireData as never, {
        ...reportRaw,
        owner: overview?.owner,
        repo: overview?.repo,
      } as Parameters<typeof wireToLegacy>[1]);
      return { analysis };
    },
  },

  orgScan: {
    async run(req, opts): Promise<OrgScanResult> {
      let items: OrgScanItem[] = [];
      let summary: OrgScanSummary = { totalRepos: 0, averageScore: 0, averageGrade: 'F' };
      await new Promise<void>((resolve, reject) => {
        const onProgress = (p: {
          phase: string;
          repo_name: string;
          repos_total: number;
          repos_completed: number;
          repo_scores: Array<{ repo_name: string; overall_score: number; grade: string; categories: Array<{ key: string; label: string; score: number }> }>;
          average_score: number;
          average_grade: string;
          error: string;
        }) => {
          const repoScores = p.repo_scores ?? [];
          const built: OrgScanItem[] = repoScores.map((r) => {
            const slash = r.repo_name.indexOf('/');
            const owner = slash >= 0 ? r.repo_name.slice(0, slash) : '';
            const repo = slash >= 0 ? r.repo_name.slice(slash + 1) : r.repo_name;
            return {
              repo: { owner, repo },
              grade: asGrade(r.grade),
              overallScore: r.overall_score,
              categories: (r.categories ?? []).map((c) => ({ key: c.key, label: c.label, score: c.score })),
            };
          });
          items = built;
          opts?.onProgress?.({
            phase: p.phase === 'done' ? 'done' : p.phase === 'listing' ? 'listing' : 'analyzing',
            total: p.repos_total,
            completed: p.repos_completed,
            currentRepo: p.repo_name,
            items: built,
          });
          if (p.phase === 'done') {
            summary = {
              totalRepos: built.length,
              averageScore: p.average_score,
              averageGrade: asGrade(p.average_grade),
              gradeDistribution: built.reduce<Partial<Record<Grade, number>>>(
                (acc, it) => ({ ...acc, [it.grade]: (acc[it.grade] ?? 0) + 1 }),
                {},
              ),
            };
            resolve();
          }
          if (p.error) reject(new Error(p.error));
        };
        grpcClient
          .scanOrg(
            {
              org_or_user: req.target,
              is_user: !!req.isUser,
              github_token: '',
              clone_base_dir: '/tmp/repoguru-orgscan',
              max_repos: req.maxRepos ?? 0,
              skip_forks: req.skipForks ?? true,
              skip_archived: req.skipArchived ?? true,
            },
            onProgress as never,
          )
          .catch(reject);
      });
      return { items, summary };
    },
  },
};
