import { useState, useCallback, useEffect, useRef } from 'react';
import { GrpcAnalyzer, type GrpcSectionClient } from '@repoguru/desktop-adapter';
import type { GitStatsData as CanonicalGitStatsData } from '@repoguru/core';
import { grpcClient } from '../services/grpc-client';

// ── Wire shape kept stable for backward-compat with un-lifted charts. ──
// Once a chart is lifted into @repoguru/ui it should read from `canonical`
// instead. When every consumer has migrated, this whole interface can go.
export interface GitStatsData {
  // activity
  timeseries: Array<{ period_start: string; commits: number; insertions: number; deletions: number; authors: number }>;
  cumulative_files: Array<[string, number]>;
  file_operations: Array<[string, number]>;
  lines_by_ext: Array<[string, number, number]>;
  lines_stats_summary: Array<{ label: string; min: number; max: number; avg: number; median: number; total: number }>;

  // contributors
  authors: Array<{ author_id: number; commits: number; insertions: number; deletions: number; first_commit: number; last_commit: number }>;
  author_names: Record<string, string>;
  contributor_network_nodes: Array<[number, string]>;
  contributor_network_edges: Array<{ source: number; target: number; weight: number }>;

  // codebase
  hotspots: Array<{ path: string; commits: number; total_churn: number; distinct_authors: number }>;
  file_coupling: Array<{ file_a: string; file_b: string; count: number; coupling_pct: number }>;

  // patterns
  commits_by_weekday: number[];
  commits_by_month: number[];
  commits_by_hour: number[];
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
  /** Snake_case wire shape — kept for charts that haven't moved to @repoguru/ui yet. */
  data: GitStatsData | null;
  /** Canonical sectioned shape from @repoguru/core — used by lifted charts. */
  canonical: CanonicalGitStatsData | null;
  error: string | null;
  loadedSections: string[];
}

export function useGitStats() {
  const [state, setState] = useState<GitStatsState>({
    loading: false,
    data: null,
    canonical: null,
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
    setState({ loading: true, data: null, canonical: null, error: null, loadedSections: [] });

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
      setState({
        loading: false,
        data: wireData as unknown as GitStatsData,
        canonical,
        error: null,
        loadedSections: loaded,
      });
    } catch (err) {
      if (mountedRef.current) {
        setState({
          loading: false,
          data: null,
          canonical: null,
          error: err instanceof Error ? err.message : String(err),
          loadedSections: [],
        });
      }
    }
  }, []);

  return { ...state, loadStats };
}
