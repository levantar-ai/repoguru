import type { TreeEntry, RateLimitInfo } from '../../types';
import type { GitHubTreeResponse } from './types';
import { githubFetch } from './client';

export async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<TreeEntry[]> {
  const data = await githubFetch<GitHubTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token,
    onRateLimit,
  );

  return data.tree.map((entry) => ({
    path: entry.path,
    mode: entry.mode,
    type: entry.type,
    sha: entry.sha,
    size: entry.size,
  }));
}
