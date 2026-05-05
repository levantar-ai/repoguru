import type { AppSettings } from '../../types';
import { getDb } from './db';
import { STORE_SETTINGS } from '../../utils/constants';

const SETTINGS_KEY = 'appSettings';

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put(STORE_SETTINGS, settings, SETTINGS_KEY);
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const db = await getDb();
  return db.get(STORE_SETTINGS, SETTINGS_KEY);
}
