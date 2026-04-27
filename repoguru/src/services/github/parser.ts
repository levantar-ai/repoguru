import type { ParsedRepo } from '../../types';

const GITHUB_URL_PATTERNS = [
  // https://github.com/owner/repo
  /^https?:\/\/github\.com\/([^/]+)\/([^/\s#?]+)(?:\/tree\/([^/\s#?]+))?/,
  // github.com/owner/repo (no protocol)
  /^github\.com\/([^/]+)\/([^/\s#?]+)(?:\/tree\/([^/\s#?]+))?/,
  // owner/repo shorthand
  /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/,
];

export function parseRepoUrl(input: string): ParsedRepo | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  for (const pattern of GITHUB_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const [, owner, rawRepo, branch] = match;
      const repo = rawRepo.replace(/\.git$/, '');
      return { owner, repo, branch: branch || undefined };
    }
  }

  return null;
}
