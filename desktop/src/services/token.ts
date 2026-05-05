/**
 * GitHub token management — uses Electron safeStorage when available,
 * falls back to localStorage in dev/web contexts.
 */

const TOKEN_KEY = 'repoguru:github-token';
const FALLBACK_KEY = 'repoguru:github-token-fallback';

export async function saveToken(token: string): Promise<void> {
  if (window.repoGuru?.secureStore) {
    const result = await window.repoGuru.secureStore(TOKEN_KEY, token);
    if (!result.fallback) {
      localStorage.removeItem(FALLBACK_KEY);
      return;
    }
  }
  localStorage.setItem(FALLBACK_KEY, token);
}

export async function loadToken(): Promise<string> {
  if (window.repoGuru?.secureLoad) {
    const result = await window.repoGuru.secureLoad(TOKEN_KEY);
    if (!result.fallback) return result.value;
  }
  return localStorage.getItem(FALLBACK_KEY) || '';
}

export async function clearToken(): Promise<void> {
  if (window.repoGuru?.secureDelete) {
    await window.repoGuru.secureDelete(TOKEN_KEY);
  }
  localStorage.removeItem(FALLBACK_KEY);
}

export async function hasToken(): Promise<boolean> {
  if (window.repoGuru?.secureHas) {
    const result = await window.repoGuru.secureHas(TOKEN_KEY);
    if (!result.fallback) return result.has;
  }
  return !!localStorage.getItem(FALLBACK_KEY);
}
