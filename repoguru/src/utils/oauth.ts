const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
const GITHUB_APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG as string | undefined;
const CORS_PROXY = (import.meta.env.VITE_CORS_PROXY_URL as string) || 'https://proxy.repo.guru';

const STATE_KEY = 'oauth_state';

/** Redirect the user to GitHub's OAuth authorize page. */
export function startOAuthFlow(): void {
  if (!GITHUB_CLIENT_ID) {
    throw new Error('GitHub OAuth is not configured (VITE_GITHUB_CLIENT_ID is missing).');
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: 'repo read:org',
    state,
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

/** Returns true if VITE_GITHUB_CLIENT_ID is configured. */
export function isOAuthAvailable(): boolean {
  return !!GITHUB_CLIENT_ID;
}

/** Returns true if the current URL is a GitHub App installation callback. */
export function isInstallationCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('setup_action');
}

/**
 * Handle a GitHub App installation callback (?installation_id=&setup_action=&code=).
 * GitHub sends a code when "Request user authorization during installation" is enabled.
 * Returns the access_token on success, null if no code, or throws on error.
 */
export async function handleInstallationCallback(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  // Clean installation params from URL regardless
  try {
    if (!code) return null;

    const res = await fetch(`${CORS_PROXY}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data: { access_token?: string; error?: string } = await res.json();

    if (!res.ok || !data.access_token) {
      throw new Error(data.error || 'Failed to exchange installation code for token.');
    }

    return data.access_token;
  } finally {
    cleanInstallationUrl();
  }
}

/**
 * Check the current URL for a GitHub OAuth callback (?code=&state=).
 * If present, exchange the code for an access token via the CORS proxy worker.
 * Returns the access_token on success, null if no callback params, or throws on error.
 */
export async function handleOAuthCallback(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code) return null;

  // Validate CSRF state
  const savedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!state || state !== savedState) {
    // Clean URL even on error
    cleanUrl();
    throw new Error('OAuth state mismatch — possible CSRF attack. Please try signing in again.');
  }

  try {
    const res = await fetch(`${CORS_PROXY}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data: { access_token?: string; error?: string } = await res.json();

    if (!res.ok || !data.access_token) {
      throw new Error(data.error || 'Failed to exchange OAuth code for token.');
    }

    return data.access_token;
  } finally {
    cleanUrl();
  }
}

/** Returns the URL to manage GitHub App installations (select orgs/repos). */
export function getInstallationManageUrl(): string | null {
  if (!GITHUB_APP_SLUG) return null;
  return `https://github.com/apps/${GITHUB_APP_SLUG}/installations/select_target`;
}

function cleanUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, '', url.pathname + url.search);
}

function cleanInstallationUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('installation_id');
  url.searchParams.delete('setup_action');
  url.searchParams.delete('state');
  window.history.replaceState({}, '', url.pathname + url.search);
}
