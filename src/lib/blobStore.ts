'use client';
/**
 * Minimal IndexedDB key/value store for original uploaded files (too big for localStorage).
 *
 * Rename migration (M5): files saved under the app's former name live in the legacy database. A
 * read that misses in `penprint-files` falls back to it, copies the file across and deletes the old
 * entry, so old analyses keep their Word view; deletes clear both databases. The legacy database is
 * only opened when it exists (indexedDB.databases()), so new users never create it.
 */
const DB = 'penprint-files';
const LEGACY_DB = 'kulmus-files';
const STORE = 'files';

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, name = DB): Promise<T> {
  const db = await open(name);
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    if (name !== DB) db.close();
  }
}

async function legacyExists(): Promise<boolean> {
  try {
    if (!indexedDB.databases) return true; // cannot tell; opening an empty DB is harmless
    return (await indexedDB.databases()).some((d) => d.name === LEGACY_DB);
  } catch {
    return false;
  }
}

export async function putFile(key: string, data: ArrayBuffer): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(data, key));
  } catch {}
}
export async function getFile(key: string): Promise<ArrayBuffer | undefined> {
  try {
    const hit = await tx<ArrayBuffer | undefined>('readonly', (s) => s.get(key));
    if (hit || !(await legacyExists())) return hit;
    const old = await tx<ArrayBuffer | undefined>('readonly', (s) => s.get(key), LEGACY_DB);
    if (old) {
      await putFile(key, old);
      await tx('readwrite', (s) => s.delete(key), LEGACY_DB).catch(() => {});
    }
    return old;
  } catch {
    return undefined;
  }
}
export async function deleteFile(key: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(key));
    if (await legacyExists()) await tx('readwrite', (s) => s.delete(key), LEGACY_DB);
  } catch {}
}
