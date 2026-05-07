import { useState, useCallback, useEffect, useRef } from 'react';
import { GrpcAnalyzer, type GrpcSectionClient } from '@repoguru/desktop-adapter';
import type { GitStatsData as CanonicalGitStatsData, legacy } from '@repoguru/core';
import { grpcClient } from '../services/grpc-client';
import { wireToLegacy } from '../services/wireToLegacy';

// ── Wire shape kept stable for backward-compat with un-lifted charts. ──
// Once a chart is lifted into @repoguru/ui it should read from `canonical`
// instead. When every consumer has migrated, this whole interface can go.
export interface GitStatsData {
  // activity
  timeseries: Array<{
    period_start: string;
    commits: number;
    insertions: number;
    deletions: number;
    authors: number;
  }>;
  cumulative_files: Array<[string, number]>;
  file_operations: Array<[string, number]>;
  lines_by_ext: Array<[string, number, number]>;
  lines_by_ext_time?: { months: string[]; extensions: string[]; data: number[][] };
  lines_stats_summary: Array<{
    label: string;
    min: number;
    max: number;
    avg: number;
    median: number;
    total: number;
  }>;

  // contributors
  authors: Array<{
    author_id: number;
    commits: number;
    insertions: number;
    deletions: number;
    first_commit: number;
    last_commit: number;
  }>;
  author_names: Record<string, string>;
  author_of_year?: Array<{
    author_id: number;
    commits: number;
    period: string;
    total_authors: number;
  }>;
  author_of_month?: Array<{
    author_id: number;
    commits: number;
    period: string;
    total_authors: number;
  }>;
  author_timelines?: Array<{ author_id: number; points: Array<[string, number]> }>;
  commits_by_domain?: Array<[string, number]>;
  contributor_network_nodes: Array<[number, string]>;
  contributor_network_edges: Array<{ source: number; target: number; weight: number }>;

  // codebase
  code_ownership?: Array<{ lines: number; owner_id: number; path: string }>;
  hotspots: Array<{ path: string; commits: number; total_churn: number; distinct_authors: number }>;
  file_coupling: Array<{ file_a: string; file_b: string; count: number; coupling_pct: number }>;
  sequential_coupling?: Array<{
    files: string[];
    occurrences: number;
    avg_span_hours: number;
    confidence: number;
  }>;

  // patterns
  commits_by_weekday: number[];
  commits_by_month: number[];
  commits_by_hour: number[];
  commits_by_year?: Record<string, number>;
  commits_by_extension?: Array<[string, number]>;
  language_breakdown?: Record<string, number>;
  punch_card: Array<[number, number, number]>;
  commit_size_histogram: Array<[string, number]>;
  weekly_activity: Array<[string, number]>;
  word_frequencies: Array<[string, number]>;
  conventional_commits: Record<string, number>;

  // health
  bus_factor: { factor: number; lorenz: number[] };
  radar_metrics: Array<{ label: string; value: number }>;
  tag_history: Array<{ name: string; date: string; timestamp: number; commits_since_prev: number }>;

  // timezone
  timezone_data: Array<[number, number]>;
}

export interface GitStatsState {
  loading: boolean;
  /** Snake_case wire shape — preserved for incidental debug use. */
  data: GitStatsData | null;
  /** Canonical sectioned shape from @repoguru/core — emitted as sections stream in. */
  canonical: CanonicalGitStatsData | null;
  /** Browser-shape `GitStatsAnalysis` — what @repoguru/ui's GitStatsView consumes. */
  analysis: legacy.GitStatsAnalysis | null;
  error: string | null;
  loadedSections: string[];
}

export function useGitStats() {
  const [state, setState] = useState<GitStatsState>({
    loading: false,
    data: null,
    canonical: null,
    analysis: null,
    error: null,
    loadedSections: [],
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadStats = useCallback(async (outPath: string, repoPath?: string) => {
    setState({
      loading: true,
      data: null,
      canonical: null,
      analysis: null,
      error: null,
      loadedSections: [],
    });

    // Wrap grpcClient so we capture each raw JSON payload as it flows through
    // the analyzer. That gives us the wire shape "for free" without a second
    // round-trip to the gRPC service.
    const captured: Record<string, Record<string, unknown>> = {};
    const wrappedClient: GrpcSectionClient = {
      async getReport(p) {
        const res = (await grpcClient.getReport(p)) as { metrics_json: string };
        try {
          captured['__report'] = JSON.parse(res.metrics_json) as Record<string, unknown>;
        } catch {
          captured['__report'] = {};
        }
        return res;
      },
      async getSection(p, s, r) {
        const res = (await grpcClient.getSection(p, s, r)) as { data_json: string };
        try {
          captured[s] = JSON.parse(res.data_json) as Record<string, unknown>;
        } catch {
          captured[s] = {};
        }
        return res;
      },
    };

    const wireData: Record<string, unknown> = {};
    const canonical: CanonicalGitStatsData = {};
    const loaded: string[] = [];
    const analyzer = new GrpcAnalyzer(wrappedClient);

    try {
      for await (const event of analyzer.analyze({
        source: repoPath ?? '',
        outPath,
      })) {
        if (!mountedRef.current) return;

        if (event.kind === 'section') {
          (canonical as Record<string, unknown>)[event.section.name] = event.section.data;
          loaded.push(event.section.name);

          // Merge raw section payload into wireData. Overview comes from
          // captured.__report; other sections are keyed by section name.
          if (event.section.name === 'overview') {
            const report = captured['__report'] ?? {};
            wireData['author_names'] = report['authors'] ?? {};
          } else {
            const raw = captured[event.section.name] ?? {};
            Object.assign(wireData, raw);
          }
        } else if (event.kind === 'error') {
          throw event.error;
        }
      }

      if (!mountedRef.current) return;
      const wire = wireData as unknown as GitStatsData;
      const reportRaw = (captured['__report'] ?? {}) as Record<string, unknown>;
      const overview = canonical.overview;
      const analysis = wireToLegacy(wire, {
        ...reportRaw,
        // Overview owner/repo isn't in metrics.json — pull from the canonical
        // overview section (the desktop adapter derives it from the source path).
        owner: overview?.owner,
        repo: overview?.repo,
      } as Parameters<typeof wireToLegacy>[1]);
      setState({
        loading: false,
        data: wire,
        canonical,
        analysis,
        error: null,
        loadedSections: loaded,
      });
    } catch (err) {
      if (mountedRef.current) {
        setState({
          loading: false,
          data: null,
          canonical: null,
          analysis: null,
          error: err instanceof Error ? err.message : String(err),
          loadedSections: [],
        });
      }
    }
  }, []);

  return { ...state, loadStats };
}
