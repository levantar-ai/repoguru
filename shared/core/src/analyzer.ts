// The RepoAnalyzer port. Both adapters implement this interface:
//
//   packages/browser-adapter  → BrowserAnalyzer  (isomorphic-git + lightning-fs)
//   packages/desktop-adapter  → GrpcAnalyzer     (Electron renderer → Rust repoanalyze sidecar)
//
// Views in @repoguru/ui depend ONLY on this interface, never on a concrete
// implementation. That's what makes them work in both apps unchanged.

import type {
  GitStatsData,
  GitStatsSection,
  GitStatsSectionName,
} from './gitStats.js';

export interface AnalyzeRequest {
  /**
   * For the browser adapter: a "owner/repo" shorthand or full GitHub URL.
   * For the desktop adapter: an absolute filesystem path to a local clone.
   */
  source: string;
  /**
   * Optional out-path the desktop adapter writes scan artefacts into. The
   * browser adapter ignores this.
   */
  outPath?: string;
  /** Subset of sections to compute. Defaults to all sections. */
  sections?: readonly GitStatsSectionName[];
  /** GitHub PAT or similar — browser adapter uses it for API rate limits. */
  authToken?: string;
}

export interface ProgressEvent {
  /**
   * Free-form phase identifier. Adapters share a vocabulary where they can
   * ("cloning", "walking", "diffing", "scoring") but views should treat
   * unknown phases as opaque labels.
   */
  phase: string;
  /** Human-readable status line. */
  message: string;
  /** Overall completion 0..1, or undefined when indeterminate. */
  progress?: number;
  /** Optional sub-step completion 0..1 (e.g. within a phase). */
  subProgress?: number;
}

export type AnalyzeEvent =
  | { kind: 'progress'; event: ProgressEvent }
  | { kind: 'section'; section: GitStatsSection }
  | { kind: 'done'; data: GitStatsData }
  | { kind: 'error'; error: AnalyzeError };

export class AnalyzeError extends Error {
  readonly code: string;
  /** A user-actionable hint when one is available. */
  readonly hint?: string;

  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.name = 'AnalyzeError';
    this.code = code;
    if (hint !== undefined) this.hint = hint;
  }
}

/**
 * The single interface every adapter implements.
 *
 * Adapters yield AnalyzeEvents in order. A successful run ends with exactly
 * one `{kind: 'done'}` event whose `data` is the merged final result. The
 * iterable should also surface section events as they're computed so the UI
 * can render progressively.
 *
 * Implementations should respect AbortSignal for cancellation.
 */
export interface RepoAnalyzer {
  analyze(
    request: AnalyzeRequest,
    signal?: AbortSignal,
  ): AsyncIterable<AnalyzeEvent>;
}

/**
 * Convenience: drain an analyzer into a single GitStatsData, ignoring
 * progress events. Views that don't care about progressive rendering can use
 * this. Throws AnalyzeError on failure.
 */
export async function runAnalyzer(
  analyzer: RepoAnalyzer,
  request: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<GitStatsData> {
  for await (const event of analyzer.analyze(request, signal)) {
    if (event.kind === 'done') return event.data;
    if (event.kind === 'error') throw event.error;
  }
  throw new AnalyzeError(
    'no_done_event',
    'Analyzer iterable ended without emitting a done event',
  );
}
