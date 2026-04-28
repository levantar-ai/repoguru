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

export interface GitStatsProgress {
  /** Free-form line for the secondary status display. */
  message: string;
  /** 0–100, drives the overall progress bar. */
  overall: number;
  /** 0–100, drives the per-phase sub-progress bar. */
  sub: number;
  /** Optional explicit phase name (cloning / scanning / diffing / sizing / sectioning). */
  phase?: string;
}

export interface GitStatsRunOptions {
  signal?: AbortSignal;
  /** Streaming progress for the LoadingPanel double-bar UI. */
  onProgress?: (p: GitStatsProgress) => void;
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

/** Summary of a GitHub repo a user owns / has access to — used by the
 *  shared "Connect to GitHub" picker UI. Both hosts populate this from
 *  the GitHub API when a token / OAuth session is available. */
export interface GitHubRepoSummary {
  owner: string;
  repo: string;
  description?: string;
  language?: string;
  stars?: number;
  /** Where the repo is hosted relative to the user — typically the org
   *  name; the picker groups by this value. */
  ownerLabel?: string;
}

export interface RepoBrowseService {
  /** Open the host's filesystem-style "browse for a repo" affordance.
   *  Browser: pops a one-shot prompt. Desktop: opens Electron's native
   *  folder picker. Returns the chosen repo string or null if cancelled. */
  browse(): Promise<string | null>;
  /** Recent suggestions to render under the input as chips. */
  recents(): RepoSuggestion[];
  /** Optional human-readable hint shown under the input. */
  hint?: string;

  // ── GitHub Connect / repo finder (shared between both apps) ──

  /** True when the host has a GitHub token / OAuth session and can list the
   *  user's repos. When false, the picker shows a "Sign in with GitHub" CTA
   *  + token-setup help text (same chrome on web and desktop). */
  hasGitHubToken(): boolean;

  /** Begin the host's GitHub auth flow (OAuth in the browser; on desktop
   *  this opens a tab to the token-create page or kicks off device-flow
   *  OAuth via Electron). Returns when the flow has been triggered — the
   *  picker re-renders when hasGitHubToken() flips. */
  connectGitHub?(): Promise<void> | void;

  /** Fetch the user's GitHub repos for the picker's filtered list. Returns
   *  empty array when no token. Hosts may cache; the picker calls
   *  refreshGitHubRepos() to force a refresh. */
  listGitHubRepos?(): Promise<GitHubRepoSummary[]>;

  /** Force-refresh the GitHub repo list. */
  refreshGitHubRepos?(): Promise<void>;

  /** Optional human-readable instructions for the unauthenticated state
   *  (e.g. token scopes to enable, link to settings). Rendered as JSX
   *  when present. Pages may pass this as a fragment via React; using
   *  string here keeps the type host-neutral. */
  tokenSetupHelp?: string;
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
