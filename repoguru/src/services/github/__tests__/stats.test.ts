import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCommitList, fetchCommitDetails, fetchAllStats, fetchGitStatsData } from '../stats';

// ── Mock fetch globally ──

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Helper to build a mock Response ──

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const defaultHeaders: Record<string, string> = {
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '4999',
    'x-ratelimit-reset': '1700000000',
    ...headers,
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    json: async () => body,
    headers: {
      get: (name: string) => defaultHeaders[name.toLowerCase()] ?? null,
    },
  } as unknown as Response;
}

// ── Helper commit factory ──

function makeCommit(sha: string) {
  return {
    sha,
    commit: {
      message: `Commit ${sha}`,
      author: { name: 'Author', email: 'a@b.com', date: '2024-01-01T00:00:00Z' },
      committer: { name: 'Committer', date: '2024-01-01T00:00:00Z' },
    },
    author: { login: 'author', avatar_url: '' },
    committer: { login: 'committer', avatar_url: '' },
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ── fetchCommitList ──

describe('fetchCommitList', () => {
  it('fetches a single page of commits', async () => {
    const commits = [makeCommit('abc123'), makeCommit('def456')];
    mockFetch.mockResolvedValueOnce(mockResponse(commits));

    const result = await fetchCommitList('owner', 'repo', 'token123');

    expect(result).toHaveLength(2);
    expect(result[0].sha).toBe('abc123');
    expect(result[1].sha).toBe('def456');
  });

  it('paginates across multiple pages until a partial page', async () => {
    vi.useFakeTimers();

    // First page: 100 commits (full page)
    const page1 = Array.from({ length: 100 }, (_, i) => makeCommit(`sha-p1-${i}`));
    // Second page: 50 commits (partial page → stop)
    const page2 = Array.from({ length: 50 }, (_, i) => makeCommit(`sha-p2-${i}`));

    mockFetch.mockResolvedValueOnce(mockResponse(page1));
    mockFetch.mockResolvedValueOnce(mockResponse(page2));

    const resultPromise = fetchCommitList('owner', 'repo', 'token');

    // Advance timers to flush sleep(100) between pages
    await vi.advanceTimersByTimeAsync(200);

    const result = await resultPromise;

    expect(result).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('returns empty array for 409 (empty repo)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, 409));

    const result = await fetchCommitList('owner', 'repo', 'token');
    expect(result).toEqual([]);
  });

  it('throws on rate limit exceeded (403 with remaining=0)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, 403, { 'x-ratelimit-remaining': '0' }));

    await expect(fetchCommitList('owner', 'repo', 'token')).rejects.toThrow('rate limit exceeded');
  });

  it('throws on generic API error', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, 500));

    await expect(fetchCommitList('owner', 'repo', 'token')).rejects.toThrow(
      'Failed to fetch commits',
    );
  });

  it('calls onProgress callback with fetched count', async () => {
    const commits = [makeCommit('abc')];
    mockFetch.mockResolvedValueOnce(mockResponse(commits));
    const onProgress = vi.fn();

    await fetchCommitList('owner', 'repo', 'token', undefined, onProgress);

    expect(onProgress).toHaveBeenCalledWith(1);
  });

  it('calls onRateLimit callback with rate limit info', async () => {
    const commits = [makeCommit('abc')];
    mockFetch.mockResolvedValueOnce(mockResponse(commits));
    const onRateLimit = vi.fn();

    await fetchCommitList('owner', 'repo', 'token', onRateLimit);

    expect(onRateLimit).toHaveBeenCalledTimes(1);
    expect(onRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ remaining: expect.any(Number) }),
    );
  });

  it('works without a token', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    const result = await fetchCommitList('owner', 'repo');
    expect(result).toEqual([]);
    // Should not include Authorization header
    const calledHeaders = mockFetch.mock.calls[0][1]?.headers;
    expect(calledHeaders).not.toHaveProperty('Authorization');
  });
});

// ── fetchCommitDetails ──

describe('fetchCommitDetails', () => {
  it('fetches details for provided SHAs', async () => {
    const detail = {
      sha: 'abc',
      commit: {
        message: 'msg',
        author: { name: 'A', email: 'a@b.com', date: '2024-01-01T00:00:00Z' },
        committer: { name: 'C', date: '2024-01-01T00:00:00Z' },
      },
      stats: { additions: 10, deletions: 5, total: 15 },
      files: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(detail));

    const result = await fetchCommitDetails('owner', 'repo', ['abc'], 'token');

    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe('abc');
  });

  it('samples SHAs when list exceeds 200', async () => {
    vi.useFakeTimers();

    const shas = Array.from({ length: 300 }, (_, i) => `sha-${i}`);
    // Mock all 200 fetches
    for (let i = 0; i < 200; i++) {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          sha: `sha-${i}`,
          commit: {
            message: `msg-${i}`,
            author: { name: 'A', email: 'a@b.com', date: '2024-01-01T00:00:00Z' },
            committer: { name: 'C', date: '2024-01-01T00:00:00Z' },
          },
          stats: { additions: 1, deletions: 0, total: 1 },
          files: [],
        }),
      );
    }

    const resultPromise = fetchCommitDetails('owner', 'repo', shas, 'token');

    // Advance timers to flush all the sleep(100) calls between fetches
    for (let i = 0; i < 200; i++) {
      await vi.advanceTimersByTimeAsync(100);
    }

    const result = await resultPromise;

    // Should have made exactly 200 requests (sampled)
    expect(mockFetch).toHaveBeenCalledTimes(200);
    expect(result).toHaveLength(200);

    vi.useRealTimers();
  });

  it('skips failed individual detail fetches silently', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, 404));

    const result = await fetchCommitDetails('owner', 'repo', ['bad-sha'], 'token');
    expect(result).toEqual([]);
  });

  it('throws on rate limit in detail fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, 403, { 'x-ratelimit-remaining': '0' }));

    await expect(fetchCommitDetails('owner', 'repo', ['sha1'], 'token')).rejects.toThrow(
      'rate limit exceeded',
    );
  });

  it('calls onProgress callback', async () => {
    const detail = {
      sha: 'abc',
      commit: {
        message: 'msg',
        author: { name: 'A', email: 'a@b.com', date: '2024-01-01T00:00:00Z' },
        committer: { name: 'C', date: '2024-01-01T00:00:00Z' },
      },
      stats: { additions: 0, deletions: 0, total: 0 },
      files: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(detail));
    const onProgress = vi.fn();

    await fetchCommitDetails('owner', 'repo', ['abc'], 'token', undefined, onProgress);
    expect(onProgress).toHaveBeenCalledWith(1);
  });
});

// ── fetchAllStats ──

describe('fetchAllStats', () => {
  it('fetches all 6 stats endpoints in parallel', async () => {
    mockFetch.mockResolvedValue(mockResponse([]));

    const result = await fetchAllStats('owner', 'repo', 'token');

    expect(mockFetch).toHaveBeenCalledTimes(6);
    expect(result).toHaveProperty('contributorStats');
    expect(result).toHaveProperty('codeFrequency');
    expect(result).toHaveProperty('commitActivity');
    expect(result).toHaveProperty('participation');
    expect(result).toHaveProperty('punchCard');
    expect(result).toHaveProperty('languages');
  });

  it('returns null for 204/404 responses', async () => {
    mockFetch.mockResolvedValue(mockResponse(null, 204));

    const result = await fetchAllStats('owner', 'repo', 'token');

    expect(result.contributorStats).toBeNull();
    expect(result.codeFrequency).toBeNull();
    expect(result.languages).toBeNull();
  });
});

// ── fetchGitStatsData ──

describe('fetchGitStatsData', () => {
  it('fetches commits, skips details without token, and fetches stats', async () => {
    const commits = [makeCommit('abc')];
    // fetchCommitList call
    mockFetch.mockResolvedValueOnce(mockResponse(commits));
    // fetchAllStats (6 calls)
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(mockResponse(null, 204));
    }

    const result = await fetchGitStatsData('owner', 'repo');

    expect(result.commits).toHaveLength(1);
    // No token → commitDetails should be empty
    expect(result.commitDetails).toEqual([]);
  });

  it('fetches commit details when token is provided', async () => {
    const commits = [makeCommit('abc')];
    // fetchCommitList
    mockFetch.mockResolvedValueOnce(mockResponse(commits));
    // fetchCommitDetails (1 sha)
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        sha: 'abc',
        commit: {
          message: 'msg',
          author: { name: 'A', email: 'a@b.com', date: '2024-01-01T00:00:00Z' },
          committer: { name: 'C', date: '2024-01-01T00:00:00Z' },
        },
        stats: { additions: 1, deletions: 0, total: 1 },
        files: [],
      }),
    );
    // fetchAllStats (6 calls)
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(mockResponse(null, 204));
    }

    const result = await fetchGitStatsData('owner', 'repo', 'token123');

    expect(result.commitDetails).toHaveLength(1);
    expect(result.commitDetails[0].sha).toBe('abc');
  });

  it('calls onStatsStart callback before fetching stats', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(mockResponse(null, 204));
    }
    const onStatsStart = vi.fn();

    await fetchGitStatsData(
      'owner',
      'repo',
      undefined,
      undefined,
      undefined,
      undefined,
      onStatsStart,
    );

    expect(onStatsStart).toHaveBeenCalledTimes(1);
  });

  it('skips commit details when commits list is empty even with token', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(mockResponse(null, 204));
    }

    const result = await fetchGitStatsData('owner', 'repo', 'token123');

    expect(result.commitDetails).toEqual([]);
    // 1 (commit list) + 6 (stats) = 7 total calls (no detail calls)
    expect(mockFetch).toHaveBeenCalledTimes(7);
  });
});
