import { useState, useCallback } from 'react';
import type {
  RepoInfo,
  TreeEntry,
  LightAnalysisReport,
  CategoryKey,
  Signal,
  TechStackItem,
  LetterGrade,
} from '../types';
import { parseRepoUrl } from '../services/github/parser';
import { githubFetch } from '../services/github/client';
import { runLightAnalysis } from '../services/analysis/lightEngine';
import type { GitHubRepoResponse, GitHubTreeResponse } from '../services/github/types';
import { scoreToGrade, formatNumber, gradeColorClass } from '../utils/formatters';
import { CATEGORY_LABELS } from '../utils/constants';
import { invalidateIfNeitherMatch } from '../services/git/repoCache';
import { ensureCloned } from '../services/git/cloneService';
import { RepoPicker } from '../components/common/RepoPicker';

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

const CATEGORY_ORDER: CategoryKey[] = [
  'documentation',
  'security',
  'cicd',
  'dependencies',
  'codeQuality',
  'license',
  'community',
  'openssf',
];

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

function scoreColorClass(score: number): string {
  const grade = scoreToGrade(score);
  return gradeColorClass(grade);
}

function gradeGlowClass(grade: LetterGrade): string {
  if (grade === 'A') return 'text-grade-a neon-glow-strong';
  if (grade === 'B') return 'text-grade-b';
  return gradeColorClass(grade);
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
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(new Set());

  const toggleCategory = useCallback((key: CategoryKey) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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

    // Try clone-first approach
    try {
      setProgress(`Cloning ${label}...`);
      const cached = await ensureCloned(parsed.owner, parsed.repo, (_step, _percent, message) => {
        setProgress(`${label}: ${message}`);
      });
      tree = cached.tree;
    } catch (cloneErr) {
      // Fallback to API if token available
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

    setState({
      step: 'loading',
      progress: 'Starting comparison...',
      reportA: null,
      reportB: null,
      error: null,
    });

    try {
      const setProgress = (msg: string) => setState((prev) => ({ ...prev, progress: msg }));

      // Parse both repos upfront for cache invalidation
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
    setState({ step: 'idle', progress: '', reportA: null, reportB: null, error: null });
    setExpandedCategories(new Set());
  }, []);

  // ── Render ──

  return (
    <div className="w-full px-8 lg:px-12 xl:px-16 py-10">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text tracking-tight">
          Compare <span className="text-neon neon-glow">Repositories</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-text-secondary max-w-xl mx-auto">
          Analyze two GitHub repos side by side. See which one scores higher across all categories.
        </p>
      </div>

      {/* Input area */}
      <div className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <label
              htmlFor="compare-repo-a"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Repo A
            </label>
            <input
              id="compare-repo-a"
              type="text"
              value={inputA}
              onChange={(e) => setInputA(e.target.value)}
              placeholder="owner/repo"
              disabled={state.step === 'loading'}
              onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
              className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-text placeholder-text-muted focus:outline-none focus:border-border-bright focus:ring-1 focus:ring-border-bright transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="compare-repo-b"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Repo B
            </label>
            <input
              id="compare-repo-b"
              type="text"
              value={inputB}
              onChange={(e) => setInputB(e.target.value)}
              placeholder="owner/repo"
              disabled={state.step === 'loading'}
              onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
              className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-text placeholder-text-muted focus:outline-none focus:border-border-bright focus:ring-1 focus:ring-border-bright transition-colors disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={handleCompare}
            disabled={state.step === 'loading' || !inputA.trim() || !inputB.trim()}
            className="px-8 py-3 rounded-xl bg-neon/15 border border-neon/30 text-neon font-semibold hover:bg-neon/25 hover:border-neon/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed neon-glow"
          >
            {state.step === 'loading' ? 'Comparing...' : 'Compare'}
          </button>
          {state.step === 'done' && (
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-xl bg-surface-alt border border-border text-text-secondary font-medium hover:border-border-bright hover:text-text transition-all"
            >
              Reset
            </button>
          )}
        </div>

        {/* Repo picker — browse your repos to fill either slot */}
        {state.step !== 'loading' && (
          <div className="max-w-2xl mx-auto">
            <RepoPicker
              onSelect={(slug) => {
                if (!inputA.trim()) setInputA(slug);
                else if (!inputB.trim()) setInputB(slug);
                else setInputA(slug);
              }}
            />
          </div>
        )}
      </div>

      {/* Loading */}
      {state.step === 'loading' && (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-surface-alt border border-border">
            <svg
              className="animate-spin h-5 w-5 text-neon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-text-secondary">{state.progress}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {state.step === 'error' && state.error && (
        <div className="max-w-2xl mx-auto mb-8 px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-grade-f shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-grade-f">Comparison failed</p>
              <p className="text-sm text-text-secondary mt-1">{state.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {state.step === 'done' && state.reportA && state.reportB && (
        <CompareResults
          reportA={state.reportA}
          reportB={state.reportB}
          expandedCategories={expandedCategories}
          onToggleCategory={toggleCategory}
        />
      )}
    </div>
  );
}

// ── Results display ──

function CompareResults({
  reportA,
  reportB,
  expandedCategories,
  onToggleCategory,
}: {
  reportA: LightAnalysisReport;
  reportB: LightAnalysisReport;
  expandedCategories: Set<CategoryKey>;
  onToggleCategory: (key: CategoryKey) => void;
}) {
  const nameA = `${reportA.repo.owner}/${reportA.repo.repo}`;
  const nameB = `${reportB.repo.owner}/${reportB.repo.repo}`;
  const diff = reportA.overallScore - reportB.overallScore;

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 text-center">
        <h2 className="text-lg sm:text-xl font-bold text-text truncate max-w-[40%]">{nameA}</h2>
        <span className="text-text-muted text-sm font-medium shrink-0">vs</span>
        <h2 className="text-lg sm:text-xl font-bold text-text truncate max-w-[40%]">{nameB}</h2>
      </div>

      {/* Grade circles */}
      <div className="flex items-center justify-center gap-6 sm:gap-12">
        <GradeDisplay
          grade={reportA.grade}
          score={reportA.overallScore}
          label={reportA.repo.repo}
          isWinner={diff > 0}
        />
        <div className="text-2xl text-text-muted font-light">vs</div>
        <GradeDisplay
          grade={reportB.grade}
          score={reportB.overallScore}
          label={reportB.repo.repo}
          isWinner={diff < 0}
        />
      </div>

      {/* Winner banner */}
      <WinnerBanner nameA={nameA} nameB={nameB} diff={diff} />

      {/* Category comparison */}
      <div className="p-5 sm:p-6 rounded-2xl bg-surface-alt border border-border">
        <h3 className="text-lg font-semibold text-text mb-5">Category Breakdown</h3>
        <div className="space-y-1">
          {CATEGORY_ORDER.map((key) => {
            const catA = reportA.categories.find((c) => c.key === key);
            const catB = reportB.categories.find((c) => c.key === key);
            if (!catA || !catB) return null;
            return (
              <CategoryRow
                key={key}
                categoryKey={key}
                label={CATEGORY_LABELS[key]}
                scoreA={catA.score}
                scoreB={catB.score}
                signalsA={catA.signals}
                signalsB={catB.signals}
                isExpanded={expandedCategories.has(key)}
                onToggle={() => onToggleCategory(key)}
              />
            );
          })}
        </div>
      </div>

      {/* Tech stack comparison */}
      <TechStackComparison
        techA={reportA.techStack}
        techB={reportB.techStack}
        nameA={nameA}
        nameB={nameB}
      />

      {/* Stats comparison */}
      <StatsComparison reportA={reportA} reportB={reportB} nameA={nameA} nameB={nameB} />
    </div>
  );
}

// ── Grade circle ──

function GradeDisplay({
  grade,
  score,
  label,
  isWinner,
}: {
  grade: LetterGrade;
  score: number;
  label: string;
  isWinner: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`
          w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center
          border-2 transition-all
          ${isWinner ? 'border-neon/60 bg-neon/10 neon-glow' : 'border-border bg-surface-alt'}
        `}
      >
        <span className={`text-2xl sm:text-3xl font-bold ${gradeGlowClass(grade)}`}>{grade}</span>
        <span className={`text-xs sm:text-sm font-medium ${scoreColorClass(score)}`}>
          {score}/100
        </span>
      </div>
      <span className="text-xs text-text-muted truncate max-w-[100px] sm:max-w-[140px]">
        {label}
      </span>
    </div>
  );
}

// ── Winner banner ──

function WinnerBanner({ nameA, nameB, diff }: { nameA: string; nameB: string; diff: number }) {
  if (diff === 0) {
    return (
      <div className="text-center py-3 px-6 rounded-xl bg-neon/10 border border-neon/25">
        <span className="text-neon font-bold text-lg neon-glow">It's a tie!</span>
        <p className="text-sm text-text-secondary mt-1">Both repositories scored equally.</p>
      </div>
    );
  }

  const winner = diff > 0 ? nameA : nameB;
  const margin = Math.abs(diff);

  return (
    <div className="text-center py-3 px-6 rounded-xl bg-neon/10 border border-neon/25">
      <span className="text-neon font-bold text-lg neon-glow">{winner}</span>
      <span className="text-text-secondary text-lg"> wins by </span>
      <span className="text-neon font-bold text-lg">{margin}</span>
      <span className="text-text-secondary text-lg"> point{margin !== 1 ? 's' : ''}</span>
    </div>
  );
}

// ── Category row with dual bar ──

function CategoryRow({
  categoryKey: _categoryKey, // eslint-disable-line @typescript-eslint/no-unused-vars -- reserved for future use
  label,
  scoreA,
  scoreB,
  signalsA,
  signalsB,
  isExpanded,
  onToggle,
}: {
  categoryKey: CategoryKey;
  label: string;
  scoreA: number;
  scoreB: number;
  signalsA: Signal[];
  signalsB: Signal[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const aWins = scoreA > scoreB;
  const bWins = scoreB > scoreA;

  // Find signals that differ between the two repos
  const diffSignals: { name: string; foundA: boolean; foundB: boolean }[] = [];
  const allSignalNames = new Set([...signalsA.map((s) => s.name), ...signalsB.map((s) => s.name)]);
  for (const name of allSignalNames) {
    const sigA = signalsA.find((s) => s.name === name);
    const sigB = signalsB.find((s) => s.name === name);
    const foundA = sigA?.found ?? false;
    const foundB = sigB?.found ?? false;
    if (foundA !== foundB) {
      diffSignals.push({ name, foundA, foundB });
    }
  }

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 hover:bg-surface-hover rounded-xl transition-colors group"
      >
        {/* Score A */}
        <span
          className={`text-sm sm:text-base font-bold w-10 text-right shrink-0 ${aWins ? 'text-neon' : scoreColorClass(scoreA)}`}
        >
          {scoreA}
        </span>

        {/* Dual bar */}
        <div className="flex-1 flex items-center gap-0.5 min-w-0">
          {/* Left bar (A) — grows from right to left */}
          <div className="flex-1 h-3 sm:h-4 rounded-l-full bg-surface-hover overflow-hidden flex justify-end">
            <div
              className={`h-full rounded-l-full transition-all duration-500 ${aWins ? 'bg-neon/60 neon-glow' : 'bg-text-muted/30'}`}
              style={{ width: `${scoreA}%` }}
            />
          </div>
          {/* Right bar (B) — grows from left to right */}
          <div className="flex-1 h-3 sm:h-4 rounded-r-full bg-surface-hover overflow-hidden flex justify-start">
            <div
              className={`h-full rounded-r-full transition-all duration-500 ${bWins ? 'bg-neon/60 neon-glow' : 'bg-text-muted/30'}`}
              style={{ width: `${scoreB}%` }}
            />
          </div>
        </div>

        {/* Score B */}
        <span
          className={`text-sm sm:text-base font-bold w-10 text-left shrink-0 ${bWins ? 'text-neon' : scoreColorClass(scoreB)}`}
        >
          {scoreB}
        </span>

        {/* Expand icon */}
        <svg
          className={`h-4 w-4 text-text-muted shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Category label centered below the bar */}
      <div className="text-center -mt-1 mb-1">
        <span className="text-xs sm:text-sm text-text-secondary font-medium">{label}</span>
        {diffSignals.length > 0 && (
          <span className="ml-1.5 text-xs text-text-muted">
            ({diffSignals.length} diff{diffSignals.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* Expandable signal diff */}
      {isExpanded && diffSignals.length > 0 && (
        <div className="mx-3 sm:mx-4 mb-3 p-3 sm:p-4 rounded-lg bg-surface-hover border border-border">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Signal Differences
          </h4>
          <div className="space-y-1.5">
            {diffSignals.map((sig) => (
              <div key={sig.name} className="flex items-center text-sm gap-2">
                <span className="w-5 text-center shrink-0">
                  {sig.foundA ? (
                    <span className="text-grade-a">+</span>
                  ) : (
                    <span className="text-grade-f">-</span>
                  )}
                </span>
                <span className="flex-1 text-text-secondary truncate">{sig.name}</span>
                <span className="w-5 text-center shrink-0">
                  {sig.foundB ? (
                    <span className="text-grade-a">+</span>
                  ) : (
                    <span className="text-grade-f">-</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-text-muted mt-2 pt-2 border-t border-border">
            <span>Repo A</span>
            <span>Repo B</span>
          </div>
        </div>
      )}

      {isExpanded && diffSignals.length === 0 && (
        <div className="mx-3 sm:mx-4 mb-3 p-3 rounded-lg bg-surface-hover border border-border">
          <p className="text-sm text-text-muted text-center">No signal differences in {label}.</p>
        </div>
      )}
    </div>
  );
}

// ── Tech stack comparison ──

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
        {/* Repo A */}
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
        {/* Repo B */}
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
      className={`
        inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium
        ${
          highlighted
            ? 'bg-neon/15 border border-neon/30 text-neon'
            : 'bg-surface-alt border border-border text-text-secondary'
        }
      `}
    >
      {item.name}
      <span className="ml-1 text-text-muted">({item.category})</span>
    </span>
  );
}

// ── Stats comparison ──

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
  const stats: { label: string; valueA: string; valueB: string; higherWins?: boolean }[] = [
    {
      label: 'Stars',
      valueA: formatNumber(reportA.repoInfo.stars),
      valueB: formatNumber(reportB.repoInfo.stars),
      higherWins: true,
    },
    {
      label: 'Forks',
      valueA: formatNumber(reportA.repoInfo.forks),
      valueB: formatNumber(reportB.repoInfo.forks),
      higherWins: true,
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

      {/* Header */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 pb-3 border-b border-border mb-1">
        <div className="text-sm font-medium text-text-secondary truncate text-center">{nameA}</div>
        <div className="text-sm font-medium text-text-muted text-center">Metric</div>
        <div className="text-sm font-medium text-text-secondary truncate text-center">{nameB}</div>
      </div>

      {/* Rows */}
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
