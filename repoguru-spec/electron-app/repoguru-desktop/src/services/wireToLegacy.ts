// Map the gRPC wire shape (whatever the Rust sidecar emits) into the
// browser-shape `GitStatsAnalysis` that @repoguru/ui's GitStatsView
// consumes. This lets the desktop render the same view tree as the
// in-browser app without a separate set of chart components.

import type { legacy } from '@repoguru/core';
import type { GitStatsData } from '../hooks/useGitStats';

type Analysis = legacy.GitStatsAnalysis;
type Empty = Record<string, unknown>;

interface ReportLike {
  owner?: string;
  repo?: string;
  total_commits?: number;
  total_lines_of_code?: number;
  binary_file_count?: number;
  first_commit_date?: string;
  repo_age_days?: number;
  authors?: Record<string, string>;
}

/**
 * Build a legacy `GitStatsAnalysis` from the wire `data` plus the
 * captured top-level report. Fields the sidecar doesn't emit get
 * defaulted to empty arrays / zeros so the React tree renders without
 * blowing up.
 */
export function wireToLegacy(
  data: GitStatsData,
  report: ReportLike,
): Analysis {
  const authorNames = data.author_names ?? report.authors ?? {};
  const totalCommits =
    report.total_commits ??
    (data.authors ?? []).reduce((sum, a) => sum + a.commits, 0);

  const contributors: legacy.ContributorSummary[] = (data.authors ?? []).map((a) => {
    const login = authorNames[String(a.author_id)] ?? `author-${a.author_id}`;
    return {
      login,
      avatarUrl: '',
      totalCommits: a.commits,
      totalAdditions: a.insertions,
      totalDeletions: a.deletions,
      commitPercentage: totalCommits > 0 ? (a.commits / totalCommits) * 100 : 0,
      firstCommitWeek: a.first_commit,
      lastCommitWeek: a.last_commit,
    };
  });

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

  const fileChurn: legacy.FileChurnEntry[] = (data.hotspots ?? []).map((h) => ({
    filename: h.path,
    changeCount: h.commits,
    totalAdditions: 0,
    totalDeletions: h.total_churn,
    contributors: [],
  }));

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

  const commitSizeDistribution: legacy.CommitSizeDistribution = {
    buckets: (data.commit_size_histogram ?? []).map(([label, count]) => ({
      label,
      min: 0,
      max: 0,
      count,
    })),
  };

  const punchCard: legacy.PunchCardData[] = (data.punch_card ?? []).map(
    ([day, hour, commits]) => ({ day, hour, commits }),
  );

  const weeklyActivity: legacy.WeeklyActivity[] = (data.weekly_activity ?? []).map(
    ([weekStart, total]) => ({ weekStart, total, days: [] }),
  );

  // The sidecar's commit_activity feed isn't available — leave nullable.
  const commitActivity: legacy.GitHubCommitActivity[] | null = null;
  const codeFrequency: legacy.GitHubCodeFrequency[] | null = (data.timeseries ?? []).map(
    (t) => [Math.floor(new Date(t.period_start).getTime() / 1000), t.insertions, -t.deletions],
  );

  const fileCoupling = (data.file_coupling ?? []).map((c) => ({
    file1: c.file_a,
    file2: c.file_b,
    cochanges: c.count,
  }));

  const linesByExtension = (data.lines_by_ext ?? []).map(([ext, additions, deletions]) => ({
    ext,
    additions,
    deletions,
  }));

  const cumulativeFiles = (data.cumulative_files ?? []).map(([date, count]) => ({ date, count }));
  const fileOperations = (data.file_operations ?? []).map(([operation, count]) => ({
    operation,
    count,
  }));

  const tagHistory: legacy.TagSummary[] = (data.tag_history ?? []).map((t) => ({
    name: t.name,
    date: t.date,
    timestamp: t.timestamp,
    commitsSincePrev: t.commits_since_prev,
  }));

  const linesStatsSummary: legacy.LinesStatsSummary[] = data.lines_stats_summary ?? [];

  const radarMetrics: legacy.RadarMetric[] = (data.radar_metrics ?? []).map((m) => ({
    label: m.label,
    value: m.value, // 0..1 in the wire
  }));

  const hotspots: legacy.HotspotEntry[] = (data.hotspots ?? []).map((h) => ({
    path: h.path,
    commits: h.commits,
    distinctAuthors: h.distinct_authors,
    totalChurn: h.total_churn,
  }));

  const contributorNodes: legacy.ContributorNode[] = (data.contributor_network_nodes ?? []).map(
    ([id, name]) => ({ id: String(id), name }),
  );
  const contributorEdges: legacy.ContributorEdge[] = (data.contributor_network_edges ?? []).map(
    (e) => ({ source: String(e.source), target: String(e.target), weight: e.weight }),
  );

  const timezoneData = (data.timezone_data ?? []).map(([offset, count]) => ({ offset, count }));

  // Compute commitsByYear from timeseries (ISO date → year aggregate).
  const yearMap = new Map<number, number>();
  for (const t of data.timeseries ?? []) {
    const year = new Date(t.period_start).getUTCFullYear();
    yearMap.set(year, (yearMap.get(year) ?? 0) + t.commits);
  }
  const commitsByYear = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  const empty: Empty[] = [];

  return {
    owner: report.owner ?? '',
    repo: report.repo ?? '',
    totalCommits,
    totalLinesOfCode: report.total_lines_of_code ?? 0,
    binaryFileCount: report.binary_file_count ?? 0,
    contributors,
    busFactor,
    fileChurn,
    commitMessages,
    commitSizeDistribution,
    repoGrowth: [],
    punchCard,
    weeklyActivity,
    languages: [],
    commitActivity,
    codeFrequency,
    commitsByWeekday: data.commits_by_weekday ?? [],
    commitsByMonth: data.commits_by_month ?? [],
    commitsByYear,
    commitsByExtension: [],
    linesByExtension,
    fileCoupling,
    firstCommitDate: report.first_commit_date ?? '',
    repoAgeDays: report.repo_age_days ?? 0,
    commitsByHour: data.commits_by_hour ?? [],
    commitsByDomain: [],
    authorOfYear: [],
    authorOfMonth: [],
    authorTimelines: [],
    contributorNodes,
    contributorEdges,
    codeOwnership: [],
    timezoneData,
    sequentialCoupling: [],
    linesByExtTime: null,
    linesStatsSummary,
    cumulativeFiles,
    fileOperations,
    tagHistory,
    locOverTime: [],
    radarMetrics,
    hotspots,
    topActivePeriods: [],
  } as Analysis;
}
