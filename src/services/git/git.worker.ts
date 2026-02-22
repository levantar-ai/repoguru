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
}

export interface ProgressMessage {
  type: 'progress';
  step: string;
  percent: number;
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
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WorkerOutMessage = ProgressMessage | CloneDoneMessage | StatsDoneMessage | ErrorMessage;

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

async function walkHead(fs: InstanceType<typeof LightningFS>): Promise<HeadWalkResult> {
  const headOid = await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' });
  const fileList: string[] = [];
  let totalLinesOfCode = 0;
  let binaryFileCount = 0;
  const tree: CacheTreeEntry[] = [];
  const files: CacheFileContent[] = [];
  const decoder = new TextDecoder();
  const dirSet = new Set<string>();

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
    },
  });

  // Synthesize directory tree entries from file paths
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
  const { owner, repo, corsProxy, token, includeStats } = msg;

  try {
    const fs = new LightningFS('repoguru-clone', { wipe: true });
    const url = `https://github.com/${owner}/${repo}.git`;

    // Phase 1: Clone + walkHead (all callers)
    postProgress('cloning', 0, 'Cloning repository...');

    await git.clone({
      fs,
      http,
      dir: DIR,
      url,
      depth: 1000,
      singleBranch: true,
      noCheckout: true,
      noTags: true,
      corsProxy,
      ...(token ? { onAuth: () => ({ username: 'x-access-token', password: token }) } : {}),
      onProgress: (progress) => {
        let percent = 0;
        if (progress.total && progress.total > 0) {
          percent = Math.round((progress.loaded / progress.total) * 40);
        } else if (progress.loaded) {
          percent = Math.min(38, Math.round(progress.loaded / 100000));
        }
        const phase = progress.phase || 'Downloading';
        postProgress('cloning', percent, `${phase}... ${formatBytes(progress.loaded)}`);
      },
    });

    postProgress('cloning', 40, 'Clone complete, reading files...');

    const walkResult = await walkHead(fs);

    postProgress('cloning', 50, `Done — ${walkResult.files.length} files`);

    // Emit clone-done so non-stats callers can resolve immediately
    const cloneDoneMsg: CloneDoneMessage = {
      type: 'clone-done',
      tree: walkResult.tree,
      files: walkResult.files,
    };
    self.postMessage(cloneDoneMsg);

    // Phase 2: Commit analysis (git stats only, opt-in)
    if (includeStats) {
      postProgress('extracting-commits', 52, 'Reading commit history...');

      const logEntries = await git.log({ fs, dir: DIR, depth: 1000 });
      const commits = logToCommits(logEntries);

      postProgress('extracting-commits', 55, `Found ${logEntries.length} commits`);

      postProgress('extracting-details', 57, 'Computing file diffs...');

      const BATCH_SIZE = 10;
      const FULL_DIFF_COUNT = 30;
      const totalCommits = logEntries.length;
      const commitDetails: GitStatsRawData['commitDetails'] = [];
      const diffStatsMap = new Map<string, { additions: number; deletions: number }>();

      const fullDiffIndices = new Set(sampleIndices(totalCommits, FULL_DIFF_COUNT));

      let completed = 0;

      for (let batchStart = 0; batchStart < totalCommits; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalCommits);

        const results = await Promise.allSettled(
          logEntries.slice(batchStart, batchEnd).map(async (entry, offset) => {
            const parentOid = entry.commit.parent.length > 0 ? entry.commit.parent[0] : null;
            const useFull = fullDiffIndices.has(batchStart + offset);
            const result = useFull
              ? await diffCommit(fs, DIR, entry.oid, parentOid)
              : await diffCommitFast(fs, DIR, entry.oid, parentOid);
            return { entry, result };
          }),
        );

        for (const outcome of results) {
          if (outcome.status !== 'fulfilled') continue;
          const { entry, result } = outcome.value;
          const stats = result.stats;

          commitDetails.push({
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
          });

          diffStatsMap.set(entry.oid, {
            additions: stats.additions,
            deletions: stats.deletions,
          });
        }

        completed += batchEnd - batchStart;
        const percent = 57 + Math.round((completed / totalCommits) * 25);
        postProgress(
          'extracting-details',
          percent,
          `Diffing commits... ${completed}/${totalCommits}`,
        );
      }

      postProgress('computing-stats', 85, 'Computing statistics...');

      const languages = computeLanguages(walkResult.fileList);

      postProgress('computing-stats', 90, 'Building weekly aggregates...');

      const aggregates = computeWeeklyAggregates(logEntries, diffStatsMap);

      postProgress('computing-stats', 95, 'Assembling results...');

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

function postProgress(step: string, percent: number, message: string) {
  const msg: ProgressMessage = { type: 'progress', step, percent, message };
  self.postMessage(msg);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
