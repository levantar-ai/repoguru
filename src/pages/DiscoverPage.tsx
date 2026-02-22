import { useState, useCallback, useRef } from 'react';
import type {
  RepoInfo,
  TreeEntry,
  LightAnalysisReport,
  LetterGrade,
  DiscoveryFilters,
} from '../types';
import { githubFetch } from '../services/github/client';
import { runLightAnalysis } from '../services/analysis/lightEngine';
import type { GitHubTreeResponse } from '../services/github/types';
import { formatNumber, gradeColorClass } from '../utils/formatters';
import { useApp } from '../context/AppContext';

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (page: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const POPULAR_LANGUAGES = [
  '',
  'TypeScript',
  'JavaScript',
  'Python',
  'Rust',
  'Go',
  'Java',
  'C++',
  'C#',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'Dart',
  'Elixir',
  'Haskell',
  'Scala',
  'Shell',
  'Zig',
];

const SORT_OPTIONS: { value: DiscoveryFilters['sort']; label: string }[] = [
  { value: 'stars', label: 'Stars' },
  { value: 'updated', label: 'Recently Updated' },
  { value: 'forks', label: 'Forks' },
];

// ── Grade badge helpers ──────────────────────────────────────────────────────

function gradeBadgeBg(grade: LetterGrade): string {
  const map: Record<LetterGrade, string> = {
    A: 'bg-grade-a/15 border-grade-a/30',
    B: 'bg-grade-b/15 border-grade-b/30',
    C: 'bg-grade-c/15 border-grade-c/30',
    D: 'bg-grade-d/15 border-grade-d/30',
    F: 'bg-grade-f/15 border-grade-f/30',
  };
  return map[grade];
}

// ── GitHub search result shape ───────────────────────────────────────────────

interface GitHubSearchRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string; name: string } | null;
  topics: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  size: number;
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchRepo[];
}

// ── Per-card scan state ──────────────────────────────────────────────────────

interface CardState {
  scanning: boolean;
  report: LightAnalysisReport | null;
  error: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DiscoverPage({ onNavigate }: Props) {
  const { state: appState } = useApp();
  const token = appState.githubToken;

  // Filters
  const [language, setLanguage] = useState('');
  const [minStars, setMinStars] = useState(100);
  const [topic, setTopic] = useState('');
  const [sort, setSort] = useState<DiscoveryFilters['sort']>('stars');

  // Search state
  const [results, setResults] = useState<GitHubSearchRepo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Per-card scan state keyed by full_name
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});

  const abortRef = useRef<AbortController | null>(null);

  // ── Build search query ───────────────────────────────────────────────────

  const buildSearchPath = useCallback(() => {
    const parts: string[] = [];
    if (language) parts.push(`language:${language}`);
    if (topic.trim()) parts.push(`topic:${topic.trim()}`);
    if (minStars > 0) parts.push(`stars:>=${minStars}`);

    // Default: at least require some qualifier
    if (parts.length === 0) parts.push('stars:>=100');

    const q = parts.join(' ');
    return `/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&per_page=12`;
  }, [language, minStars, topic, sort]);

  // ── Search ───────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    setSearchError(null);
    setResults([]);
    setTotalCount(0);
    setHasSearched(true);
    setCardStates({});

    try {
      const path = buildSearchPath();
      const data = await githubFetch<GitHubSearchResponse>(path, token || undefined);

      if (controller.signal.aborted) return;

      setResults(data.items);
      setTotalCount(data.total_count);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }, [buildSearchPath, token]);

  // ── Quick Scan a single repo ─────────────────────────────────────────────

  const handleQuickScan = useCallback(
    async (repo: GitHubSearchRepo) => {
      const key = repo.full_name;

      setCardStates((prev) => ({
        ...prev,
        [key]: { scanning: true, report: null, error: null },
      }));

      try {
        // Build RepoInfo from search result
        const repoInfo: RepoInfo = {
          owner: repo.owner.login,
          repo: repo.name,
          defaultBranch: repo.default_branch,
          description: repo.description ?? '',
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          openIssues: repo.open_issues_count,
          license: repo.license?.spdx_id ?? null,
          language: repo.language,
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          topics: repo.topics ?? [],
          archived: repo.archived,
          size: repo.size,
        };

        // Fetch tree
        const treePath = `/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`;
        const treeData = await githubFetch<GitHubTreeResponse>(treePath, token || undefined);

        const treeEntries: TreeEntry[] = treeData.tree.map((e) => ({
          path: e.path,
          mode: e.mode,
          type: e.type,
          sha: e.sha,
          size: e.size,
        }));

        const parsedRepo = { owner: repo.owner.login, repo: repo.name };
        const report = runLightAnalysis(parsedRepo, repoInfo, treeEntries);

        setCardStates((prev) => ({
          ...prev,
          [key]: { scanning: false, report, error: null },
        }));
      } catch (err: unknown) {
        setCardStates((prev) => ({
          ...prev,
          [key]: {
            scanning: false,
            report: null,
            error: err instanceof Error ? err.message : 'Scan failed',
          },
        }));
      }
    },
    [token],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-8 lg:px-12 xl:px-16 py-10 sm:py-16">
      {/* Back button */}
      <button
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-neon transition-colors mb-8"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to report card
      </button>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text tracking-tight">
          Discover <span className="text-neon neon-text">Repositories</span>
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Search GitHub for repositories by language, stars, and topic. Run a quick health scan on
          any repo to see its grade before diving deeper.
        </p>
      </div>

      {/* ── Search Filters ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto mb-10">
        <div className="p-6 rounded-2xl bg-surface-alt border border-border neon-glow">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Language dropdown */}
            <div>
              <label
                htmlFor="discover-language"
                className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2"
              >
                Language
              </label>
              <select
                id="discover-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all appearance-none cursor-pointer"
              >
                <option value="">All Languages</option>
                {POPULAR_LANGUAGES.filter(Boolean).map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Stars input */}
            <div>
              <label
                htmlFor="discover-min-stars"
                className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2"
              >
                Min Stars
              </label>
              <input
                id="discover-min-stars"
                type="number"
                min={0}
                value={minStars}
                onChange={(e) => setMinStars(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="e.g. 100"
                className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
              />
            </div>

            {/* Topic input */}
            <div>
              <label
                htmlFor="discover-topic"
                className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2"
              >
                Topic
              </label>
              <input
                id="discover-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. react, cli, machine-learning"
                className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
              />
            </div>

            {/* Sort dropdown */}
            <div>
              <label
                htmlFor="discover-sort"
                className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2"
              >
                Sort By
              </label>
              <select
                id="discover-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as DiscoveryFilters['sort'])}
                className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all appearance-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search button */}
          <div className="mt-5 flex justify-center">
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-8 py-3 text-base font-semibold rounded-xl bg-neon text-surface transition-all hover:shadow-lg hover:shadow-neon/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {searching ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
                  Searching...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  Search Repositories
                </span>
              )}
            </button>
          </div>

          {!token && (
            <p className="text-xs text-text-muted mt-4 text-center">
              Search uses the GitHub Search API. Without a token you have 10 search req/min. Add a
              GitHub token in Settings for higher limits.
            </p>
          )}
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {searchError && (
        <div className="max-w-4xl mx-auto mb-8">
          <div className="px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25 text-sm text-grade-f">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 shrink-0 mt-0.5"
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
                <p className="font-medium">Search failed</p>
                <p className="mt-1 text-grade-f/80">{searchError}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results count ───────────────────────────────────────────────────── */}
      {hasSearched && !searching && !searchError && (
        <div className="max-w-7xl mx-auto mb-6">
          <p className="text-sm text-text-secondary">
            {totalCount > 0 ? (
              <>
                Found <span className="text-neon font-semibold">{formatNumber(totalCount)}</span>{' '}
                repositories
                {results.length < totalCount && (
                  <span className="text-text-muted"> (showing top {results.length})</span>
                )}
              </>
            ) : (
              'No repositories found. Try adjusting your filters.'
            )}
          </p>
        </div>
      )}

      {/* ── Loading skeleton ────────────────────────────────────────────────── */}
      {searching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto">
          {['sk-a', 'sk-b', 'sk-c', 'sk-d', 'sk-e', 'sk-f'].map((skId) => (
            <div
              key={skId}
              className="p-5 rounded-2xl bg-surface-alt border border-border animate-pulse"
            >
              <div className="h-5 bg-border/50 rounded w-3/4 mb-3" />
              <div className="h-4 bg-border/30 rounded w-full mb-2" />
              <div className="h-4 bg-border/30 rounded w-2/3 mb-4" />
              <div className="flex gap-3">
                <div className="h-4 bg-border/30 rounded w-12" />
                <div className="h-4 bg-border/30 rounded w-12" />
                <div className="h-4 bg-border/30 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Result Cards ────────────────────────────────────────────────────── */}
      {!searching && results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto">
          {results.map((repo) => {
            const key = repo.full_name;
            const card = cardStates[key];
            const isScanning = card?.scanning ?? false;
            const report = card?.report ?? null;
            const scanError = card?.error ?? null;

            return (
              <div
                key={repo.id}
                className="group relative p-5 rounded-2xl bg-surface-alt border border-border hover:border-border-bright hover:shadow-lg hover:shadow-neon/5 transition-all duration-200"
              >
                {/* Grade badge overlay when scanned */}
                {report && (
                  <div
                    className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${gradeBadgeBg(report.grade)}`}
                  >
                    <span className={`text-lg font-bold ${gradeColorClass(report.grade)}`}>
                      {report.grade}
                    </span>
                    <span className={`text-xs font-medium ${gradeColorClass(report.grade)}`}>
                      {report.overallScore}
                    </span>
                  </div>
                )}

                {/* Repo name */}
                <div className="pr-16">
                  <h3 className="text-base font-semibold text-neon truncate" title={repo.full_name}>
                    <a
                      href={`https://github.com/${repo.full_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {repo.full_name}
                    </a>
                  </h3>
                </div>

                {/* Description */}
                <p className="mt-2 text-sm text-text-secondary line-clamp-2 min-h-[2.5rem]">
                  {repo.description || 'No description provided.'}
                </p>

                {/* Stats row */}
                <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
                  {/* Stars */}
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {formatNumber(repo.stargazers_count)}
                  </span>

                  {/* Forks */}
                  <span className="inline-flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                      />
                    </svg>
                    {formatNumber(repo.forks_count)}
                  </span>

                  {/* Language */}
                  {repo.language && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-neon/60" />
                      {repo.language}
                    </span>
                  )}
                </div>

                {/* Topics */}
                {repo.topics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {repo.topics.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neon/10 text-neon border border-neon/20"
                      >
                        {t}
                      </span>
                    ))}
                    {repo.topics.length > 5 && (
                      <span className="px-2 py-0.5 text-[10px] text-text-muted">
                        +{repo.topics.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Scan error */}
                {scanError && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-grade-f/10 border border-grade-f/20 text-xs text-grade-f">
                    {scanError}
                  </div>
                )}

                {/* Category breakdown when scanned */}
                {report && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {report.categories.slice(0, 4).map((cat) => {
                        let catScoreColor = 'text-grade-f';
                        if (cat.score >= 70) catScoreColor = 'text-grade-a';
                        else if (cat.score >= 50) catScoreColor = 'text-grade-c';

                        return (
                          <div key={cat.key}>
                            <div className={`text-xs font-bold ${catScoreColor}`}>{cat.score}</div>
                            <div className="text-[10px] text-text-muted truncate">{cat.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex items-center gap-2">
                  {!report ? (
                    <button
                      onClick={() => handleQuickScan(repo)}
                      disabled={isScanning}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-neon/30 text-neon hover:bg-neon/10 hover:border-neon/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isScanning ? (
                        <>
                          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
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
                          Scanning...
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                            />
                          </svg>
                          Quick Scan
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigate(`analyze:${repo.full_name}`)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-neon/10 border border-neon/30 text-neon hover:bg-neon/20 transition-all"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      Full Analysis
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty idle state ────────────────────────────────────────────────── */}
      {!hasSearched && !searching && (
        <div className="text-center mt-12">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-neon/10 border border-neon/20 mb-6">
            <svg
              className="h-10 w-10 text-neon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">Discover Open Source Projects</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Set your filters above and search to find repositories. Then use{' '}
            <span className="text-neon font-medium">Quick Scan</span> on any repo to instantly see
            its health grade using lightweight tree-only analysis (2 API calls per scan).
          </p>
        </div>
      )}

      {/* ── No results state ────────────────────────────────────────────────── */}
      {hasSearched && !searching && !searchError && results.length === 0 && (
        <div className="text-center mt-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-alt border border-border mb-5">
            <svg
              className="h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">No Results Found</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Try broadening your search by lowering the minimum stars, removing the topic filter, or
            selecting a different language.
          </p>
        </div>
      )}
    </div>
  );
}
