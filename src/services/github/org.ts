import type { RepoInfo, RateLimitInfo } from '../../types';
import type { GitHubRepoResponse } from './types';
import { githubFetch } from './client';

function mapToRepoInfo(raw: GitHubRepoResponse): RepoInfo {
  return {
    owner: raw.full_name.split('/')[0],
    repo: raw.name,
    defaultBranch: raw.default_branch,
    description: raw.description || '',
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    license: raw.license?.spdx_id || null,
    language: raw.language,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    topics: raw.topics || [],
    archived: raw.archived,
    size: raw.size,
  };
}

export async function fetchOrgRepos(
  org: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<RepoInfo[]> {
  const allRaw: GitHubRepoResponse[] = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const batch = await githubFetch<GitHubRepoResponse[]>(
      `/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=updated&page=${page}`,
      token,
      onRateLimit,
    );
    allRaw.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return allRaw.map(mapToRepoInfo);
}

export async function fetchUserRepos(
  username: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<RepoInfo[]> {
  const allRaw: GitHubRepoResponse[] = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const batch = await githubFetch<GitHubRepoResponse[]>(
      `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner&page=${page}`,
      token,
      onRateLimit,
    );
    allRaw.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return allRaw.map(mapToRepoInfo);
}

export async function fetchMyRepos(
  token: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<RepoInfo[]> {
  // Fetch all repos the token can access — works with both classic and fine-grained tokens.
  // Paginate to get everything (GitHub caps at 100 per page).
  const allRaw: GitHubRepoResponse[] = [];
  let page = 1;
  const maxPages = 5; // Cap at 500 repos

  while (page <= maxPages) {
    const batch = await githubFetch<GitHubRepoResponse[]>(
      `/user/repos?per_page=100&sort=updated&page=${page}`,
      token,
      onRateLimit,
    );
    allRaw.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  // Discover orgs from returned repos and backfill full org listings
  const orgs = new Set<string>();
  for (const r of allRaw) {
    if (r.owner.type === 'Organization') {
      orgs.add(r.owner.login);
    }
  }

  if (orgs.size > 0) {
    const orgResults = await Promise.all(
      [...orgs].map(async (org) => {
        const orgRaw: GitHubRepoResponse[] = [];
        let orgPage = 1;
        try {
          while (orgPage <= 10) {
            const batch = await githubFetch<GitHubRepoResponse[]>(
              `/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=updated&page=${orgPage}`,
              token,
              onRateLimit,
            );
            orgRaw.push(...batch);
            if (batch.length < 100) break;
            orgPage++;
          }
        } catch {
          // Ignore errors for individual orgs
        }
        return orgRaw;
      }),
    );
    allRaw.push(...orgResults.flat());
  }

  // Deduplicate by full_name
  const seen = new Set<string>();
  const unique: GitHubRepoResponse[] = [];
  for (const r of allRaw) {
    if (!seen.has(r.full_name)) {
      seen.add(r.full_name);
      unique.push(r);
    }
  }

  return unique.map(mapToRepoInfo);
}
