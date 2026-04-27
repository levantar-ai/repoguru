import type { AnalysisReport, RecentRepo } from '../../types';
import { getDb } from './db';
import { STORE_REPORTS, STORE_RECENT } from '../../utils/constants';

export async function saveReport(report: AnalysisReport): Promise<void> {
  const db = await getDb();
  await db.put(STORE_REPORTS, report);
}

export async function loadReport(id: string): Promise<AnalysisReport | undefined> {
  const db = await getDb();
  return db.get(STORE_REPORTS, id);
}

export async function saveRecentRepo(repo: RecentRepo): Promise<void> {
  const db = await getDb();
  const key = `${repo.owner}/${repo.repo}`;
  await db.put(STORE_RECENT, { ...repo, key });

  // Trim to 10 most recent
  const all = await db.getAll(STORE_RECENT);
  const sorted = [...all].sort(
    (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime(),
  );
  for (const old of sorted.slice(10)) {
    await db.delete(STORE_RECENT, old.key);
  }
}

export async function loadRecentRepos(): Promise<RecentRepo[]> {
  const db = await getDb();
  const all = await db.getAll(STORE_RECENT);
  return [...all]
    .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())
    .map(({ key: _key, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
}
