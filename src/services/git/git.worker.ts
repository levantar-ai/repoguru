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
  type: 'clone' | 'clone-cache-only';
  owner: string;
  repo: string;
  corsProxy: string;
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

export interface ResultMessage {
  type: 'result';
  data: GitStatsRawData;
  tree: CacheTreeEntry[];
  files: CacheFileContent[];
}

export interface CacheOnlyResultMessage {
  type: 'cache-only-result';
  tree: CacheTreeEntry[];
  files: CacheFileContent[];
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WorkerOutMessage =
  | ProgressMessage
  | ResultMessage
  | CacheOnlyResultMessage
  | ErrorMessage;

const DIR = '/repo';
const MAX_TEXT_FILE_SIZE = 512 * 1024; // 512KB

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
  const { type: msgType, owner, repo, corsProxy } = e.data;

  if (msgType === 'clone-cache-only') {
    await handleCacheOnlyClone(owner, repo, corsProxy);
  } else {
    await handleFullClone(owner, repo, corsProxy);
  }
};

async function handleCacheOnlyClone(owner: string, repo: string, corsProxy: string) {
  try {
    const fs = new LightningFS('repoguru-cache', { wipe: true });
    const url = `https://github.com/${owner}/${repo}.git`;

    postProgress('cloning', 0, 'Cloning repository...');

    await git.clone({
      fs,
      http,
      dir: DIR,
      url,
      depth: 1,
      singleBranch: true,
      noCheckout: true,
      noTags: true,
      corsProxy,
      onProgress: (progress) => {
        let percent = 0;
        if (progress.total && progress.total > 0) {
          percent = Math.round((progress.loaded / progress.total) * 50);
        } else if (progress.loaded) {
          percent = Math.min(48, Math.round(progress.loaded / 100000));
        }
        const phase = progress.phase || 'Downloading';
        postProgress('cloning', percent, `${phase}... ${formatBytes(progress.loaded)}`);
      },
    });

    postProgress('cloning', 50, 'Clone complete, reading files...');

    const walkResult = await walkHead(fs);

    postProgress('cloning', 95, 'Done');

    const resultMsg: CacheOnlyResultMessage = {
      type: 'cache-only-result',
      tree: walkResult.tree,
      files: walkResult.files,
    };
    self.postMessage(resultMsg);

    // Clean up
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

async function handleFullClone(owner: string, repo: string, corsProxy: string) {
  try {
    // Initialize in-memory filesystem
    const fs = new LightningFS('repoguru-clone', { wipe: true });

    const url = `https://github.com/${owner}/${repo}.git`;

    // 1. Clone (noCheckout — we only need git objects, not a working tree)
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

    postProgress('cloning', 40, 'Clone complete');

    // 2. Extract commits via git.log()
    postProgress('extracting-commits', 42, 'Reading commit history...');

    const logEntries = await git.log({ fs, dir: DIR, depth: 1000 });
    const commits = logToCommits(logEntries);

    postProgress('extracting-commits', 50, `Found ${logEntries.length} commits`);

    // 3. Diff ALL commits in parallel batches
    //    - Fast OID-only diff for most commits (file lists + status, no blob reads)
    //    - Full content diff for an evenly-spaced subset (accurate line counts for charts)
    postProgress('extracting-details', 52, 'Computing file diffs...');

    const BATCH_SIZE = 10;
    const FULL_DIFF_COUNT = 30;
    const totalCommits = logEntries.length;
    const commitDetails: GitStatsRawData['commitDetails'] = [];
    const diffStatsMap = new Map<string, { additions: number; deletions: number }>();

    // Pick which commits get full content diffs (evenly spaced for chart accuracy)
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
      const percent = 52 + Math.round((completed / totalCommits) * 25);
      postProgress(
        'extracting-details',
        percent,
        `Diffing commits... ${completed}/${totalCommits}`,
      );
    }

    // 4. Compute aggregate stats
    postProgress('computing-stats', 80, 'Computing statistics...');

    // Get file list + LOC count from HEAD tree (also extracts tree/files for cache)
    const walkResult = await walkHead(fs);
    const languages = computeLanguages(walkResult.fileList);

    postProgress(
      'computing-stats',
      83,
      `${walkResult.totalLinesOfCode.toLocaleString()} lines of code, ${walkResult.binaryFileCount} binary files`,
    );

    postProgress('computing-stats', 85, 'Building weekly aggregates...');

    const aggregates = computeWeeklyAggregates(logEntries, diffStatsMap);

    // 5. Assemble GitStatsRawData
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

    const resultMsg: ResultMessage = {
      type: 'result',
      data: rawData,
      tree: walkResult.tree,
      files: walkResult.files,
    };
    self.postMessage(resultMsg);

    // 6. Clean up filesystem
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
