// Wire shapes returned by the Rust `repoanalyze` gRPC service after
// JSON.parse. These are intentionally pinned here (rather than imported
// from @repoguru/core) because they're the boundary contract — they will
// drift independently of the canonical types and the mapper exists to
// reconcile that drift in exactly one place.

export interface WireReport {
  /** JSON blob; see WireMetrics. */
  metrics_json: string;
  timelines_json?: string;
  authors_json?: string;
  hotspots_json?: string;
}

export interface WireMetrics {
  /** numeric author_id → display name */
  authors?: Record<string, string>;
  /** owner/repo identifiers if known */
  owner?: string;
  repo?: string;
  total_commits?: number;
  total_lines_of_code?: number;
  binary_file_count?: number;
  first_commit_date?: string;
  repo_age_days?: number;
}

export interface WireSection {
  /** JSON blob whose top-level keys depend on the section name. */
  data_json: string;
}

// ── Section payloads (after JSON.parse) ─────────────────────────────────────

export interface WireActivity {
  timeseries?: Array<{
    period_start: string;
    commits: number;
    insertions: number;
    deletions: number;
    authors: number;
  }>;
  cumulative_files?: Array<[string, number]>;
  file_operations?: Array<[string, number]>;
  lines_by_ext?: Array<[string, number, number]>;
  lines_stats_summary?: Array<{
    label: string;
    min: number;
    max: number;
    avg: number;
    median: number;
    total: number;
  }>;
}

export interface WireContributors {
  authors?: Array<{
    author_id: number;
    commits: number;
    insertions: number;
    deletions: number;
    first_commit: number;
    last_commit: number;
  }>;
  contributor_network_nodes?: Array<[number, string]>;
  contributor_network_edges?: Array<{
    source: number;
    target: number;
    weight: number;
  }>;
}

export interface WireCodebase {
  hotspots?: Array<{
    path: string;
    commits: number;
    total_churn: number;
    distinct_authors: number;
  }>;
  file_coupling?: Array<{
    file_a: string;
    file_b: string;
    count: number;
    coupling_pct: number;
  }>;
}

export interface WirePatterns {
  commits_by_weekday?: number[];
  commits_by_month?: number[];
  commits_by_year?: Record<string, number>;
  commits_by_hour?: number[];
  punch_card?: Array<[number, number, number]>;
  commit_size_histogram?: Array<[string, number]>;
  weekly_activity?: Array<[string, number]>;
  word_frequencies?: Array<[string, number]>;
  language_breakdown?: Array<{
    language: string;
    percentage: number;
    file_count: number;
    total_lines: number;
  }>;
  conventional_commits?: Record<string, number>;
}

export interface WireHealth {
  bus_factor?: { factor: number; lorenz: number[] };
  radar_metrics?: Array<{ label: string; value: number }>;
  tag_history?: Array<{
    name: string;
    date: string;
    timestamp: number;
    commits_since_prev: number;
  }>;
}

export interface WireTimezone {
  timezone_data?: Array<[number, number]>;
}
