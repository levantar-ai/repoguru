import type { TreeEntry, FileContent } from '../../types';

export interface CachedRepoData {
  owner: string;
  repo: string;
  tree: TreeEntry[];
  files: FileContent[];
  cachedAt: number;
}

let cache: CachedRepoData | null = null;
let pendingClone: { key: string; promise: Promise<CachedRepoData> } | null = null;

function cacheKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export function getCache(owner: string, repo: string): CachedRepoData | null {
  if (!cache) return null;
  if (cacheKey(cache.owner, cache.repo) !== cacheKey(owner, repo)) return null;
  return cache;
}

export function setCache(
  owner: string,
  repo: string,
  tree: TreeEntry[],
  files: FileContent[],
): void {
  cache = { owner, repo, tree, files, cachedAt: Date.now() };
}

export function clearCache(): void {
  cache = null;
}

export function invalidateIfDifferent(owner: string, repo: string): void {
  if (!cache) return;
  if (cacheKey(cache.owner, cache.repo) !== cacheKey(owner, repo)) {
    cache = null;
  }
}

export function invalidateIfNeitherMatch(repos: { owner: string; repo: string }[]): void {
  if (!cache) return;
  const currentKey = cacheKey(cache.owner, cache.repo);
  const matches = repos.some((r) => cacheKey(r.owner, r.repo) === currentKey);
  if (!matches) {
    cache = null;
  }
}

export function getPendingClone(owner: string, repo: string): Promise<CachedRepoData> | null {
  if (!pendingClone) return null;
  if (pendingClone.key !== cacheKey(owner, repo)) return null;
  return pendingClone.promise;
}

export function setPendingClone(
  owner: string,
  repo: string,
  promise: Promise<CachedRepoData>,
): void {
  pendingClone = { key: cacheKey(owner, repo), promise };
}

export function clearPendingClone(): void {
  pendingClone = null;
}
