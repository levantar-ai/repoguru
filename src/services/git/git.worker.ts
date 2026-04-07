import { Buffer } from 'buffer'; // NOSONAR: browser polyfill, not Node.js built-in
(self as unknown as Record<string, unknown>).Buffer = Buffer;

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import type { GitStatsRawData } from '../../types/gitStats';
import {
  logToCommits,
  diffCommit,
  diffCommitFast,
  computeLanguages,
  computeWeeklyAggregates,
  sampleIndices,
  countLinesOfCode,
} from './extractors';

export interface CloneMessage {
  type: 'clone';
  owner: string;
  repo: string;
  corsProxy: string;
  token?: string;
  includeStats?: boolean;
  depth?: number;
  /** When resuming, skip this many batches of diffs */
  resumeFromBatch?: number;
  /** Serialised diffStats from checkpoint — used to seed diffStatsMap on resume */
  resumeDiffStats?: [string, { additions: number; deletions: number }][];
}

export interface ProgressMessage {
  type: 'progress';
  step: string;
  percent: number;
  subPercent: number;
  message: string;
}

export interface CacheTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size: number;
}

export interface CacheFileContent {
  path: string;
  content: string;
  size: number;
}

export interface CloneDoneMessage {
  type: 'clone-done';
  tree: CacheTreeEntry[];
  files: CacheFileContent[];
}

export interface StatsDoneMessage {
  type: 'stats-done';
  data: GitStatsRawData;
  /** When true, data.commitDetails only contains freshly-diffed batches (not resumed ones) */
  partial?: boolean;
}

export interface BatchDoneMessage {
  type: 'batch-done';
  batchIndex: number;
  totalCommits: number;
  commitDetails: GitStatsRawData['commitDetails'];
  diffStats: [string, { additions: number; deletions: number }][];
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WorkerOutMessage =
  | ProgressMessage
  | CloneDoneMessage
  | StatsDoneMessage
  | BatchDoneMessage
  | ErrorMessage;

const DIR = '/repo';
const MAX_TEXT_FILE_SIZE = 512 * 1024; // 512KB

// Directories to skip entirely during walk — never read content, prune subtree
const SKIP_DIRS = new Set([
  'node_modules',
  'vendor',
  'bower_components',
  '__pycache__',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  '.cache',
  '.venv',
  'venv',
  'env',
]);

interface HeadWalkResult {
  fileList: string[];
  totalLinesOfCode: number;
  binaryFileCount: number;
  tree: CacheTreeEntry[];
  files: CacheFileContent[];
}

type WalkProgressFn = (percent: number, message: string) => void;

async function walkHead(
  fs: InstanceType<typeof LightningFS>,
  onProgress?: WalkProgressFn,
): Promise<HeadWalkResult> {
  const headOid = await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' });

  // Quick count pass — type checks only, no content reads
  onProgress?.(0, 'Scanning file tree...');
  let totalFiles = 0;

  await git.walk({
    fs,
    dir: DIR,
    trees: [git.TREE({ ref: headOid })],
    map: async (filepath, entries) => {
      if (!entries || filepath === '.') return;
      const segments = filepath.split('/');
      if (segments.some((seg) => SKIP_DIRS.has(seg))) return null;
      const [entry] = entries;
      if (!entry) return;
      const type = await entry.type();
      if (type === 'blob') totalFiles++;
    },
  });

  onProgress?.(5, `Found ${totalFiles} files, reading contents...`);

  // Content pass — reads blobs inline via entry.content() (pack-aware, fast)
  const fileList: string[] = [];
  let totalLinesOfCode = 0;
  let binaryFileCount = 0;
  const tree: CacheTreeEntry[] = [];
  const files: CacheFileContent[] = [];
  const decoder = new TextDecoder();
  let filesRead = 0;

  await git.walk({
    fs,
    dir: DIR,
    trees: [git.TREE({ ref: headOid })],
    map: async (filepath, entries) => {
      if (!entries || filepath === '.') return;

      // Prune skipped directories — returning null prevents recursion into subtree
      const segments = filepath.split('/');
      if (segments.some((seg) => SKIP_DIRS.has(seg))) return null;

      const [entry] = entries;
      if (!entry) return;
      const type = await entry.type();

      // Skip directory tree entries during walk — synthesize from file paths after
      if (type !== 'blob') return;

      fileList.push(filepath);
      filesRead++;

      try {
        const content = await entry.content();
        if (!content) return;

        const locResult = countLinesOfCode(content);
        if (locResult.binary) {
          binaryFileCount++;
          tree.push({
            path: filepath,
            mode: '100644',
            type: 'blob',
            sha: '',
            size: content.length,
          });
        } else {
          totalLinesOfCode += locResult.lines;
          tree.push({
            path: filepath,
            mode: '100644',
            type: 'blob',
            sha: '',
            size: content.length,
          });

          // Capture text file contents for cache (skip large files)
          if (content.length <= MAX_TEXT_FILE_SIZE) {
            files.push({ path: filepath, content: decoder.decode(content), size: content.length });
          }
        }
      } catch {
        tree.push({ path: filepath, mode: '100644', type: 'blob', sha: '', size: 0 });
      }

      // Report progress every 20 files
      if (filesRead % 20 === 0 || filesRead === totalFiles) {
        const pct = 5 + Math.round((filesRead / totalFiles) * 90);
        onProgress?.(pct, `Reading files... ${filesRead}/${totalFiles}`);
      }
    },
  });

  onProgress?.(98, `${totalLinesOfCode.toLocaleString()} LOC across ${files.length} files`);

  // Synthesize directory tree entries from file paths
  const dirSet = new Set<string>();
  for (const filepath of fileList) {
    let pos = filepath.indexOf('/');
    while (pos !== -1) {
      const dir = filepath.slice(0, pos);
      if (!dirSet.has(dir)) {
        dirSet.add(dir);
        tree.push({ path: dir, mode: '040000', type: 'tree', sha: '', size: 0 });
      }
      pos = filepath.indexOf('/', pos + 1);
    }
  }

  return { fileList, totalLinesOfCode, binaryFileCount, tree, files };
}

self.onmessage = async (e: MessageEvent<CloneMessage>) => {
  await handleClone(e.data);
};

async function handleClone(msg: CloneMessage) {
  const { owner, repo, corsProxy, token, includeStats, depth: cloneDepth } = msg;

  try {
    const fs = new LightningFS('repoguru-clone', { wipe: true });
    const url = `https://github.com/${owner}/${repo}.git`;

    // Progress ranges: walkHead gets a big chunk when it's the last phase,
    // a smaller chunk when commit analysis follows
    const CLONE_END = 30;
    const WALK_END = includeStats ? 50 : 95;

    // Phase 1: Clone + walkHead (all callers)
    highWaterMark = 0;
    postProgress('cloning', 0, 0, 'Cloning repository...');

    const depth = cloneDepth ?? (includeStats ? 1000 : 1);

    await git.clone({
      fs,
      http,
      dir: DIR,
      url,
      depth,
      singleBranch: true,
      noCheckout: true,
      noTags: true,
      corsProxy,
      ...(token ? { onAuth: () => ({ username: 'x-access-token', password: token }) } : {}),
      onProgress: (progress) => {
        let subPct = 0;
        if (progress.total && progress.total > 0) {
          subPct = Math.round((progress.loaded / progress.total) * 100);
        } else if (progress.loaded) {
          subPct = Math.min(98, Math.round(progress.loaded / 100000));
        }
        // Map to overall 0→CLONE_END; high-water mark prevents regression across phases
        const overall = Math.round((subPct / 100) * CLONE_END);
        const phase = progress.phase || 'Downloading';
        postProgress('cloning', overall, subPct, `${phase}... ${formatBytes(progress.loaded)}`);
      },
    });

    postProgress('reading-files', CLONE_END, 0, 'Scanning file tree...');

    // When includeStats, run walkHead and git.log in parallel (both read-only)
    const logPromise = includeStats ? git.log({ fs, dir: DIR, depth }) : null;

    const walkRange = WALK_END - CLONE_END;
    const walkResult = await walkHead(fs, (pct, msg) => {
      const overall = CLONE_END + Math.round((pct / 100) * walkRange);
      postProgress('reading-files', overall, pct, msg);
    });

    postProgress('reading-files', WALK_END, 100, `Done — ${walkResult.files.length} files`);

    // Emit clone-done so non-stats callers can resolve immediately
    const cloneDoneMsg: CloneDoneMessage = {
      type: 'clone-done',
      tree: walkResult.tree,
      files: walkResult.files,
    };
    self.postMessage(cloneDoneMsg);

    // Phase 2: Commit analysis (git stats only, opt-in)
    if (includeStats) {
      postProgress('extracting-commits', 52, 0, 'Reading commit history...');

      const logEntries = await logPromise!;
      const commits = logToCommits(logEntries);

      postProgress('extracting-commits', 55, 100, `Found ${logEntries.length} commits`);

      const resumeFromBatch = msg.resumeFromBatch ?? 0;
      const isResuming = resumeFromBatch > 0;

      if (isResuming) {
        postProgress('extracting-details', 57, 0, `Resuming from batch ${resumeFromBatch}...`);
      } else {
        postProgress('extracting-details', 57, 0, 'Computing file diffs...');
      }

      const BATCH_SIZE = 50;
      const FULL_DIFF_COUNT = 15;
      const totalCommits = logEntries.length;
      const commitDetails: GitStatsRawData['commitDetails'] = [];
      const diffStatsMap = new Map<string, { additions: number; deletions: number }>();

      // On resume, seed diffStatsMap with checkpointed entries
      if (msg.resumeDiffStats) {
        for (const [sha, stats] of msg.resumeDiffStats) {
          diffStatsMap.set(sha, stats);
        }
      }

      // Pre-compute which commits are merges (>1 parent) — always use fast diff
      const mergeSet = new Set<number>();
      for (let i = 0; i < logEntries.length; i++) {
        if (logEntries[i].commit.parent.length > 1) mergeSet.add(i);
      }

      const fullDiffIndices = new Set(sampleIndices(totalCommits, FULL_DIFF_COUNT));

      let completed = 0;
      let batchNumber = 0;

      for (let batchStart = 0; batchStart < totalCommits; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalCommits);

        // Skip already-completed batches on resume
        if (batchNumber < resumeFromBatch) {
          batchNumber++;
          completed += batchEnd - batchStart;
          const overall = 57 + Math.round((completed / totalCommits) * 25);
          const subPct = Math.round((completed / totalCommits) * 100);
          postProgress(
            'extracting-details',
            overall,
            subPct,
            `Skipping completed batch ${batchNumber}/${Math.ceil(totalCommits / BATCH_SIZE)}`,
          );
          continue;
        }

        const results = await Promise.allSettled(
          logEntries.slice(batchStart, batchEnd).map(async (entry, offset) => {
            const idx = batchStart + offset;
            const parentOid = entry.commit.parent.length > 0 ? entry.commit.parent[0] : null;
            // Merges always get fast diff — they're expensive and redundant
            const useFull = !mergeSet.has(idx) && fullDiffIndices.has(idx);
            const result = useFull
              ? await diffCommit(fs, DIR, entry.oid, parentOid)
              : await diffCommitFast(fs, DIR, entry.oid, parentOid);
            return { entry, result };
          }),
        );

        const batchDetails: GitStatsRawData['commitDetails'] = [];
        const batchDiffStats: [string, { additions: number; deletions: number }][] = [];

        for (const outcome of results) {
          if (outcome.status !== 'fulfilled') continue;
          const { entry, result } = outcome.value;
          const stats = result.stats;

          const detail = {
            sha: entry.oid,
            commit: {
              message: entry.commit.message,
              author: {
                name: entry.commit.author.name,
                email: entry.commit.author.email,
                date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
              },
            },
            author: {
              login: entry.commit.author.name,
              avatar_url: '',
            },
            stats: {
              total: stats.total,
              additions: stats.additions,
              deletions: stats.deletions,
            },
            files: result.map((f) => ({
              sha: f.sha,
              filename: f.filename,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
              changes: f.changes,
            })),
          };

          batchDetails.push(detail);
          commitDetails.push(detail);

          diffStatsMap.set(entry.oid, {
            additions: stats.additions,
            deletions: stats.deletions,
          });
          batchDiffStats.push([
            entry.oid,
            { additions: stats.additions, deletions: stats.deletions },
          ]);
        }

        // Post batch results for checkpointing on main thread
        const batchDoneMsg: BatchDoneMessage = {
          type: 'batch-done',
          batchIndex: batchNumber,
          totalCommits,
          commitDetails: batchDetails,
          diffStats: batchDiffStats,
        };
        self.postMessage(batchDoneMsg);

        batchNumber++;
        completed += batchEnd - batchStart;
        const overall = 57 + Math.round((completed / totalCommits) * 25);
        const subPct = Math.round((completed / totalCommits) * 100);
        postProgress(
          'extracting-details',
          overall,
          subPct,
          `Diffing commits... ${completed}/${totalCommits}`,
        );
      }

      postProgress('computing-stats', 85, 0, 'Computing statistics...');

      const languages = computeLanguages(walkResult.fileList);

      postProgress('computing-stats', 90, 50, 'Building weekly aggregates...');

      const aggregates = computeWeeklyAggregates(logEntries, diffStatsMap);

      postProgress('computing-stats', 95, 90, 'Assembling results...');

      const rawData: GitStatsRawData = {
        commits,
        commitDetails,
        contributorStats: aggregates.contributorStats,
        codeFrequency: aggregates.codeFrequency,
        commitActivity: aggregates.commitActivity,
        participation: null,
        punchCard: aggregates.punchCard,
        languages,
        totalLinesOfCode: walkResult.totalLinesOfCode,
        binaryFileCount: walkResult.binaryFileCount,
      };

      const statsDoneMsg: StatsDoneMessage = {
        type: 'stats-done',
        data: rawData,
        partial: isResuming,
      };
      self.postMessage(statsDoneMsg);
    }

    // Clean up filesystem
    try {
      await fs.promises.rmdir(DIR, { recursive: true } as unknown as undefined);
    } catch {
      // Cleanup failure is non-critical
    }
  } catch (err) {
    const errorMsg: ErrorMessage = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Clone failed',
    };
    self.postMessage(errorMsg);
  }
}

let highWaterMark = 0;

function postProgress(step: string, percent: number, subPercent: number, message: string) {
  highWaterMark = Math.max(highWaterMark, percent);
  const msg: ProgressMessage = {
    type: 'progress',
    step,
    percent: highWaterMark,
    subPercent,
    message,
  };
  self.postMessage(msg);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
