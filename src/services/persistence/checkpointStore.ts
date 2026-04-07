import type { GitHubCommitDetailResponse } from '../../types/gitStats';
import { getDb } from './db';
import { STORE_CHECKPOINTS } from '../../utils/constants';

/** Serialised diff-stats entry: [sha, { additions, deletions }] */
export type DiffStatEntry = [string, { additions: number; deletions: number }];

export interface AnalysisCheckpoint {
  key: string; // "owner/repo" lowercase
  savedAt: number; // Date.now()
  completedBatchIndex: number; // how many batches (of 25) are done
  totalCommits: number;
  commitDetails: GitHubCommitDetailResponse[];
  diffStats: DiffStatEntry[];
}

const CHECKPOINT_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function cacheKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

export async function saveCheckpoint(cp: AnalysisCheckpoint): Promise<void> {
  const db = await getDb();
  await db.put(STORE_CHECKPOINTS, cp);
}

export async function loadCheckpoint(
  owner: string,
  repo: string,
): Promise<AnalysisCheckpoint | null> {
  const db = await getDb();
  const cp = await db.get(STORE_CHECKPOINTS, cacheKey(owner, repo));
  if (!cp) return null;
  // Expire stale checkpoints
  if (Date.now() - cp.savedAt > CHECKPOINT_MAX_AGE_MS) {
    await clearCheckpoint(owner, repo);
    return null;
  }
  return cp as AnalysisCheckpoint;
}

export async function clearCheckpoint(owner: string, repo: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_CHECKPOINTS, cacheKey(owner, repo));
}

export async function appendBatchToCheckpoint(
  owner: string,
  repo: string,
  batchDetails: GitHubCommitDetailResponse[],
  batchDiffStats: DiffStatEntry[],
  newBatchIndex: number,
  totalCommits: number,
): Promise<void> {
  const db = await getDb();
  const key = cacheKey(owner, repo);
  const existing = (await db.get(STORE_CHECKPOINTS, key)) as AnalysisCheckpoint | undefined;

  if (existing) {
    existing.commitDetails.push(...batchDetails);
    existing.diffStats.push(...batchDiffStats);
    existing.completedBatchIndex = newBatchIndex;
    existing.savedAt = Date.now();
    await db.put(STORE_CHECKPOINTS, existing);
  } else {
    // First batch — create checkpoint
    await db.put(STORE_CHECKPOINTS, {
      key,
      savedAt: Date.now(),
      completedBatchIndex: newBatchIndex,
      totalCommits,
      commitDetails: batchDetails,
      diffStats: batchDiffStats,
    } satisfies AnalysisCheckpoint);
  }
}
