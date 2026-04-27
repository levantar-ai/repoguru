import type { RateLimitInfo } from '../../types';
import type {
  GitHubCommitResponse,
  GitHubCommitDetailResponse,
  GitHubContributorStats,
  GitHubCodeFrequency,
  GitHubCommitActivity,
  GitHubParticipation,
  GitHubPunchCard,
  GitHubLanguages,
  GitStatsRawData,
} from '../../types/gitStats';
import { GITHUB_API_BASE } from '../../utils/constants';
import { extractRateLimit } from './client';

// ── Helpers ──

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Fetch with retry for 202 (stats computing) responses ──

async function fetchWithRetry<T>(
  path: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
  maxRetries = 5,
): Promise<T | null> {
  const headers = authHeaders(token);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${GITHUB_API_BASE}${path}`, { headers });
    const rateLimit = extractRateLimit(res.headers);
    if (onRateLimit) onRateLimit(rateLimit);

    if (res.status === 200) {
      return res.json();
    }

    if (res.status === 202) {
      // GitHub is computing the stats; retry with exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
      continue;
    }

    if (res.status === 204 || res.status === 404) {
      return null;
    }

    if (res.status === 403 && rateLimit.remaining === 0) {
      throw new Error('GitHub API rate limit exceeded. Add a token in Settings for 5,000 req/hr.');
    }

    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  // Exhausted retries
  return null;
}

// ── Helpers for response handling ──

function emitRateLimit(res: Response, onRateLimit?: (info: RateLimitInfo) => void): RateLimitInfo {
  const rateLimit = extractRateLimit(res.headers);
  if (onRateLimit) onRateLimit(rateLimit);
  return rateLimit;
}

function throwIfRateLimited(res: Response, rateLimit: RateLimitInfo): void {
  if (res.status === 403 && rateLimit.remaining === 0) {
    throw new Error('GitHub API rate limit exceeded.');
  }
}

function repoPrefix(owner: string, repo: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

// ── Fetch paginated commit list (up to 1000) ──

export async function fetchCommitList(
  owner: string,
  repo: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
  onProgress?: (fetched: number) => void,
): Promise<GitHubCommitResponse[]> {
  const headers = authHeaders(token);
  const allCommits: GitHubCommitResponse[] = [];
  const maxPages = 10;
  const perPage = 100;
  const prefix = repoPrefix(owner, repo);

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `${GITHUB_API_BASE}${prefix}/commits?per_page=${perPage}&page=${page}`,
      { headers },
    );

    const rateLimit = emitRateLimit(res, onRateLimit);

    if (!res.ok) {
      throwIfRateLimited(res, rateLimit);
      if (res.status === 409) return []; // Empty repository
      throw new Error(`Failed to fetch commits: ${res.status} ${res.statusText}`);
    }

    const commits: GitHubCommitResponse[] = await res.json();
    allCommits.push(...commits);

    if (onProgress) onProgress(allCommits.length);

    if (commits.length < perPage) break;
    if (page < maxPages) await sleep(100);
  }

  return allCommits;
}

// ── Fetch individual commit details (sampled) ──

export async function fetchCommitDetails(
  owner: string,
  repo: string,
  shas: string[],
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
  onProgress?: (fetched: number) => void,
): Promise<GitHubCommitDetailResponse[]> {
  const headers = authHeaders(token);

  // Limit to 200, sampling evenly from the full list
  const maxDetails = 200;
  let sampled: string[];

  if (shas.length <= maxDetails) {
    sampled = shas;
  } else {
    sampled = [];
    const step = shas.length / maxDetails;
    for (let i = 0; i < maxDetails; i++) {
      sampled.push(shas[Math.floor(i * step)]);
    }
  }

  const details: GitHubCommitDetailResponse[] = [];
  const prefix = repoPrefix(owner, repo);

  for (let i = 0; i < sampled.length; i++) {
    const sha = sampled[i];
    const res = await fetch(`${GITHUB_API_BASE}${prefix}/commits/${sha}`, { headers });

    const rateLimit = emitRateLimit(res, onRateLimit);

    if (res.ok) {
      const detail: GitHubCommitDetailResponse = await res.json();
      details.push(detail);
    } else {
      throwIfRateLimited(res, rateLimit);
    }
    // Skip individual failures silently

    if (onProgress) onProgress(details.length);

    if (i < sampled.length - 1) await sleep(100);
  }

  return details;
}

// ── Fetch all stats endpoints in parallel ──

export async function fetchAllStats(
  owner: string,
  repo: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<{
  contributorStats: GitHubContributorStats[] | null;
  codeFrequency: GitHubCodeFrequency[] | null;
  commitActivity: GitHubCommitActivity[] | null;
  participation: GitHubParticipation | null;
  punchCard: GitHubPunchCard[] | null;
  languages: GitHubLanguages | null;
}> {
  const prefix = repoPrefix(owner, repo);

  const [contributorStats, codeFrequency, commitActivity, participation, punchCard, languages] =
    await Promise.all([
      fetchWithRetry<GitHubContributorStats[]>(`${prefix}/stats/contributors`, token, onRateLimit),
      fetchWithRetry<GitHubCodeFrequency[]>(`${prefix}/stats/code_frequency`, token, onRateLimit),
      fetchWithRetry<GitHubCommitActivity[]>(`${prefix}/stats/commit_activity`, token, onRateLimit),
      fetchWithRetry<GitHubParticipation>(`${prefix}/stats/participation`, token, onRateLimit),
      fetchWithRetry<GitHubPunchCard[]>(`${prefix}/stats/punch_card`, token, onRateLimit),
      fetchWithRetry<GitHubLanguages>(`${prefix}/languages`, token, onRateLimit),
    ]);

  return {
    contributorStats,
    codeFrequency,
    commitActivity,
    participation,
    punchCard,
    languages,
  };
}

// ── Full pipeline: fetch everything ──

export async function fetchGitStatsData(
  owner: string,
  repo: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
  onCommitProgress?: (fetched: number) => void,
  onDetailProgress?: (fetched: number) => void,
  onStatsStart?: () => void,
): Promise<GitStatsRawData> {
  // 1. Fetch commit list
  const commits = await fetchCommitList(owner, repo, token, onRateLimit, onCommitProgress);

  // 2. Fetch commit details (skip if no token — too many API calls)
  let commitDetails: GitHubCommitDetailResponse[] = [];
  if (token && commits.length > 0) {
    const shas = commits.map((c) => c.sha);
    commitDetails = await fetchCommitDetails(
      owner,
      repo,
      shas,
      token,
      onRateLimit,
      onDetailProgress,
    );
  }

  // 3. Fetch stats endpoints
  if (onStatsStart) onStatsStart();
  const stats = await fetchAllStats(owner, repo, token, onRateLimit);

  return {
    commits,
    commitDetails,
    ...stats,
  };
}
