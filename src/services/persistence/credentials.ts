/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb } from './db';
import { STORE_SETTINGS } from '../../utils/constants';

const CREDENTIAL_ID = 'reporev-github-token';
const IDB_KEY = 'github-token';

// ── Credential Management API (Chrome, Edge) ──

function isCredentialApiSupported(): boolean {
  return typeof window !== 'undefined'
    && 'credentials' in navigator
    && 'PasswordCredential' in window;
}

async function saveWithCredentialApi(token: string): Promise<boolean> {
  if (!isCredentialApiSupported()) return false;
  try {
    const PC = (window as any).PasswordCredential;
    const cred = new PC({ id: CREDENTIAL_ID, password: token });
    await navigator.credentials.store(cred);
    return true;
  } catch {
    return false;
  }
}

async function loadWithCredentialApi(): Promise<string | null> {
  if (!isCredentialApiSupported()) return null;
  try {
    const cred = await navigator.credentials.get({
      password: true,
      mediation: 'silent',
    } as any);
    if (cred && 'password' in cred) {
      return (cred as any).password as string || null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── IndexedDB fallback (all browsers) ──

async function saveWithIdb(token: string): Promise<boolean> {
  try {
    const db = await getDb();
    await db.put(STORE_SETTINGS, token, IDB_KEY);
    return true;
  } catch {
    return false;
  }
}

async function loadWithIdb(): Promise<string | null> {
  try {
    const db = await getDb();
    const val = await db.get(STORE_SETTINGS, IDB_KEY);
    return typeof val === 'string' ? val : null;
  } catch {
    return null;
  }
}

async function clearWithIdb(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_SETTINGS, IDB_KEY);
  } catch {
    // Best-effort
  }
}

// ── Public API: try Credential API first, fall back to IndexedDB ──

export async function saveGithubToken(token: string): Promise<boolean> {
  const saved = await saveWithCredentialApi(token);
  // Always save to IDB as well so it works across browsers
  await saveWithIdb(token);
  return saved || true;
}

export async function loadGithubToken(): Promise<string | null> {
  const fromCred = await loadWithCredentialApi();
  if (fromCred) return fromCred;
  return loadWithIdb();
}

export async function clearGithubToken(): Promise<void> {
  if (isCredentialApiSupported()) {
    try {
      await navigator.credentials.preventSilentAccess();
    } catch {
      // Best-effort
    }
  }
  await clearWithIdb();
}
