import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// oauth.ts reads import.meta.env at module top-level, so for isOAuthAvailable
// we need vi.resetModules() + dynamic import to re-evaluate with different env.
// For startOAuthFlow and handleOAuthCallback we can test the already-imported module
// since they use the module-level constant captured at load time.

describe('oauth', () => {
  const ORIGINAL_LOCATION = window.location.href;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    sessionStorage.clear();
    // Restore location
    Object.defineProperty(window, 'location', {
      value: new URL(ORIGINAL_LOCATION),
      writable: true,
      configurable: true,
    });
  });

  describe('isOAuthAvailable()', () => {
    it('returns false when VITE_GITHUB_CLIENT_ID is unset', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', '');
      vi.resetModules();
      const { isOAuthAvailable } = await import('../oauth');
      expect(isOAuthAvailable()).toBe(false);
    });

    it('returns true when VITE_GITHUB_CLIENT_ID is set', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();
      const { isOAuthAvailable } = await import('../oauth');
      expect(isOAuthAvailable()).toBe(true);
    });
  });

  describe('startOAuthFlow()', () => {
    it('throws when VITE_GITHUB_CLIENT_ID is missing', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', '');
      vi.resetModules();
      const { startOAuthFlow } = await import('../oauth');
      expect(() => startOAuthFlow()).toThrow('VITE_GITHUB_CLIENT_ID is missing');
    });

    it('sets state in sessionStorage and redirects to GitHub authorize URL', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();

      // Mock crypto.randomUUID
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        'test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`,
      );

      // Capture the redirect by mocking location.href setter
      let redirectUrl = '';
      const locationMock = {
        ...window.location,
        get href() {
          return ORIGINAL_LOCATION;
        },
        set href(url: string) {
          redirectUrl = url;
        },
        search: '',
      };
      Object.defineProperty(window, 'location', {
        value: locationMock,
        writable: true,
        configurable: true,
      });

      const { startOAuthFlow } = await import('../oauth');
      startOAuthFlow();

      expect(sessionStorage.getItem('oauth_state')).toBe('test-uuid-1234');
      expect(redirectUrl).toContain('https://github.com/login/oauth/authorize');
    });

    it('includes client_id and state params in redirect URL', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'my-client-id');
      vi.resetModules();

      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        'uuid-abc' as `${string}-${string}-${string}-${string}-${string}`,
      );

      let redirectUrl = '';
      const locationMock = {
        ...window.location,
        get href() {
          return ORIGINAL_LOCATION;
        },
        set href(url: string) {
          redirectUrl = url;
        },
        search: '',
      };
      Object.defineProperty(window, 'location', {
        value: locationMock,
        writable: true,
        configurable: true,
      });

      const { startOAuthFlow } = await import('../oauth');
      startOAuthFlow();

      const url = new URL(redirectUrl);
      expect(url.searchParams.get('client_id')).toBe('my-client-id');
      expect(url.searchParams.get('state')).toBe('uuid-abc');
    });
  });

  describe('handleOAuthCallback()', () => {
    it('returns null when no code param in URL', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();

      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:3000/'),
        writable: true,
        configurable: true,
      });

      const { handleOAuthCallback } = await import('../oauth');
      const result = await handleOAuthCallback();
      expect(result).toBeNull();
    });

    it('throws on state mismatch (CSRF protection) and cleans URL', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();

      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:3000/?code=abc&state=wrong-state'),
        writable: true,
        configurable: true,
      });

      sessionStorage.setItem('oauth_state', 'correct-state');

      const { handleOAuthCallback } = await import('../oauth');
      await expect(handleOAuthCallback()).rejects.toThrow('state mismatch');
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    it('throws when fetch returns non-OK response', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();

      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:3000/?code=abc&state=matching-state'),
        writable: true,
        configurable: true,
      });

      sessionStorage.setItem('oauth_state', 'matching-state');

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'invalid_code' }),
      } as Response);

      const { handleOAuthCallback } = await import('../oauth');
      await expect(handleOAuthCallback()).rejects.toThrow('invalid_code');
    });

    it('throws when response has no access_token', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();

      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:3000/?code=abc&state=matching-state'),
        writable: true,
        configurable: true,
      });

      sessionStorage.setItem('oauth_state', 'matching-state');

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { handleOAuthCallback } = await import('../oauth');
      await expect(handleOAuthCallback()).rejects.toThrow(
        'Failed to exchange OAuth code for token',
      );
    });

    it('returns access_token on success and cleans URL', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();

      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:3000/?code=valid-code&state=good-state'),
        writable: true,
        configurable: true,
      });

      sessionStorage.setItem('oauth_state', 'good-state');

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'gho_abc123' }),
      } as Response);

      const { handleOAuthCallback } = await import('../oauth');
      const token = await handleOAuthCallback();

      expect(token).toBe('gho_abc123');
      expect(window.history.replaceState).toHaveBeenCalled();
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
    });

    it('cleans URL even on fetch error (finally block)', async () => {
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
      vi.resetModules();

      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost:3000/?code=abc&state=matching-state'),
        writable: true,
        configurable: true,
      });

      sessionStorage.setItem('oauth_state', 'matching-state');

      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const { handleOAuthCallback } = await import('../oauth');
      await expect(handleOAuthCallback()).rejects.toThrow('Network error');
      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });
});
