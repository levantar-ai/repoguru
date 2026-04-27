import type { HistoryEntry } from '../../types';

const STORE_KEY = 'repoguru-history';

// Use localStorage for simplicity (IndexedDB upgrade would require version bump)
export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: HistoryEntry): void {
  const history = getHistory();
  history.push(entry);
  // Keep last 500 entries
  if (history.length > 500) history.splice(0, history.length - 500);
  localStorage.setItem(STORE_KEY, JSON.stringify(history));
}

export function getRepoHistory(owner: string, repo: string): HistoryEntry[] {
  return getHistory().filter((e) => e.owner === owner && e.repo === repo);
}

export function clearHistory(): void {
  localStorage.removeItem(STORE_KEY);
}
