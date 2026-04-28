import { useState, useCallback } from 'react';
import type {
  RepoInfo,
  TreeEntry,
  LightAnalysisReport,
  TechStackItem,
} from '../types';
import {
  CompareView,
  computeDeltasFromReports,
  PageContainer,
  PageHero,
  RepoInputField,
  PrimaryButton,
  SecondaryButton,
  LoadingPanel,
  ErrorPanel,
  type ReportCardData,
} from '@repoguru/ui';
import { parseRepoUrl } from '../services/github/parser';
import { githubFetch } from '../services/github/client';
import { runLightAnalysis } from '../services/analysis/lightEngine';
import type { GitHubRepoResponse, GitHubTreeResponse } from '../services/github/types';
import { formatNumber } from '../utils/formatters';
import { invalidateIfNeitherMatch } from '../services/git/repoCache';
import { ensureCloned } from '../services/git/cloneService';
import { RepoPicker } from '../components/common/RepoPicker';
import { trackEvent } from '../utils/analytics';

// ── Props ──

interface Props {
  githubToken: string;
}

// ── Local types ──

type CompareStep = 'idle' | 'loading' | 'done' | 'error';

interface CompareState {
  step: CompareStep;
  progress: string;
  reportA: LightAnalysisReport | null;
  reportB: LightAnalysisReport | null;
  error: string | null;
}

// ── Helpers ──

function mapGitHubRepoToRepoInfo(raw: GitHubRepoResponse): RepoInfo {
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
      signals: c.signals.map((s) => ({
        name: s.name,
        found: s.found,
        details: s.details,
      })),
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

// ── Component ──

export function ComparePage({ githubToken }: Props) {
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [state, setState] = useState<CompareState>({
    step: 'idle',
    progress: '',
    reportA: null,
    reportB: null,
    error: null,
  });

  // ── Fetch a single repo ──

  async function analyzeRepo(
    input: string,
    label: string,
    setProgress: (msg: string) => void,
  ): Promise<LightAnalysisReport> {
    const parsed = parseRepoUrl(input);
    if (!parsed) throw new Error(`Invalid repo format for ${label}: "${input}"`);

    setProgress(`Fetching ${label} info...`);
    const token = githubToken || undefined;
    const rawRepo = await githubFetch<GitHubRepoResponse>(
      `/repos/${parsed.owner}/${parsed.repo}`,
      token,
    );
    const repoInfo = mapGitHubRepoToRepoInfo(rawRepo);

    let tree: TreeEntry[];

    try {
      setProgress(`Cloning ${label}...`);
      const cached = await ensureCloned(parsed.owner, parsed.repo, (_step, _percent, message) => {
        setProgress(`${label}: ${message}`);
      });
      tree = cached.tree;
    } catch (cloneErr) {
      if (token) {
        console.warn(`Clone failed for ${label}, falling back to API:`, cloneErr);
        const branch = parsed.branch || repoInfo.defaultBranch;

        setProgress(`Fetching ${label} file tree...`);
        const treeData = await githubFetch<GitHubTreeResponse>(
          `/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`,
          token,
        );
        tree = treeData.tree.map((e) => ({
          path: e.path,
          mode: e.mode,
          type: e.type,
          sha: e.sha,
          size: e.size,
        }));
      } else {
        throw cloneErr;
      }
    }

    setProgress(`Analyzing ${label}...`);
    return runLightAnalysis(parsed, repoInfo, tree);
  }

  // ── Run comparison ──

  const handleCompare = useCallback(async () => {
    if (!inputA.trim() || !inputB.trim()) return;

    trackEvent('compare_start', { repo_a: inputA.trim(), repo_b: inputB.trim() });

    setState({
      step: 'loading',
      progress: 'Starting comparison...',
      reportA: null,
      reportB: null,
      error: null,
    });

    try {
      const setProgress = (msg: string) => setState((prev) => ({ ...prev, progress: msg }));

      const parsedA = parseRepoUrl(inputA.trim());
      const parsedB = parseRepoUrl(inputB.trim());
      if (parsedA && parsedB) {
        invalidateIfNeitherMatch([
          { owner: parsedA.owner, repo: parsedA.repo },
          { owner: parsedB.owner, repo: parsedB.repo },
        ]);
      }

      const reportA = await analyzeRepo(inputA.trim(), 'Repo A', setProgress);
      const reportB = await analyzeRepo(inputB.trim(), 'Repo B', setProgress);

      trackEvent('compare_complete', { repo_a: inputA.trim(), repo_b: inputB.trim() });
      setState({ step: 'done', progress: '', reportA, reportB, error: null });
    } catch (err) {
      setState({
        step: 'error',
        progress: '',
        reportA: null,
        reportB: null,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputA, inputB, githubToken]);

  const handleReset = useCallback(() => {
    trackEvent('new_analysis', { tool: 'compare' });
    setState({ step: 'idle', progress: '', reportA: null, reportB: null, error: null });
  }, []);

  // ── Render ──

  return (
    <PageContainer>
      <PageHero
        title="Compare"
        highlight="Repositories"
        subtitle="Analyze two GitHub repos side by side. See which one scores higher across all categories."
      />

      <div className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <RepoInputField
            id="compare-repo-a"
            label="Repo A"
            value={inputA}
            onChange={setInputA}
            placeholder="owner/repo"
            disabled={state.step === 'loading'}
            onSubmit={handleCompare}
            picker={<RepoPicker onSelect={setInputA} />}
          />
          <RepoInputField
            id="compare-repo-b"
            label="Repo B"
            value={inputB}
            onChange={setInputB}
            placeholder="owner/repo"
            disabled={state.step === 'loading'}
            onSubmit={handleCompare}
            picker={<RepoPicker onSelect={setInputB} />}
          />
        </div>
        <div className="flex justify-center gap-3">
          <PrimaryButton
            onClick={handleCompare}
            disabled={state.step === 'loading' || !inputA.trim() || !inputB.trim()}
          >
            {state.step === 'loading' ? 'Comparing...' : 'Compare'}
          </PrimaryButton>
          {state.step === 'done' && (
            <SecondaryButton onClick={handleReset}>Reset</SecondaryButton>
          )}
        </div>
      </div>

      {state.step === 'loading' && <LoadingPanel message={state.progress} />}

      {state.step === 'error' && state.error && (
        <ErrorPanel title="Comparison failed" message={state.error} />
      )}

      {state.step === 'done' && state.reportA && state.reportB && (() => {
        const cardA = lightReportToReportCardData(state.reportA);
        const cardB = lightReportToReportCardData(state.reportB);
        const deltas = computeDeltasFromReports(cardA, cardB);
        const scoreDelta = cardA.overallScore - cardB.overallScore;
        const winner: 'a' | 'b' | 'tie' = scoreDelta > 0 ? 'a' : scoreDelta < 0 ? 'b' : 'tie';
        const nameA = `${cardA.repo.owner}/${cardA.repo.repo}`;
        const nameB = `${cardB.repo.owner}/${cardB.repo.repo}`;
        return (
          <CompareView
            reportA={cardA}
            reportB={cardB}
            deltas={deltas}
            winner={winner}
            scoreDelta={scoreDelta}
            extras={
              <>
                <TechStackComparison
                  techA={state.reportA.techStack}
                  techB={state.reportB.techStack}
                  nameA={nameA}
                  nameB={nameB}
                />
                <StatsComparison
                  reportA={state.reportA}
                  reportB={state.reportB}
                  nameA={nameA}
                  nameB={nameB}
                />
              </>
            }
          />
        );
      })()}
    </PageContainer>
  );
}

// ── Browser-only host extras (CLI doesn't surface tech-stack or repo stats via Compare RPC). ──

function TechStackComparison({
  techA,
  techB,
  nameA,
  nameB,
}: {
  techA: TechStackItem[];
  techB: TechStackItem[];
  nameA: string;
  nameB: string;
}) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-surface-alt border border-border">
      <h3 className="text-lg font-semibold text-text mb-4">Tech Stack</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-surface-hover border border-border">
          <h4 className="text-sm font-medium text-text-secondary mb-3 truncate">{nameA}</h4>
          {techA.length === 0 ? (
            <p className="text-sm text-text-muted">No tech stack detected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {techA.map((t) => (
                <TechBadge
                  key={t.name}
                  item={t}
                  highlighted={!techB.some((b) => b.name === t.name)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="p-4 rounded-xl bg-surface-hover border border-border">
          <h4 className="text-sm font-medium text-text-secondary mb-3 truncate">{nameB}</h4>
          {techB.length === 0 ? (
            <p className="text-sm text-text-muted">No tech stack detected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {techB.map((t) => (
                <TechBadge
                  key={t.name}
                  item={t}
                  highlighted={!techA.some((a) => a.name === t.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TechBadge({ item, highlighted }: { item: TechStackItem; highlighted: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
        highlighted
          ? 'bg-neon/15 border border-neon/30 text-neon'
          : 'bg-surface-alt border border-border text-text-secondary'
      }`}
    >
      {item.name}
      <span className="ml-1 text-text-muted">({item.category})</span>
    </span>
  );
}

function StatsComparison({
  reportA,
  reportB,
  nameA,
  nameB,
}: {
  reportA: LightAnalysisReport;
  reportB: LightAnalysisReport;
  nameA: string;
  nameB: string;
}) {
  const stats: { label: string; valueA: string; valueB: string }[] = [
    {
      label: 'Stars',
      valueA: formatNumber(reportA.repoInfo.stars),
      valueB: formatNumber(reportB.repoInfo.stars),
    },
    {
      label: 'Forks',
      valueA: formatNumber(reportA.repoInfo.forks),
      valueB: formatNumber(reportB.repoInfo.forks),
    },
    {
      label: 'Open Issues',
      valueA: formatNumber(reportA.repoInfo.openIssues),
      valueB: formatNumber(reportB.repoInfo.openIssues),
    },
    {
      label: 'Language',
      valueA: reportA.repoInfo.language || 'N/A',
      valueB: reportB.repoInfo.language || 'N/A',
    },
    {
      label: 'License',
      valueA: reportA.repoInfo.license || 'None',
      valueB: reportB.repoInfo.license || 'None',
    },
    {
      label: 'Files',
      valueA: formatNumber(reportA.treeEntryCount),
      valueB: formatNumber(reportB.treeEntryCount),
    },
  ];

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-surface-alt border border-border">
      <h3 className="text-lg font-semibold text-text mb-4">Repository Stats</h3>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 pb-3 border-b border-border mb-1">
        <div className="text-sm font-medium text-text-secondary truncate text-center">{nameA}</div>
        <div className="text-sm font-medium text-text-muted text-center">Metric</div>
        <div className="text-sm font-medium text-text-secondary truncate text-center">{nameB}</div>
      </div>

      {stats.map((stat) => (
        <div
          key={stat.label}
          className="grid grid-cols-3 gap-2 sm:gap-4 py-2.5 border-b border-border/50 last:border-b-0 items-center"
        >
          <div className="text-sm font-medium text-text text-center">{stat.valueA}</div>
          <div className="text-xs sm:text-sm text-text-muted text-center">{stat.label}</div>
          <div className="text-sm font-medium text-text text-center">{stat.valueB}</div>
        </div>
      ))}
    </div>
  );
}
