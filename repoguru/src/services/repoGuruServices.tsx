// BrowserServices — implements the @repoguru/ui RepoGuruServices interface
// using the in-browser processing engine: isomorphic-git clones + GitHub
// API calls + the in-page light analyser. This is the file the browser host
// gives to <RepoGuruProvider> at app root so every shared page in
// @repoguru/ui (ComparePage, ReportCardPage, …) gets browser-backed data.

import {
  computeDeltasFromReports,
  type RepoGuruServices,
  type CompareResult,
  type CompareRunOptions,
  type ReportCardData,
  type RepoSuggestion,
  type PolicyPreset,
  type PolicyEvalResult,
  type PolicyEvalRuleResult,
  type OrgScanItem,
  type OrgScanSummary,
  type OrgScanResult,
  type Grade,
} from '@repoguru/ui';
import { GITHUB_API_BASE, GRADE_THRESHOLDS } from '../utils/constants';
import { evaluatePolicy as runEvalPolicy, DEFAULT_POLICIES } from './analysis/policyEngine';
import { parseRepoUrl } from '../services/github/parser';
import { githubFetch } from '../services/github/client';
import { runLightAnalysis } from '../services/analysis/lightEngine';
import { ensureCloned } from '../services/git/cloneService';
import { computeLanguages } from '../services/git/extractors';
import {
  detectAWS,
  detectAzure,
  detectGCP,
  detectPython,
  detectNode,
  detectGo,
  detectJava,
  detectPHP,
  detectRust,
  detectRuby,
  detectFrameworks,
  detectDatabases,
  detectCicd,
  detectTesting,
} from '../services/analysis/techDetectEngine';
import type {
  RepoInfo,
  TreeEntry,
  LightAnalysisReport,
  TechStackItem,
  RecentRepo,
} from '../types';
import type { GitHubRepoResponse, GitHubTreeResponse } from '../services/github/types';
import { formatNumber } from '../utils/formatters';

// ─────────────────────────── Compare ─────────────────────────────────

function lightReportToReportCardData(r: LightAnalysisReport): ReportCardData {
  return {
    repo: { owner: r.repo.owner, repo: r.repo.repo },
    grade: r.grade,
    overallScore: r.overallScore,
    categories: r.categories.map((c) => ({
      key: c.key,
      label: c.label,
      score: c.score,
      weight: c.weight,
      signals: c.signals.map((s) => ({ name: s.name, found: s.found, details: s.details })),
    })),
    strengths: [],
    risks: [],
    nextSteps: [],
    analyzedAt: r.analyzedAt,
    repoInfo: {
      description: r.repoInfo.description,
      stars: r.repoInfo.stars,
      forks: r.repoInfo.forks,
      openIssues: r.repoInfo.openIssues,
      archived: r.repoInfo.archived,
    },
  };
}

function mapGitHubRepo(raw: GitHubRepoResponse): RepoInfo {
  return {
    owner: raw.full_name.split('/')[0],
    repo: raw.name,
    defaultBranch: raw.default_branch,
    description: raw.description || '',
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    license: raw.license?.spdx_id || null,
    language: raw.language,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    topics: raw.topics || [],
    archived: raw.archived,
    size: raw.size,
  };
}

async function analyzeOneForCompare(
  input: string,
  label: string,
  token: string,
  onProgress?: (m: string) => void,
): Promise<LightAnalysisReport> {
  const parsed = parseRepoUrl(input);
  if (!parsed) throw new Error(`Invalid repo format for ${label}: "${input}"`);
  onProgress?.(`Fetching ${label} info...`);
  const rawRepo = await githubFetch<GitHubRepoResponse>(
    `/repos/${parsed.owner}/${parsed.repo}`,
    token || undefined,
  );
  const repoInfo = mapGitHubRepo(rawRepo);
  let tree: TreeEntry[];
  try {
    onProgress?.(`Cloning ${label}...`);
    const cached = await ensureCloned(parsed.owner, parsed.repo, (_s, _p, m) =>
      onProgress?.(`${label}: ${m}`),
    );
    tree = cached.tree;
  } catch (cloneErr) {
    if (token) {
      const branch = parsed.branch || repoInfo.defaultBranch;
      onProgress?.(`Fetching ${label} file tree...`);
      const td = await githubFetch<GitHubTreeResponse>(
        `/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`,
        token,
      );
      tree = td.tree.map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha, size: e.size }));
    } else {
      throw cloneErr;
    }
  }
  onProgress?.(`Analyzing ${label}...`);
  return runLightAnalysis(parsed, repoInfo, tree);
}

function TechStackComparison({ techA, techB, nameA, nameB }: { techA: TechStackItem[]; techB: TechStackItem[]; nameA: string; nameB: string }) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-surface-alt border border-border">
      <h3 className="text-lg font-semibold text-text mb-4">Tech Stack</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TechCol name={nameA} items={techA} other={techB} />
        <TechCol name={nameB} items={techB} other={techA} />
      </div>
    </div>
  );
}
function TechCol({ name, items, other }: { name: string; items: TechStackItem[]; other: TechStackItem[] }) {
  return (
    <div className="p-4 rounded-xl bg-surface-hover border border-border">
      <h4 className="text-sm font-medium text-text-secondary mb-3 truncate">{name}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No tech stack detected.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((t) => (
            <span
              key={t.name}
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                !other.some((o) => o.name === t.name)
                  ? 'bg-neon/15 border border-neon/30 text-neon'
                  : 'bg-surface-alt border border-border text-text-secondary'
              }`}
            >
              {t.name}
              <span className="ml-1 text-text-muted">({t.category})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
function StatsComparison({ a, b, nameA, nameB }: { a: LightAnalysisReport; b: LightAnalysisReport; nameA: string; nameB: string }) {
  const rows: { label: string; va: string; vb: string }[] = [
    { label: 'Stars', va: formatNumber(a.repoInfo.stars), vb: formatNumber(b.repoInfo.stars) },
    { label: 'Forks', va: formatNumber(a.repoInfo.forks), vb: formatNumber(b.repoInfo.forks) },
    { label: 'Open Issues', va: formatNumber(a.repoInfo.openIssues), vb: formatNumber(b.repoInfo.openIssues) },
    { label: 'Language', va: a.repoInfo.language || 'N/A', vb: b.repoInfo.language || 'N/A' },
    { label: 'License', va: a.repoInfo.license || 'None', vb: b.repoInfo.license || 'None' },
    { label: 'Files', va: formatNumber(a.treeEntryCount), vb: formatNumber(b.treeEntryCount) },
  ];
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-surface-alt border border-border">
      <h3 className="text-lg font-semibold text-text mb-4">Repository Stats</h3>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 pb-3 border-b border-border mb-1">
        <div className="text-sm font-medium text-text-secondary truncate text-center">{nameA}</div>
        <div className="text-sm font-medium text-text-muted text-center">Metric</div>
        <div className="text-sm font-medium text-text-secondary truncate text-center">{nameB}</div>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-3 gap-2 sm:gap-4 py-2.5 border-b border-border/50 last:border-b-0 items-center">
          <div className="text-sm font-medium text-text text-center">{r.va}</div>
          <div className="text-xs sm:text-sm text-text-muted text-center">{r.label}</div>
          <div className="text-sm font-medium text-text text-center">{r.vb}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────── Service factory ─────────────────────────

export function makeBrowserServices(
  getToken: () => string,
  getRecents: () => RecentRepo[],
): RepoGuruServices {
  return {
    isDesktop: false,
    repoBrowse: {
      hint: 'Type owner/repo or paste a GitHub URL',
      // Browser "browse" pops a one-shot prompt rather than a folder dialog
      // — the real GitHub repo dropdown lives in the host's settings/sign-in
      // flow. The recent chips already cover the common path.
      async browse() {
        const v = window.prompt('Repository (owner/repo or GitHub URL):', '');
        return v && v.trim() ? v.trim() : null;
      },
      recents(): RepoSuggestion[] {
        return getRecents().map<RepoSuggestion>((r) => ({
          value: `${r.owner}/${r.repo}`,
          label: `${r.owner}/${r.repo}`,
          hint: `${r.grade} · ${r.overallScore}/100`,
        }));
      },
    },
    compare: {
      async run(repoA, repoB, opts?: CompareRunOptions): Promise<CompareResult> {
        const token = getToken();
        const reportA = await analyzeOneForCompare(repoA, 'Repo A', token, opts?.onProgress);
        if (opts?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        const reportB = await analyzeOneForCompare(repoB, 'Repo B', token, opts?.onProgress);
        const cardA = lightReportToReportCardData(reportA);
        const cardB = lightReportToReportCardData(reportB);
        const deltas = computeDeltasFromReports(cardA, cardB);
        const scoreDelta = cardA.overallScore - cardB.overallScore;
        const winner: 'a' | 'b' | 'tie' = scoreDelta > 0 ? 'a' : scoreDelta < 0 ? 'b' : 'tie';
        const nameA = `${cardA.repo.owner}/${cardA.repo.repo}`;
        const nameB = `${cardB.repo.owner}/${cardB.repo.repo}`;
        return {
          reportA: cardA,
          reportB: cardB,
          deltas,
          winner,
          scoreDelta,
          extras: (
            <>
              <TechStackComparison techA={reportA.techStack} techB={reportB.techStack} nameA={nameA} nameB={nameB} />
              <StatsComparison a={reportA} b={reportB} nameA={nameA} nameB={nameB} />
            </>
          ),
        };
      },
    },
    // The remaining services aren't lifted yet — pages still call them via
    // the legacy host code. They'll be wired as each page is lifted.
    score: {
      async run(repoInput, opts) {
        const token = getToken();
        const report = await analyzeOneForCompare(repoInput, 'repository', token, opts?.onProgress);
        const card = lightReportToReportCardData(report);
        const repoName = `${card.repo.owner}/${card.repo.repo}`;
        const stats = (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
            {[
              ['Stars', formatNumber(report.repoInfo.stars)],
              ['Forks', formatNumber(report.repoInfo.forks)],
              ['Open Issues', formatNumber(report.repoInfo.openIssues)],
              ['Language', report.repoInfo.language || 'N/A'],
              ['License', report.repoInfo.license || 'None'],
              ['Files', formatNumber(report.treeEntryCount)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-surface-alt border border-border px-4 py-3 text-center">
                <div className="text-sm font-semibold text-text">{val}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        );
        return {
          report: card,
          extras: report.techStack.length > 0 ? (
            <div className="space-y-4">
              {stats}
              <TechStackComparison
                techA={report.techStack}
                techB={[]}
                nameA={`${repoName} — detected tech`}
                nameB="(no comparison)"
              />
            </div>
          ) : stats,
        };
      },
    },
    techDetect: {
      async run(repoInput, opts) {
        const parsed = parseRepoUrl(repoInput);
        if (!parsed) throw new Error(`Invalid repo: "${repoInput}"`);
        const token = getToken();
        opts?.onProgress?.('Cloning repository...');
        const cached = await ensureCloned(parsed.owner, parsed.repo, (_s, _p, _sp, m) => opts?.onProgress?.(m), token || undefined);
        opts?.onProgress?.('Analyzing technologies...');
        const fileInputs = cached.files.map((f) => ({ path: f.path, content: f.content }));
        const allBlobPaths = cached.tree.filter((e) => e.type === 'blob').map((e) => e.path);
        return {
          aws: detectAWS(fileInputs),
          azure: detectAzure(fileInputs),
          gcp: detectGCP(fileInputs),
          python: detectPython(fileInputs),
          node: detectNode(fileInputs),
          go: detectGo(fileInputs),
          java: detectJava(fileInputs),
          php: detectPHP(fileInputs),
          rust: detectRust(fileInputs),
          ruby: detectRuby(fileInputs),
          frameworks: detectFrameworks(fileInputs),
          databases: detectDatabases(fileInputs),
          cicd: detectCicd(fileInputs),
          testing: detectTesting(fileInputs),
          languages: computeLanguages(allBlobPaths),
          manifestFiles: fileInputs.map((f) => f.path),
          totalFiles: cached.files.length,
        };
      },
    },
    policy: {
      listPresets(): PolicyPreset[] {
        return DEFAULT_POLICIES.map((p) => ({ id: p.id, label: p.name, description: p.description }));
      },
      async evaluate(req, opts): Promise<PolicyEvalResult> {
        const policySet = DEFAULT_POLICIES.find((p) => p.id === req.presetId);
        if (!policySet) throw new Error(`Unknown preset: ${req.presetId}`);
        const token = getToken();
        const lightReport = await analyzeOneForCompare(req.repo, 'repository', token, opts?.onProgress);
        opts?.onProgress?.('Evaluating policy rules...');
        // The policy engine only reads overallScore, categories, signals, and
        // repo identity — LightAnalysisReport is a faithful subset for those
        // fields. Cast through unknown so TS sees the structural compatibility.
        const reportForPolicy = lightReport as unknown as Parameters<typeof runEvalPolicy>[1];
        const evalResult = runEvalPolicy(policySet, reportForPolicy);
        return {
          passed: evalResult.passed,
          passCount: evalResult.passCount,
          failCount: evalResult.failCount,
          policyName: policySet.name,
          repoLabel: evalResult.repo,
          results: evalResult.results.map<PolicyEvalRuleResult>((r) => ({
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
              category: r.rule.category,
              signal: r.rule.signal,
              severity: r.rule.severity,
            },
          })),
        };
      },
    },
    orgScan: {
      async run(req, opts): Promise<OrgScanResult> {
        const token = getToken();
        const ghHeaders: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
        if (token) ghHeaders.Authorization = `Bearer ${token}`;
        const ghFetch = async (url: string) => {
          const res = await fetch(url, { headers: ghHeaders, signal: opts?.signal });
          if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
          return res;
        };

        // List repos.
        opts?.onProgress?.({
          phase: 'listing',
          total: 0,
          completed: 0,
          currentRepo: '',
          items: [],
        });
        const listEndpoint = req.isUser ? `users/${encodeURIComponent(req.target)}/repos` : `orgs/${encodeURIComponent(req.target)}/repos`;
        const allRepos: Array<Record<string, unknown>> = [];
        const maxPages = 10;
        for (let page = 1; page <= maxPages; page++) {
          const r = await ghFetch(`${GITHUB_API_BASE}/${listEndpoint}?per_page=100&sort=updated&page=${page}`);
          const batch = (await r.json()) as Array<Record<string, unknown>>;
          if (!Array.isArray(batch) || batch.length === 0) break;
          allRepos.push(...batch);
          if (batch.length < 100) break;
        }
        const filtered = allRepos.filter((r) => {
          if (req.skipForks && r.fork) return false;
          if (req.skipArchived && r.archived) return false;
          return true;
        });
        const cap = req.maxRepos && req.maxRepos > 0 ? Math.min(filtered.length, req.maxRepos) : filtered.length;
        const list = filtered.slice(0, cap);

        // Analyse each repo.
        const items: OrgScanItem[] = [];
        for (let i = 0; i < list.length; i++) {
          if (opts?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
          const raw = list[i];
          const repoName = raw.name as string;
          const fullName = raw.full_name as string;
          const owner = (fullName.split('/')[0] ?? '');
          opts?.onProgress?.({
            phase: 'analyzing',
            total: list.length,
            completed: i,
            currentRepo: fullName,
            items: [...items],
          });
          try {
            const report = await analyzeOneForCompare(`${owner}/${repoName}`, repoName, token, undefined);
            items.push({
              repo: { owner: report.repo.owner, repo: report.repo.repo },
              grade: report.grade,
              overallScore: report.overallScore,
              language: report.repoInfo.language ?? undefined,
              categories: report.categories.map((c) => ({ key: c.key, label: c.label, score: c.score })),
            });
          } catch {
            // Skip repos that fail to clone/analyze; org scan is best-effort.
          }
        }

        const totalScore = items.reduce((s, it) => s + it.overallScore, 0);
        const avg = items.length > 0 ? Math.round(totalScore / items.length) : 0;
        const avgGrade: Grade = avg >= GRADE_THRESHOLDS.A ? 'A' : avg >= GRADE_THRESHOLDS.B ? 'B' : avg >= GRADE_THRESHOLDS.C ? 'C' : avg >= GRADE_THRESHOLDS.D ? 'D' : 'F';
        const distribution = items.reduce<Partial<Record<Grade, number>>>(
          (acc, it) => ({ ...acc, [it.grade]: (acc[it.grade] ?? 0) + 1 }),
          {},
        );
        const summary: OrgScanSummary = {
          totalRepos: items.length,
          averageScore: avg,
          averageGrade: avgGrade,
          gradeDistribution: distribution,
        };
        opts?.onProgress?.({
          phase: 'done',
          total: list.length,
          completed: list.length,
          currentRepo: '',
          items,
        });
        return { items, summary };
      },
    },
  };
}
