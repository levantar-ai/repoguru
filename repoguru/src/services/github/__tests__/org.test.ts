import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOrgRepos, fetchUserRepos } from '../org';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    json: async () => body,
    headers: {
      get: (name: string) =>
        ({
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1700000000',
        })[name.toLowerCase()] ?? null,
    },
  } as unknown as Response;
}

function makeRepo(name: string, i: number) {
  return {
    name,
    full_name: `testorg/${name}`,
    default_branch: 'main',
    description: null,
    stargazers_count: i,
    forks_count: 0,
    open_issues_count: 0,
    license: null,
    language: 'TypeScript',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    topics: [],
    archived: false,
    size: 100,
    owner: { login: 'testorg', type: 'Organization' },
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchOrgRepos', () => {
  it('returns repos from a single page', async () => {
    const repos = Array.from({ length: 5 }, (_, i) => makeRepo(`repo-${i}`, i));
    mockFetch.mockResolvedValueOnce(mockResponse(repos));

    const result = await fetchOrgRepos('testorg');
    expect(result).toHaveLength(5);
    expect(result[0].repo).toBe('repo-0');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('paginates when first page is full (100 items)', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeRepo(`repo-${i}`, i));
    const page2 = Array.from({ length: 30 }, (_, i) => makeRepo(`repo-${100 + i}`, i));

    mockFetch.mockResolvedValueOnce(mockResponse(page1)).mockResolvedValueOnce(mockResponse(page2));

    const result = await fetchOrgRepos('testorg');
    expect(result).toHaveLength(130);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain('page=1');
    expect(mockFetch.mock.calls[1][0]).toContain('page=2');
  });

  it('stops paginating when a page returns empty', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeRepo(`repo-${i}`, i));
    mockFetch.mockResolvedValueOnce(mockResponse(page1)).mockResolvedValueOnce(mockResponse([]));

    const result = await fetchOrgRepos('testorg');
    expect(result).toHaveLength(100);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('fetchUserRepos', () => {
  it('returns repos from a single page', async () => {
    const repos = Array.from({ length: 10 }, (_, i) => makeRepo(`repo-${i}`, i));
    mockFetch.mockResolvedValueOnce(mockResponse(repos));

    const result = await fetchUserRepos('testuser');
    expect(result).toHaveLength(10);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('paginates when first page is full (100 items)', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeRepo(`repo-${i}`, i));
    const page2 = Array.from({ length: 50 }, (_, i) => makeRepo(`repo-${100 + i}`, i));

    mockFetch.mockResolvedValueOnce(mockResponse(page1)).mockResolvedValueOnce(mockResponse(page2));

    const result = await fetchUserRepos('testuser');
    expect(result).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('page=2');
  });
});
