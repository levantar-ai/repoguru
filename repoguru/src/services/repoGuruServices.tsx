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
} from '@repoguru/ui';
import { parseRepoUrl } from '../services/github/parser';
import { githubFetch } from '../services/github/client';
import { runLightAnalysis } from '../services/analysis/lightEngine';
import { ensureCloned } from '../services/git/cloneService';
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
      async run() {
        throw new Error('score service not yet wired in BrowserServices');
      },
    },
    techDetect: {
      async run() {
        throw new Error('techDetect service not yet wired in BrowserServices');
      },
    },
    policy: {
      listPresets: () => [],
      async evaluate() {
        throw new Error('policy service not yet wired in BrowserServices');
      },
    },
    orgScan: {
      async run() {
        throw new Error('orgScan service not yet wired in BrowserServices');
      },
    },
  };
}
