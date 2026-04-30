import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { githubFetch, GitHubApiError } from '../client';

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'Not Found' : 'OK',
    headers: new Headers(headers),
    json: async () => body,
  } as Response;
}

const RATE_HEADERS = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4999',
  'x-ratelimit-reset': '0',
  'x-ratelimit-used': '1',
};

describe('githubFetch — 404 messaging', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('unauth 404 → "if it\'s private, connect to GitHub" copy', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse(null, 404, RATE_HEADERS));
    let captured: Error | undefined;
    try { await githubFetch('/repos/x/y'); } catch (e) { captured = e as Error; }
    expect(captured).toBeInstanceOf(GitHubApiError);
    expect((captured as GitHubApiError).status).toBe(404);
    expect(captured!.message).toMatch(/private.*connect to GitHub/i);
  });

  it('authed 404 → "token may not have access" copy (does NOT tell user to make it public)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse(null, 404, RATE_HEADERS));
    let captured: Error | undefined;
    try {
      await githubFetch('/repos/x/y', 'ghp_token');
    } catch (e) {
      captured = e as Error;
    }
    expect(captured).toBeInstanceOf(GitHubApiError);
    expect(captured!.message).toMatch(/token may not have access|org SAML|fine-grained PAT/i);
    // Regression guard: the old "make it public" copy must never appear under auth.
    expect(captured!.message).not.toMatch(/ensure it is public/i);
  });
});
