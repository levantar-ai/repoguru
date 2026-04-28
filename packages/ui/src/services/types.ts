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

// ─────────────────────────── Repo Picker ─────────────────────────────

export interface RepoPickerProps {
  /** Inline label text (matches the in-browser app's label styling). */
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Submit on Enter. */
  onSubmit?: () => void;
  /** Greyed-out / disabled while a request is in flight. */
  disabled?: boolean;
  /** DOM id for the input — pages set it so labels associate correctly. */
  inputId?: string;
}

/** A picker is a host-supplied React component (browser: GitHub repo
 *  search; desktop: filesystem browse + recent paths). Shared pages render
 *  it in their input form so the picker fits the host but the surrounding
 *  chrome stays identical. */
export type RepoPickerComponent = (props: RepoPickerProps) => ReactNode;

// ─────────────────────────── Top-level services bag ──────────────────

export interface RepoGuruServices {
  compare: CompareService;
  score: ScoreService;
  techDetect: TechDetectService;
  policy: PolicyService;
  orgScan: OrgScanService;
  /** Host-supplied repo picker component. */
  RepoPicker: RepoPickerComponent;
  /** Optional human-friendly description of where repos come from. Pages
   *  use this to label inputs ("GitHub repository" vs "Local repository"). */
  repoLabelSingular?: string;
  /** Whether this host is the desktop variant. Pages may render extra
   *  panels when the desktop has access to more data than the browser
   *  (e.g. ALL commits vs the browser's 1000-commit cap). */
  isDesktop?: boolean;
}
