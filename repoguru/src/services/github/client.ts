import type { RateLimitInfo } from '../../types';
import { GITHUB_API_BASE } from '../../utils/constants';
import { clearGithubToken } from '../persistence/credentials';

export class GitHubApiError extends Error {
  status: number;
  rateLimitInfo?: RateLimitInfo;

  constructor(message: string, status: number, rateLimitInfo?: RateLimitInfo) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.rateLimitInfo = rateLimitInfo;
  }
}

export function extractRateLimit(headers: Headers): RateLimitInfo {
  return {
    limit: parseInt(headers.get('x-ratelimit-limit') || '60', 10),
    remaining: parseInt(headers.get('x-ratelimit-remaining') || '0', 10),
    reset: parseInt(headers.get('x-ratelimit-reset') || '0', 10),
    used: parseInt(headers.get('x-ratelimit-used') || '0', 10),
  };
}

export async function githubFetch<T>(
  path: string,
  token?: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${GITHUB_API_BASE}${path}`, { headers });
  const rateLimit = extractRateLimit(res.headers);

  if (onRateLimit) {
    onRateLimit(rateLimit);
  }

  if (!res.ok) {
    if (res.status === 403 && rateLimit.remaining === 0) {
      const resetDate = new Date(rateLimit.reset * 1000);
      throw new GitHubApiError(
        `GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}.`,
        403,
        rateLimit,
      );
    }
    if (res.status === 401) {
      // Token expired or revoked — clear it so the user can re-authenticate
      clearGithubToken().catch(() => {});
      throw new GitHubApiError(
        'Your GitHub token has expired or been revoked. Please reconnect in Settings.',
        401,
        rateLimit,
      );
    }
    if (res.status === 404) {
      // GitHub returns 404 in two distinct cases:
      //   (a) the resource genuinely doesn't exist
      //   (b) it exists but the caller can't see it
      // For unauth callers (b) is "private repo, sign in." For authed
      // callers (b) is "your token lacks access" — org SAML not granted,
      // a fine-grained PAT that omitted this repo, etc. The previous
      // single message ("make it public") was actively misleading for
      // signed-in users hitting a permission-shaped 404.
      throw new GitHubApiError(
        token
          ? "Repository not found. It may not exist, or your GitHub token may not have access (e.g. org SAML not authorised, or the repo isn't in your fine-grained PAT's selection). Manage access in Settings."
          : 'Repository not found. Check the URL — if it’s private, connect to GitHub in Settings.',
        404,
        rateLimit,
      );
    }
    throw new GitHubApiError(
      `GitHub API error: ${res.status} ${res.statusText}`,
      res.status,
      rateLimit,
    );
  }

  return res.json();
}
