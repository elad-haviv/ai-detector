'use client';
/** Minimal IndexedDB key/value store for original uploaded files (too big for localStorage). */
const DB = 'kulmus-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function putFile(key: string, data: ArrayBuffer): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(data, key));
  } catch {}
}
export async function getFile(key: string): Promise<ArrayBuffer | undefined> {
  try {
    return await tx<ArrayBuffer | undefined>('readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}
export async function deleteFile(key: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(key));
  } catch {}
}
