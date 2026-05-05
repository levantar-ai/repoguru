import { openDB, type IDBPDatabase } from 'idb';
import {
  IDB_NAME,
  IDB_VERSION,
  STORE_REPORTS,
  STORE_RECENT,
  STORE_SETTINGS,
  STORE_CHECKPOINTS,
} from '../../utils/constants';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(IDB_NAME, IDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_REPORTS)) {
          db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_RECENT)) {
          db.createObjectStore(STORE_RECENT, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
          db.createObjectStore(STORE_CHECKPOINTS, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}
