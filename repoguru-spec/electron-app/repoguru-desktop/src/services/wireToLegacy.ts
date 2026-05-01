// Map the gRPC wire shape (whatever the Rust sidecar emits) into the
// browser-shape `GitStatsAnalysis` that @repoguru/ui's GitStatsView
// consumes. This lets the desktop render the same view tree as the
// in-browser app without a separate set of chart components.

import type { legacy } from '@repoguru/core';
import type { GitStatsData } from '../hooks/useGitStats';

type Analysis = legacy.GitStatsAnalysis;

interface RepoMetrics {
  oldest_commit?: number;
  newest_commit?: number;
  checkout_total_size?: number;
  checkout_num_files?: number;
}

export interface ReportLike {
  owner?: string;
  repo?: string;
  total_commits?: number;
  total_insertions?: number;
  total_deletions?: number;
  binary_files_changed?: number;
  authors?: Record<string, string>;
  paths?: Record<string, string>;
  repo_metrics?: RepoMetrics;
}

const U32_MAX = 0xffffffff;

/** CLI emits u32::MAX as a binary-file sentinel. Treat as 0 so charts don't blow up. */
function sanitize(n: number | undefined | null): number {
  if (n === undefined || n === null) return 0;
  if (n >= U32_MAX) return 0;
  return n;
}

/**
 * Build a legacy `GitStatsAnalysis` from the wire `data` plus the
 * captured top-level report. Fills every field the GitStatsView reads,
 * defaulting to empty arrays / zeros only when the CLI doesn't emit it.
 */
export function wireToLegacy(data: GitStatsData, report: ReportLike): Analysis {
  const repoMetrics = report.repo_metrics ?? {};
  const authorNames = data.author_names ?? report.authors ?? {};
  // `paths` from the report could later be joined into hotspots/etc.; not used yet.
  const _paths = report.paths ?? {};
  void _paths;
  const totalCommits =
    report.total_commits ??
    (data.authors ?? []).reduce((sum, a) => sum + a.commits, 0);

  // ── Overview ──
  const oldest = repoMetrics.oldest_commit;
  const newest = repoMetrics.newest_commit;
  const firstCommitDate = oldest ? new Date(oldest * 1000).toISOString().slice(0, 10) : '';
  const repoAgeDays =
    oldest && newest ? Math.max(1, Math.round((newest - oldest) / 86400)) : 0;
  const totalLinesOfCode =
    (report.total_insertions ?? 0) - (report.total_deletions ?? 0) || 0;

  // ── Contributors ──
  const contributors: legacy.ContributorSummary[] = (data.authors ?? []).map((a) => {
    const login = authorNames[String(a.author_id)] ?? `author-${a.author_id}`;
    return {
      login,
      avatarUrl: '',
      totalCommits: a.commits,
      totalAdditions: sanitize(a.insertions),
      totalDeletions: sanitize(a.deletions),
      commitPercentage: totalCommits > 0 ? (a.commits / totalCommits) * 100 : 0,
      firstCommitWeek: a.first_commit,
      lastCommitWeek: a.last_commit,
    };
  });

  // ── Bus factor ──
  const lorenz = data.bus_factor?.lorenz ?? [];
  const cumulativeContributors = lorenz.map((cumPct, i) => ({
    login: contributors[i]?.login ?? `author-${i}`,
    cumulativePercentage: cumPct * 100,
  }));
  const busFactor: legacy.BusFactorData = {
    busFactor: data.bus_factor?.factor ?? 0,
    herfindahlIndex: 0,
    cumulativeContributors,
  };

  // ── File churn ──
  const fileChurn: legacy.FileChurnEntry[] = (data.hotspots ?? []).map((h) => ({
    filename: h.path,
    changeCount: h.commits,
    totalAdditions: 0,
    totalDeletions: sanitize(h.total_churn),
    contributors: [],
  }));

  // ── Commit messages ──
  const wordFrequency = (data.word_frequencies ?? []).map(([word, count]) => ({ word, count }));
  const conv = (data.conventional_commits ?? {}) as Record<string, number>;
  const conventionalTotal = Object.values(conv).reduce((s, n) => s + n, 0);
  const commitMessages: legacy.CommitMessageStats = {
    totalCommits,
    averageLength: 0,
    medianLength: 0,
    mergeCommitCount: 0,
    conventionalCommits: {
      feat: conv.feat ?? 0,
      fix: conv.fix ?? 0,
      docs: conv.docs ?? 0,
      style: conv.style ?? 0,
      refactor: conv.refactor ?? 0,
      test: conv.test ?? 0,
      chore: conv.chore ?? 0,
      ci: conv.ci ?? 0,
      perf: conv.perf ?? 0,
      build: conv.build ?? 0,
      other: conv.other ?? 0,
    },
    conventionalPercentage:
      totalCommits > 0 ? Math.round((conventionalTotal / totalCommits) * 100) : 0,
    wordFrequency,
  };

  // ── Commit size distribution ──
  const commitSizeDistribution: legacy.CommitSizeDistribution = {
    buckets: (data.commit_size_histogram ?? []).map(([label, count]) => ({
      label,
      min: 0,
      max: 0,
      count,
    })),
  };

  // ── Punch / weekly ──
  const punchCard: legacy.PunchCardData[] = (data.punch_card ?? []).map(
    ([day, hour, commits]) => ({ day, hour, commits }),
  );
  const weeklyActivity: legacy.WeeklyActivity[] = (data.weekly_activity ?? []).map(
    ([weekStart, total]) => ({ weekStart, total, days: [] }),
  );

  // ── Code frequency / activity ──
  // Project the CLI's weekly_activity (which gives [weekStart, total]
  // per ISO week — no per-day breakdown) into GitHub's
  // GitHubCommitActivity shape ({week: unix-seconds, total, days:[7]}).
  // The Sun..Sat day breakdown isn't tracked by the CLI (would explode
  // the output for marginal value), so we spread the weekly total
  // evenly across 7 days. The calendar heatmap's main story is weekly
  // intensity over the year — that's preserved exactly. Within-week
  // day-of-week variation is approximated.
  const commitActivity: legacy.GitHubCommitActivity[] = (data.weekly_activity ?? []).map(
    ([weekStart, total]) => {
      const t = sanitize(total);
      const base = Math.floor(t / 7);
      const remainder = t - base * 7;
      const days = Array.from({ length: 7 }, (_, i) => (i < remainder ? base + 1 : base));
      return {
        total: t,
        week: Math.floor(new Date(weekStart).getTime() / 1000),
        days,
      };
    },
  );
  const codeFrequency: legacy.GitHubCodeFrequency[] = (data.timeseries ?? []).map(
    (t) =>
      [
        Math.floor(new Date(t.period_start).getTime() / 1000),
        sanitize(t.insertions),
        -sanitize(t.deletions),
      ] as legacy.GitHubCodeFrequency,
  );

  // ── Repository growth ──
  // Walk the timeseries cumulating insertions / deletions so the
  // RepoGrowthTimeline can render a running total. The CLI emits
  // per-period insertions / deletions only — the cumulative version
  // is a one-pass derivation.
  let cumulativeAdditions = 0;
  let cumulativeDeletions = 0;
  const repoGrowth: legacy.RepoGrowthPoint[] = (data.timeseries ?? []).map((t) => {
    cumulativeAdditions += sanitize(t.insertions);
    cumulativeDeletions += sanitize(t.deletions);
    return {
      date: t.period_start,
      cumulativeAdditions,
      cumulativeDeletions,
      netGrowth: cumulativeAdditions - cumulativeDeletions,
    };
  });

  // ── Top active periods ──
  // The CLI's timeseries entries map 1:1 to ActivePeriod — the chart
  // sorts/picks its own top-N from the full series, so we just
  // forward everything.
  const topActivePeriods: legacy.ActivePeriod[] = (data.timeseries ?? []).map((t) => ({
    period: t.period_start,
    commits: sanitize(t.commits),
    insertions: sanitize(t.insertions),
    deletions: sanitize(t.deletions),
  }));

  // ── Codebase: coupling, hotspots, ownership ──
  const fileCoupling = (data.file_coupling ?? []).map((c) => ({
    file1: c.file_a,
    file2: c.file_b,
    cochanges: c.count,
  }));
  const linesByExtension = (data.lines_by_ext ?? []).map(([ext, additions, deletions]) => ({
    ext,
    additions: sanitize(additions),
    deletions: sanitize(deletions),
  }));
  const linesByExtTime: legacy.ExtMonthlyChurn | null = data.lines_by_ext_time
    ? {
        months: data.lines_by_ext_time.months,
        extensions: data.lines_by_ext_time.extensions,
        data: data.lines_by_ext_time.data.map((row) => row.map(sanitize)),
      }
    : null;
  const codeOwnership: legacy.OwnershipEntry[] = (data.code_ownership ?? []).map((o) => ({
    path: o.path,
    ownerName: authorNames[String(o.owner_id)] ?? `author-${o.owner_id}`,
    lines: sanitize(o.lines),
  }));

  // ── Activity over time ──
  const cumulativeFiles = (data.cumulative_files ?? []).map(([date, count]) => ({ date, count }));
  const fileOperations = (data.file_operations ?? []).map(([operation, count]) => ({
    operation,
    count,
  }));

  // ── Tags ──
  const tagHistory: legacy.TagSummary[] = (data.tag_history ?? []).map((t) => ({
    name: t.name,
    date: t.date,
    timestamp: t.timestamp,
    commitsSincePrev: t.commits_since_prev,
  }));

  // ── Lines stats summary ──
  const linesStatsSummary: legacy.LinesStatsSummary[] = (data.lines_stats_summary ?? []).map(
    (s) => ({
      label: s.label,
      min: sanitize(s.min),
      max: sanitize(s.max),
      avg: sanitize(s.avg),
      median: sanitize(s.median),
      total: sanitize(s.total),
    }),
  );

  // ── Radar / hotspots ──
  const radarMetrics: legacy.RadarMetric[] = (data.radar_metrics ?? []).map((m) => ({
    label: m.label,
    value: m.value, // 0..1 in the wire
  }));
  const hotspots: legacy.HotspotEntry[] = (data.hotspots ?? []).map((h) => ({
    path: h.path,
    commits: h.commits,
    distinctAuthors: h.distinct_authors,
    totalChurn: sanitize(h.total_churn),
  }));

  // ── Network ──
  const contributorNodes: legacy.ContributorNode[] = (data.contributor_network_nodes ?? []).map(
    ([id, name]) => ({ id: String(id), name }),
  );
  const contributorEdges: legacy.ContributorEdge[] = (data.contributor_network_edges ?? []).map(
    (e) => ({ source: String(e.source), target: String(e.target), weight: e.weight }),
  );

  // ── Timezone ──
  const timezoneData = (data.timezone_data ?? []).map(([offset, count]) => ({ offset, count }));

  // ── Patterns: commits by year / extension / domain ──
  const commitsByYear = Object.entries(data.commits_by_year ?? {})
    .map(([year, count]) => ({ year: Number(year), count }))
    .filter((d) => Number.isFinite(d.year))
    .sort((a, b) => a.year - b.year);

  const commitsByExtension = (data.commits_by_extension ?? []).map(([ext, count]) => ({
    ext,
    count,
  }));

  const commitsByDomain = (data.commits_by_domain ?? []).map(([domain, count]) => ({
    domain,
    count,
  }));

  // ── Languages (CLI emits {Lang: fileCount}) ──
  const langEntries = Object.entries(data.language_breakdown ?? {});
  const totalLangFiles = langEntries.reduce((s, [, n]) => s + n, 0);
  const languages: legacy.LanguageEntry[] = langEntries
    .map(([name, count]) => ({
      name,
      bytes: count,
      percentage: totalLangFiles > 0 ? (count / totalLangFiles) * 100 : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  // ── Author of year/month, author timelines ──
  const resolveAuthor = (id: number) => authorNames[String(id)] ?? `author-${id}`;
  const authorOfYear: legacy.AuthorOfPeriod[] = (data.author_of_year ?? []).map((a) => ({
    period: a.period,
    authorName: resolveAuthor(a.author_id),
    commits: a.commits,
    totalAuthors: a.total_authors,
  }));
  const authorOfMonth: legacy.AuthorOfPeriod[] = (data.author_of_month ?? []).map((a) => ({
    period: a.period,
    authorName: resolveAuthor(a.author_id),
    commits: a.commits,
    totalAuthors: a.total_authors,
  }));
  const authorTimelines: legacy.AuthorTimeline[] = (data.author_timelines ?? []).map((t) => ({
    authorName: resolveAuthor(t.author_id),
    points: t.points,
  }));

  // ── Sequential coupling ──
  const sequentialCoupling: legacy.ChangeChain[] = (data.sequential_coupling ?? []).map((c) => ({
    files: c.files,
    occurrences: c.occurrences,
    avgSpanHours: c.avg_span_hours,
    confidence: c.confidence,
  }));

  return {
    owner: report.owner ?? '',
    repo: report.repo ?? '',
    totalCommits,
    totalLinesOfCode,
    binaryFileCount: report.binary_files_changed ?? 0,
    contributors,
    busFactor,
    fileChurn,
    commitMessages,
    commitSizeDistribution,
    repoGrowth,
    punchCard,
    weeklyActivity,
    languages,
    commitActivity,
    codeFrequency,
    commitsByWeekday: data.commits_by_weekday ?? [],
    commitsByMonth: data.commits_by_month ?? [],
    commitsByYear,
    commitsByExtension,
    linesByExtension,
    fileCoupling,
    firstCommitDate,
    repoAgeDays,
    commitsByHour: data.commits_by_hour ?? [],
    commitsByDomain,
    authorOfYear,
    authorOfMonth,
    authorTimelines,
    contributorNodes,
    contributorEdges,
    codeOwnership,
    timezoneData,
    sequentialCoupling,
    linesByExtTime,
    linesStatsSummary,
    cumulativeFiles,
    fileOperations,
    tagHistory,
    locOverTime: [],
    radarMetrics,
    hotspots,
    topActivePeriods,
  };
}
