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
    // Pin the callback to the exact origin we're running on so GitHub
    // routes back to *this* page regardless of the registered callback
    // list order on the App. Without this, GitHub uses the first URL in
    // the list — fine for prod, breaks local dev where prod is first.
    redirect_uri: `${window.location.origin}/`,
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

  // CSRF check. Two distinct cases:
  //  1. savedState is null → no in-flight OAuth on this origin. The URL is
  //     stale (reload, bookmark, switched browser tabs, sessionStorage
  //     wiped). Silently drop the params and bail — no error toast, no
  //     scary CSRF message; the user just sees their normal page.
  //  2. savedState is set and the URL state doesn't match → that's a real
  //     mismatch worth shouting about.
  const savedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!savedState) {
    cleanUrl();
    return null;
  }
  if (!state || state !== savedState) {
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
