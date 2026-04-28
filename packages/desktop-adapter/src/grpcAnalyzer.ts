// GrpcAnalyzer — implements the @repoguru/core RepoAnalyzer port by talking
// to the Rust `repoanalyze` sidecar over gRPC (in practice via Electron IPC).
//
// Two responsibilities:
//   1. Sequence the calls: getReport first (for the author_names mapping),
//      then all sections in parallel, yielding each as it settles so the
//      UI renders progressively.
//   2. Map snake_case wire payloads to the canonical camelCase shape from
//      @repoguru/core. The mappers are pure and unit-testable in isolation.

import {
  AnalyzeError,
  GIT_STATS_SECTIONS,
  type AnalyzeEvent,
  type AnalyzeRequest,
  type ActivitySection,
  type Contributor,
  type ContributorsSection,
  type CodebaseSection,
  type GitStatsData,
  type GitStatsSectionName,
  type HealthSection,
  type PatternsSection,
  type RepoAnalyzer,
  type RepoOverview,
  type TimezoneSection,
} from '@repoguru/core';

import type {
  WireActivity,
  WireCodebase,
  WireContributors,
  WireHealth,
  WireMetrics,
  WirePatterns,
  WireTimezone,
} from './wireTypes.js';

// ────────────────────────────────────────────────────────────────────────────
// gRPC client surface the adapter requires.
//
// Defined here as a small interface so the adapter is decoupled from any
// specific transport. The real desktop app injects the existing
// `grpcClient` (window.repoGuru) which already matches this shape.
// ────────────────────────────────────────────────────────────────────────────

export interface GrpcSectionClient {
  getReport(outPath: string): Promise<{ metrics_json: string }>;
  getSection(
    outPath: string,
    section: string,
    repoPath?: string,
  ): Promise<{ data_json: string }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappers — pure functions, exported for unit tests.
// ────────────────────────────────────────────────────────────────────────────

export function mapOverview(metrics: WireMetrics): RepoOverview {
  return {
    owner: metrics.owner ?? '',
    repo: metrics.repo ?? '',
    totalCommits: metrics.total_commits ?? 0,
    totalLinesOfCode: metrics.total_lines_of_code ?? 0,
    binaryFileCount: metrics.binary_file_count ?? 0,
    firstCommitDate: metrics.first_commit_date ?? '',
    repoAgeDays: metrics.repo_age_days ?? 0,
  };
}

export function mapActivity(wire: WireActivity): ActivitySection {
  return {
    timeseries: (wire.timeseries ?? []).map((p) => ({
      periodStart: p.period_start,
      commits: p.commits,
      insertions: p.insertions,
      deletions: p.deletions,
      authors: p.authors,
    })),
    cumulativeFiles: (wire.cumulative_files ?? []).map(([date, count]) => ({
      date,
      count,
    })),
    fileOperations: (wire.file_operations ?? []).map(([operation, count]) => ({
      operation,
      count,
    })),
    linesByExtension: (wire.lines_by_ext ?? []).map(
      ([ext, additions, deletions]) => ({ ext, additions, deletions }),
    ),
    linesStatsSummary: wire.lines_stats_summary ?? [],
  };
}

export function mapContributors(
  wire: WireContributors,
  authorNames: Record<string, string>,
): ContributorsSection {
  const nameOf = (id: number): string =>
    authorNames[String(id)] ?? `author#${id}`;

  const totalCommits = (wire.authors ?? []).reduce(
    (sum, a) => sum + a.commits,
    0,
  );

  const contributors: Contributor[] = (wire.authors ?? []).map((a) => {
    const name = nameOf(a.author_id);
    return {
      id: String(a.author_id),
      name,
      commits: a.commits,
      insertions: a.insertions,
      deletions: a.deletions,
      firstCommit: a.first_commit,
      lastCommit: a.last_commit,
      commitPercentage:
        totalCommits > 0 ? (a.commits / totalCommits) * 100 : 0,
    };
  });

  return {
    contributors,
    network: {
      nodes: (wire.contributor_network_nodes ?? []).map(([id, name]) => ({
        id: String(id),
        name,
      })),
      edges: (wire.contributor_network_edges ?? []).map((e) => ({
        source: String(e.source),
        target: String(e.target),
        weight: e.weight,
      })),
    },
  };
}

export function mapCodebase(wire: WireCodebase): CodebaseSection {
  return {
    hotspots: (wire.hotspots ?? []).map((h) => ({
      path: h.path,
      commits: h.commits,
      totalChurn: h.total_churn,
      distinctAuthors: h.distinct_authors,
    })),
    fileCoupling: (wire.file_coupling ?? []).map((c) => ({
      fileA: c.file_a,
      fileB: c.file_b,
      count: c.count,
      couplingPct: c.coupling_pct,
    })),
  };
}

export function mapPatterns(wire: WirePatterns): PatternsSection {
  return {
    commitsByWeekday: wire.commits_by_weekday ?? new Array(7).fill(0),
    commitsByMonth: wire.commits_by_month ?? new Array(12).fill(0),
    commitsByYear: Object.entries(wire.commits_by_year ?? {})
      .map(([year, count]) => ({ year: Number(year), count }))
      .sort((a, b) => a.year - b.year),
    commitsByHour: wire.commits_by_hour ?? new Array(24).fill(0),
    punchCard: (wire.punch_card ?? []).map(([day, hour, commits]) => ({
      day,
      hour,
      commits,
    })),
    commitSizeHistogram: (wire.commit_size_histogram ?? []).map(
      ([label, count]) => ({ label, count }),
    ),
    weeklyActivity: (wire.weekly_activity ?? []).map(([weekStart, total]) => ({
      weekStart,
      total,
    })),
    wordFrequencies: (wire.word_frequencies ?? []).map(([word, count]) => ({
      word,
      count,
    })),
    // The shipped binary emits language_breakdown either as an array
     // of objects (legacy wire shape) or as a `{ Lang: fileCount }` map
     // (current binary). Normalise both.
    languageBreakdown: Array.isArray(wire.language_breakdown)
      ? wire.language_breakdown.map((l) => ({
          language: l.language,
          percentage: l.percentage,
          fileCount: l.file_count,
          totalLines: l.total_lines,
        }))
      : (() => {
          const entries = Object.entries(
            (wire.language_breakdown ?? {}) as Record<string, number>,
          );
          const totalFiles = entries.reduce((s, [, n]) => s + (Number(n) || 0), 0);
          return entries.map(([language, fileCount]) => ({
            language,
            percentage: totalFiles > 0 ? (Number(fileCount) / totalFiles) * 100 : 0,
            fileCount: Number(fileCount) || 0,
            totalLines: 0,
          }));
        })(),
    conventionalCommits: wire.conventional_commits ?? {},
  };
}

export function mapHealth(wire: WireHealth): HealthSection {
  return {
    busFactor: wire.bus_factor ?? { factor: 0, lorenz: [] },
    radarMetrics: wire.radar_metrics ?? [],
    tagHistory: (wire.tag_history ?? []).map((t) => ({
      name: t.name,
      date: t.date,
      timestamp: t.timestamp,
      commitsSincePrev: t.commits_since_prev,
    })),
  };
}

export function mapTimezone(wire: WireTimezone): TimezoneSection {
  return {
    buckets: (wire.timezone_data ?? []).map(([offset, count]) => ({
      offset,
      count,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// The analyzer itself.
// ────────────────────────────────────────────────────────────────────────────

/** Sections fetched via getSection(). Overview comes from getReport() instead. */
const REMOTE_SECTIONS = [
  'activity',
  'contributors',
  'codebase',
  'patterns',
  'health',
  'timezone',
] as const satisfies readonly GitStatsSectionName[];

export class GrpcAnalyzer implements RepoAnalyzer {
  // Explicit field rather than a parameter property so this package
  // consumes cleanly from hosts that enable `erasableSyntaxOnly`.
  private readonly client: GrpcSectionClient;

  constructor(client: GrpcSectionClient) {
    this.client = client;
  }

  async *analyze(
    request: AnalyzeRequest,
    signal?: AbortSignal,
  ): AsyncIterable<AnalyzeEvent> {
    const { source, outPath, sections } = request;
    if (!outPath) {
      yield {
        kind: 'error',
        error: new AnalyzeError(
          'missing_out_path',
          'GrpcAnalyzer requires AnalyzeRequest.outPath (Rust scan artefact directory).',
          'Run a scan first and pass its out_path here.',
        ),
      };
      return;
    }

    const wanted = new Set<GitStatsSectionName>(sections ?? GIT_STATS_SECTIONS);
    const aggregate: GitStatsData = {};

    yield {
      kind: 'progress',
      event: { phase: 'report', message: 'Loading scan metadata' },
    };

    let authorNames: Record<string, string> = {};
    try {
      const reportRes = await this.client.getReport(outPath);
      throwIfAborted(signal);
      const metrics = JSON.parse(reportRes.metrics_json) as WireMetrics;
      authorNames = metrics.authors ?? {};
      if (wanted.has('overview')) {
        const overview = mapOverview(metrics);
        aggregate.overview = overview;
        yield { kind: 'section', section: { name: 'overview', data: overview } };
      }
    } catch (err) {
      yield { kind: 'error', error: toAnalyzeError(err, 'getReport failed') };
      return;
    }

    const sectionsToFetch = REMOTE_SECTIONS.filter((s) => wanted.has(s));
    const fetches = sectionsToFetch.map(
      async (name): Promise<SectionResult> => {
        try {
          const res = await this.client.getSection(outPath, name, source);
          const parsed = JSON.parse(res.data_json) as unknown;
          return { ok: true, name, parsed };
        } catch (err) {
          return { ok: false, name, error: err };
        }
      },
    );

    for await (const result of settleInOrder(fetches)) {
      throwIfAborted(signal);
      if (!result.ok) {
        yield {
          kind: 'progress',
          event: {
            phase: 'section_error',
            message: `Section "${result.name}" failed; continuing with remainder`,
          },
        };
        continue;
      }
      const event = mapSection(result.name, result.parsed, authorNames);
      if (event) {
        applySectionToAggregate(aggregate, event);
        yield { kind: 'section', section: event };
      }
    }

    yield { kind: 'done', data: aggregate };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

type SectionResult =
  | { ok: true; name: GitStatsSectionName; parsed: unknown }
  | { ok: false; name: GitStatsSectionName; error: unknown };

function mapSection(
  name: GitStatsSectionName,
  parsed: unknown,
  authorNames: Record<string, string>,
): Extract<AnalyzeEvent, { kind: 'section' }>['section'] | null {
  switch (name) {
    case 'activity':
      return { name: 'activity', data: mapActivity(parsed as WireActivity) };
    case 'contributors':
      return {
        name: 'contributors',
        data: mapContributors(parsed as WireContributors, authorNames),
      };
    case 'codebase':
      return { name: 'codebase', data: mapCodebase(parsed as WireCodebase) };
    case 'patterns':
      return { name: 'patterns', data: mapPatterns(parsed as WirePatterns) };
    case 'health':
      return { name: 'health', data: mapHealth(parsed as WireHealth) };
    case 'timezone':
      return { name: 'timezone', data: mapTimezone(parsed as WireTimezone) };
    case 'overview':
      // Overview comes from getReport, not getSection.
      return null;
  }
}

function applySectionToAggregate(
  aggregate: GitStatsData,
  section: Extract<AnalyzeEvent, { kind: 'section' }>['section'],
): void {
  switch (section.name) {
    case 'overview':
      aggregate.overview = section.data;
      break;
    case 'activity':
      aggregate.activity = section.data;
      break;
    case 'contributors':
      aggregate.contributors = section.data;
      break;
    case 'codebase':
      aggregate.codebase = section.data;
      break;
    case 'patterns':
      aggregate.patterns = section.data;
      break;
    case 'health':
      aggregate.health = section.data;
      break;
    case 'timezone':
      aggregate.timezone = section.data;
      break;
  }
}

/** Yield each promise's result in completion order. */
async function* settleInOrder<T>(
  promises: Promise<T>[],
): AsyncGenerator<T, void, unknown> {
  const indexed = promises.map((p, i) =>
    p.then((value) => ({ i, value })),
  );
  const remaining = new Map(indexed.map((p, i) => [i, p]));
  while (remaining.size > 0) {
    const { i, value } = await Promise.race(remaining.values());
    remaining.delete(i);
    yield value;
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new AnalyzeError('aborted', 'Analysis was aborted by the caller');
  }
}

function toAnalyzeError(err: unknown, fallback: string): AnalyzeError {
  if (err instanceof AnalyzeError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new AnalyzeError('grpc_failed', `${fallback}: ${message}`);
}
