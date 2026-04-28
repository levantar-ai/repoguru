// Platform-services contract consumed by the shared pages in @repoguru/ui.
// Each host (in-browser, Electron desktop, …future…) provides an
// implementation. The shared pages depend only on this interface — never on
// host-specific imports — so the same React component runs identically in
// every host. Same pattern VS Code uses to share its workbench/editor code
// between web and desktop builds.
//
// Pages mount via:
//   const services = useRepoGuru();
//   const result = await services.compare.run(repoA, repoB, { signal, onProgress });
//
// Hosts mount via:
//   <RepoGuruProvider services={browserServices}>
//     <BrowserApp />
//   </RepoGuruProvider>

import type { ReactNode } from 'react';
import type { CompareDelta } from '../views/CompareView.js';
import type { ReportCardData } from '../views/reportCardTypes.js';
import type { PolicyEvalResult } from '../views/policyTypes.js';
import type { OrgScanItem, OrgScanSummary } from '../views/orgScanTypes.js';

// ─────────────────────────── Repo identity ───────────────────────────

/** Opaque-to-the-page repo handle. Hosts decide whether this is a GitHub
 *  slug ("owner/repo"), a filesystem path ("/home/x/repo"), or anything
 *  else — the shared pages just pass it through to services. */
export type RepoRef = string;

// ─────────────────────────── Compare ─────────────────────────────────

export interface CompareRunOptions {
  signal?: AbortSignal;
  /** Called with a free-form progress message during long-running compares. */
  onProgress?: (message: string) => void;
}

export interface CompareResult {
  reportA: ReportCardData;
  reportB: ReportCardData;
  deltas: CompareDelta[];
  winner: 'a' | 'b' | 'tie';
  scoreDelta: number;
  /** Optional host-rendered extras (e.g. browser supplies tech-stack and
   *  repo-stats comparisons that the CLI doesn't surface). Rendered below
   *  the category breakdown by `<ComparePage />`. */
  extras?: ReactNode;
}

export interface CompareService {
  run(repoA: RepoRef, repoB: RepoRef, opts?: CompareRunOptions): Promise<CompareResult>;
}

// ─────────────────────────── Report Card ─────────────────────────────

export interface ScoreRunOptions {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export interface ScoreResult {
  report: ReportCardData;
  /** Optional host-supplied extras (browser supplies TechStack, FixItLinks,
   *  BadgeGenerator, ContributorScore, MermaidDiagram, LlmInsights — the
   *  CLI surfaces none of these). Rendered below the report card. */
  extras?: ReactNode;
}

export interface ScoreService {
  run(repo: RepoRef, opts?: ScoreRunOptions): Promise<ScoreResult>;
}

// ─────────────────────────── Tech Detect ─────────────────────────────

import type { TechDetectResult } from '@repoguru/core';

export interface TechDetectService {
  run(repo: RepoRef, opts?: { signal?: AbortSignal; onProgress?: (m: string) => void }): Promise<TechDetectResult>;
}

// ─────────────────────────── Policy ──────────────────────────────────

export interface PolicyPreset {
  id: string;
  label: string;
  description?: string;
}

export interface PolicyEvaluateRequest {
  repo: RepoRef;
  presetId: string;
}

export interface PolicyService {
  /** Built-in preset choices the host exposes (e.g. 'open-source-ready',
   *  'production-ready'). Pages render these as picker options. */
  listPresets(): PolicyPreset[];
  evaluate(req: PolicyEvaluateRequest, opts?: { signal?: AbortSignal; onProgress?: (m: string) => void }): Promise<PolicyEvalResult>;
}

// ─────────────────────────── Org Scan ────────────────────────────────

export interface OrgScanRequest {
  /** Org or username. */
  target: string;
  /** True if `target` is a user account, false if it's an organisation. */
  isUser?: boolean;
  /** Optional cap on number of repos. */
  maxRepos?: number;
  skipForks?: boolean;
  skipArchived?: boolean;
}

export interface OrgScanProgress {
  phase: 'listing' | 'analyzing' | 'done';
  /** Total repos discovered (may be 0 during 'listing'). */
  total: number;
  /** Number of repos analysed so far. */
  completed: number;
  /** Repo currently being analysed (empty during 'listing' / 'done'). */
  currentRepo: string;
  /** Items collected so far. Updated incrementally; pages re-render to show
   *  the streaming table. */
  items: OrgScanItem[];
}

export interface OrgScanResult {
  items: OrgScanItem[];
  summary: OrgScanSummary;
}

export interface OrgScanService {
  run(req: OrgScanRequest, opts?: { signal?: AbortSignal; onProgress?: (p: OrgScanProgress) => void }): Promise<OrgScanResult>;
}

// ─────────────────────────── Git Stats ───────────────────────────────

export interface GitStatsRunOptions {
  signal?: AbortSignal;
  /** Free-form progress messages for the LoadingPanel. */
  onProgress?: (message: string) => void;
}

/** The shape `<GitStatsView />` consumes is the legacy GitStatsAnalysis
 *  from the in-browser app — re-exported through @repoguru/core's
 *  `legacy` namespace. We accept `unknown` here so the services layer
 *  doesn't pull in the heavy legacy types; pages narrow before passing
 *  it to GitStatsView. */
export interface GitStatsResult {
  analysis: unknown;
}

export interface GitStatsService {
  run(repo: RepoRef, opts?: GitStatsRunOptions): Promise<GitStatsResult>;
}

// ─────────────────────────── Repo Picker ─────────────────────────────

export interface RepoSuggestion {
  /** The string passed back to the page via onChange when a suggestion is chosen. */
  value: string;
  /** Primary text shown in the suggestion chip / row. */
  label: string;
  /** Optional secondary line (description, language, last-modified, …). */
  hint?: string;
}

export interface RepoBrowseService {
  /** Open the host's "browse for a repo" UI and return the chosen repo
   *  string, or null if the user cancelled.
   *   - Browser: opens the GitHub repo picker (or auth flow if no token).
   *   - Desktop: opens the OS folder picker via Electron IPC. */
  browse(): Promise<string | null>;
  /** Recent suggestions to render under the input as chips. The shared
   *  picker UI doesn't care where these come from. */
  recents(): RepoSuggestion[];
  /** Optional human-readable hint shown under the input (e.g. "Pick a folder
   *  from your machine" or "Type owner/repo or sign in to browse"). Host
   *  decides; if undefined, the picker shows no hint line. */
  hint?: string;
}

export type RepoPickerProps = {
  /** Visible label text (rendered identically across hosts). */
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Submit on Enter. */
  onSubmit?: () => void;
  disabled?: boolean;
  /** DOM id for the input. */
  inputId?: string;
  /** Placeholder shown when value is empty. */
  placeholder?: string;
};

// ─────────────────────────── Top-level services bag ──────────────────

export interface RepoGuruServices {
  compare: CompareService;
  score: ScoreService;
  techDetect: TechDetectService;
  policy: PolicyService;
  orgScan: OrgScanService;
  gitStats: GitStatsService;
  /** Host-supplied repo browse / recents service. The shared <RepoPicker />
   *  UI consumes this — both hosts render the SAME picker chrome; only the
   *  data source differs (GitHub API vs filesystem). */
  repoBrowse: RepoBrowseService;
  /** Whether this host is the desktop variant. Pages may render extra
   *  panels when the desktop has access to more data than the browser
   *  (e.g. ALL commits vs the browser's 1000-commit cap). */
  isDesktop?: boolean;
}
