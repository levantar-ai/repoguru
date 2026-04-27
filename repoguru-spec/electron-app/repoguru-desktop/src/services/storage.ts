const RECENT_REPOS_KEY = 'repoguru:recent-repos';
const MAX_RECENT = 20;

export interface RecentRepo {
  path: string;
  name: string;
  lastOpened: string; // ISO 8601
}

export function getRecentRepos(): RecentRepo[] {
  try {
    const raw = localStorage.getItem(RECENT_REPOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentRepo(path: string): void {
  const repos = getRecentRepos().filter((r) => r.path !== path);
  const name = path.split('/').pop() || path;
  repos.unshift({ path, name, lastOpened: new Date().toISOString() });
  if (repos.length > MAX_RECENT) repos.length = MAX_RECENT;
  localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos));
}

export function removeRecentRepo(path: string): void {
  const repos = getRecentRepos().filter((r) => r.path !== path);
  localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos));
}
