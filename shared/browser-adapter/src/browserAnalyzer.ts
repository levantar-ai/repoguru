// BrowserAnalyzer — implements the @repoguru/core RepoAnalyzer port for
// the in-browser pipeline (clone via isomorphic-git → analyzeGitStats).
//
// The browser flow is monolithic: one big computation, then results. The
// adapter wraps it and slices the resulting `GitStatsAnalysis` into the
// canonical sectioned `GitStatsData` so views consume the same shape they
// would from the gRPC adapter.
//
// The actual clone+analyze runner is provided by the host app via the
// `BrowserAnalysisRunner` injection — that keeps this package free of
// dependencies on isomorphic-git, lightning-fs, GitHub services, etc.

import {
  AnalyzeError,
  type AnalyzeEvent,
  type AnalyzeRequest,
  type ActivitySection,
  type ContributorsSection,
  type CodebaseSection,
  type GitStatsData,
  type GitStatsSectionName,
  type HealthSection,
  type PatternsSection,
  type ProgressEvent,
  type RepoAnalyzer,
  type RepoOverview,
  type TimezoneSection,
} from '@repoguru/core';

import type { BrowserGitStatsAnalysis } from './wireTypes.js';

// ────────────────────────────────────────────────────────────────────────────
// Host-supplied runner.
// ────────────────────────────────────────────────────────────────────────────

export interface BrowserAnalysisRunner {
  /**
   * Drive the in-browser clone + analysis. The runner is host-supplied
   * because it needs isomorphic-git, lightning-fs, and GitHub API services
   * — none of which belong in this package.
   *
   * Invoke `onProgress` repeatedly during the run; resolve with the full
   * GitStatsAnalysis. Throw AnalyzeError on failure. Honor the AbortSignal
   * if provided.
   */
  run(
    request: AnalyzeRequest,
    onProgress: (event: ProgressEvent) => void,
    signal?: AbortSignal,
  ): Promise<BrowserGitStatsAnalysis>;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers — pure functions, exported for unit tests.
// ────────────────────────────────────────────────────────────────────────────

export function mapOverview(a: BrowserGitStatsAnalysis): RepoOverview {
  return {
    owner: a.owner,
    repo: a.repo,
    totalCommits: a.totalCommits,
    totalLinesOfCode: a.totalLinesOfCode,
    binaryFileCount: a.binaryFileCount,
    firstCommitDate: a.firstCommitDate,
    repoAgeDays: a.repoAgeDays,
  };
}

export function mapActivity(a: BrowserGitStatsAnalysis): ActivitySection {
  // Browser doesn't compute a true {commits, insertions, deletions, authors}
  // weekly timeseries directly. Best-effort: align weeklyActivity (commits)
  // with codeFrequency (additions, deletions). Authors-per-period isn't
  // available from the browser pipeline, so we leave it 0.
  const codeFreqByWeek = new Map<number, [number, number]>();
  for (const [ts, additions, deletions] of a.codeFrequency ?? []) {
    codeFreqByWeek.set(ts * 1000, [additions, deletions]);
  }

  const timeseries = a.weeklyActivity.map((w) => {
    const wkMs = Date.parse(w.weekStart);
    const cf = codeFreqByWeek.get(wkMs);
    return {
      periodStart: w.weekStart,
      commits: w.total,
      insertions: cf?.[0] ?? 0,
      deletions: cf?.[1] ?? 0,
      authors: 0,
    };
  });

  return {
    timeseries,
    cumulativeFiles: a.cumulativeFiles,
    fileOperations: a.fileOperations,
    linesByExtension: a.linesByExtension,
    linesStatsSummary: a.linesStatsSummary,
  };
}

export function mapContributors(a: BrowserGitStatsAnalysis): ContributorsSection {
  return {
    contributors: a.contributors.map((c) => ({
      id: c.login,
      name: c.login,
      login: c.login,
      avatarUrl: c.avatarUrl,
      commits: c.totalCommits,
      insertions: c.totalAdditions,
      deletions: c.totalDeletions,
      firstCommit: c.firstCommitWeek,
      lastCommit: c.lastCommitWeek,
      commitPercentage: c.commitPercentage,
    })),
    network: {
      nodes: a.contributorNodes,
      edges: a.contributorEdges,
    },
    authorOfYear: a.authorOfYear,
    authorOfMonth: a.authorOfMonth,
    authorTimelines: a.authorTimelines,
    codeOwnership: a.codeOwnership,
  };
}

export function mapCodebase(a: BrowserGitStatsAnalysis): CodebaseSection {
  // Browser fileCoupling is {file1, file2, cochanges} with no native
  // couplingPct — derive it as cochanges / totalCommits * 100 so the view
  // sees the same scale either backend provides.
  const denom = a.totalCommits || 1;
  const result: CodebaseSection = {
    hotspots: a.hotspots,
    fileCoupling: a.fileCoupling.map((c) => ({
      fileA: c.file1,
      fileB: c.file2,
      count: c.cochanges,
      couplingPct: (c.cochanges / denom) * 100,
    })),
    fileChurn: a.fileChurn,
    sequentialCoupling: a.sequentialCoupling,
  };
  if (a.linesByExtTime !== null) result.linesByExtTime = a.linesByExtTime;
  return result;
}

export function mapPatterns(a: BrowserGitStatsAnalysis): PatternsSection {
  return {
    commitsByWeekday: a.commitsByWeekday,
    commitsByMonth: a.commitsByMonth,
    commitsByYear: a.commitsByYear,
    commitsByHour: a.commitsByHour,
    punchCard: a.punchCard,
    commitSizeHistogram: a.commitSizeDistribution.buckets.map((b) => ({
      label: b.label,
      min: b.min,
      max: b.max,
      count: b.count,
    })),
    weeklyActivity: a.weeklyActivity,
    wordFrequencies: a.commitMessages.wordFrequency,
    languageBreakdown: a.languages.map((l) => ({
      language: l.name,
      percentage: l.percentage,
      bytes: l.bytes,
    })),
    conventionalCommits: { ...a.commitMessages.conventionalCommits },
    commitMessages: {
      totalCommits: a.commitMessages.totalCommits,
      averageLength: a.commitMessages.averageLength,
      medianLength: a.commitMessages.medianLength,
      mergeCommitCount: a.commitMessages.mergeCommitCount,
      conventionalPercentage: a.commitMessages.conventionalPercentage,
    },
    commitsByExtension: a.commitsByExtension,
    commitsByDomain: a.commitsByDomain,
  };
}

export function mapHealth(a: BrowserGitStatsAnalysis): HealthSection {
  return {
    busFactor: {
      factor: a.busFactor.busFactor,
      // Lorenz curve = cumulative percentages on a 0..1 scale.
      lorenz: a.busFactor.cumulativeContributors.map((c) => c.cumulativePercentage / 100),
      herfindahlIndex: a.busFactor.herfindahlIndex,
      cumulativeContributors: a.busFactor.cumulativeContributors.map((c) => ({
        contributorId: c.login,
        cumulativePercentage: c.cumulativePercentage,
      })),
    },
    radarMetrics: a.radarMetrics,
    tagHistory: a.tagHistory,
    repoGrowth: a.repoGrowth,
    locOverTime: a.locOverTime,
    topActivePeriods: a.topActivePeriods,
  };
}

export function mapTimezone(a: BrowserGitStatsAnalysis): TimezoneSection {
  return { buckets: a.timezoneData };
}

/** Slice a complete BrowserGitStatsAnalysis into the canonical sectioned shape. */
export function mapBrowserAnalysis(a: BrowserGitStatsAnalysis): GitStatsData {
  return {
    overview: mapOverview(a),
    activity: mapActivity(a),
    contributors: mapContributors(a),
    codebase: mapCodebase(a),
    patterns: mapPatterns(a),
    health: mapHealth(a),
    timezone: mapTimezone(a),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// The analyzer itself.
// ────────────────────────────────────────────────────────────────────────────

const ALL_SECTIONS = [
  'overview',
  'activity',
  'contributors',
  'codebase',
  'patterns',
  'health',
  'timezone',
] as const satisfies readonly GitStatsSectionName[];

export class BrowserAnalyzer implements RepoAnalyzer {
  // Explicit field rather than a parameter property so this package
  // consumes cleanly from hosts that enable `erasableSyntaxOnly`.
  private readonly runner: BrowserAnalysisRunner;

  constructor(runner: BrowserAnalysisRunner) {
    this.runner = runner;
  }

  async *analyze(request: AnalyzeRequest, signal?: AbortSignal): AsyncIterable<AnalyzeEvent> {
    const queue: ProgressEvent[] = [];
    let resolveProgress: (() => void) | null = null;
    const onProgress = (event: ProgressEvent): void => {
      queue.push(event);
      resolveProgress?.();
      resolveProgress = null;
    };

    let analysisPromise: Promise<BrowserGitStatsAnalysis>;
    try {
      analysisPromise = this.runner.run(request, onProgress, signal);
    } catch (err) {
      yield { kind: 'error', error: toAnalyzeError(err, 'runner.run threw') };
      return;
    }

    let analysis: BrowserGitStatsAnalysis | null = null;
    let runError: unknown = null;
    let done = false;
    analysisPromise.then(
      (a) => {
        analysis = a;
        done = true;
        resolveProgress?.();
      },
      (e) => {
        runError = e;
        done = true;
        resolveProgress?.();
      },
    );

    while (!done || queue.length > 0) {
      while (queue.length > 0) {
        const event = queue.shift()!;
        yield { kind: 'progress', event };
      }
      if (done) break;
      await new Promise<void>((resolve) => {
        resolveProgress = resolve;
      });
    }

    if (runError !== null) {
      yield {
        kind: 'error',
        error: toAnalyzeError(runError, 'browser analysis failed'),
      };
      return;
    }
    if (analysis === null) {
      yield {
        kind: 'error',
        error: new AnalyzeError(
          'no_analysis',
          'BrowserAnalysisRunner resolved without a GitStatsAnalysis',
        ),
      };
      return;
    }

    const wanted = new Set<GitStatsSectionName>(request.sections ?? ALL_SECTIONS);
    const aggregate: GitStatsData = {};

    if (wanted.has('overview')) {
      aggregate.overview = mapOverview(analysis);
      yield {
        kind: 'section',
        section: { name: 'overview', data: aggregate.overview },
      };
    }
    if (wanted.has('activity')) {
      aggregate.activity = mapActivity(analysis);
      yield {
        kind: 'section',
        section: { name: 'activity', data: aggregate.activity },
      };
    }
    if (wanted.has('contributors')) {
      aggregate.contributors = mapContributors(analysis);
      yield {
        kind: 'section',
        section: { name: 'contributors', data: aggregate.contributors },
      };
    }
    if (wanted.has('codebase')) {
      aggregate.codebase = mapCodebase(analysis);
      yield {
        kind: 'section',
        section: { name: 'codebase', data: aggregate.codebase },
      };
    }
    if (wanted.has('patterns')) {
      aggregate.patterns = mapPatterns(analysis);
      yield {
        kind: 'section',
        section: { name: 'patterns', data: aggregate.patterns },
      };
    }
    if (wanted.has('health')) {
      aggregate.health = mapHealth(analysis);
      yield {
        kind: 'section',
        section: { name: 'health', data: aggregate.health },
      };
    }
    if (wanted.has('timezone')) {
      aggregate.timezone = mapTimezone(analysis);
      yield {
        kind: 'section',
        section: { name: 'timezone', data: aggregate.timezone },
      };
    }

    yield { kind: 'done', data: aggregate };
  }
}

function toAnalyzeError(err: unknown, fallback: string): AnalyzeError {
  if (err instanceof AnalyzeError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new AnalyzeError('browser_failed', `${fallback}: ${message}`);
}
