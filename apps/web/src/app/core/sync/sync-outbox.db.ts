import { SyncOutboxItem } from './sync-queue.model';

const DB_NAME = 'villa-os-sync';
const DB_VERSION = 1;
const STORE_NAME = 'sync-outbox';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = action(tx.objectStore(STORE_NAME));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const syncOutboxDb = {
  getAll(): Promise<SyncOutboxItem[]> {
    return runTransaction('readonly', (store) => store.getAll());
  },

  put(item: SyncOutboxItem): Promise<void> {
    return runTransaction('readwrite', (store) => store.put(item)).then(() => undefined);
  },

  delete(id: string): Promise<void> {
    return runTransaction('readwrite', (store) => store.delete(id)).then(() => undefined);
  },
};
