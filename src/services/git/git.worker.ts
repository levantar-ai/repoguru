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
}

export interface ProgressMessage {
  type: 'progress';
  step: string;
  percent: number;
  message: string;
}

export interface ResultMessage {
  type: 'result';
  data: GitStatsRawData;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WorkerOutMessage = ProgressMessage | ResultMessage | ErrorMessage;

const DIR = '/repo';

self.onmessage = async (e: MessageEvent<CloneMessage>) => {
  const { owner, repo, corsProxy } = e.data;

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

    // 3. Diff sampled commits in parallel batches
    //    - Fast OID-only diff for all sampled commits (file lists + status)
    //    - Full content diff for a subset (accurate line counts for charts)
    postProgress('extracting-details', 52, 'Computing file diffs...');

    const maxDetails = 100;
    const BATCH_SIZE = 8;
    const FULL_DIFF_COUNT = 25;
    const indices = sampleIndices(logEntries.length, maxDetails);
    const commitDetails: GitStatsRawData['commitDetails'] = [];
    const diffStatsMap = new Map<string, { additions: number; deletions: number }>();

    // Pick which indices get full content diffs (evenly spaced subset)
    const fullDiffIndices = new Set(
      sampleIndices(indices.length, FULL_DIFF_COUNT).map((i) => indices[i]),
    );

    let completed = 0;

    // Process in parallel batches
    for (let batchStart = 0; batchStart < indices.length; batchStart += BATCH_SIZE) {
      const batch = indices.slice(batchStart, batchStart + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (idx) => {
          const entry = logEntries[idx];
          const parentOid = entry.commit.parent.length > 0 ? entry.commit.parent[0] : null;
          const useFull = fullDiffIndices.has(idx);
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

      completed += batch.length;
      const percent = 52 + Math.round((completed / indices.length) * 25);
      postProgress(
        'extracting-details',
        percent,
        `Diffing commits... ${completed}/${indices.length}`,
      );
    }

    // 4. Compute aggregate stats
    postProgress('computing-stats', 80, 'Computing statistics...');

    // Get file list + LOC count from HEAD tree (no checkout needed)
    const headOid = await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' });
    const fileList: string[] = [];
    let totalLinesOfCode = 0;
    let binaryFileCount = 0;

    await git.walk({
      fs,
      dir: DIR,
      trees: [git.TREE({ ref: headOid })],
      map: async (filepath, entries) => {
        if (!entries || filepath === '.') return;
        const [entry] = entries;
        if (!entry) return;
        const type = await entry.type();
        if (type !== 'blob') return;

        fileList.push(filepath);

        try {
          const content = await entry.content();
          if (content) {
            const result = countLinesOfCode(content);
            if (result.binary) {
              binaryFileCount++;
            } else {
              totalLinesOfCode += result.lines;
            }
          }
        } catch {
          // Skip files that can't be read
        }
      },
    });
    const languages = computeLanguages(fileList);

    postProgress(
      'computing-stats',
      83,
      `${totalLinesOfCode.toLocaleString()} lines of code, ${binaryFileCount} binary files`,
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
      totalLinesOfCode,
      binaryFileCount,
    };

    const resultMsg: ResultMessage = { type: 'result', data: rawData };
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
};

function postProgress(step: string, percent: number, message: string) {
  const msg: ProgressMessage = { type: 'progress', step, percent, message };
  self.postMessage(msg);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
