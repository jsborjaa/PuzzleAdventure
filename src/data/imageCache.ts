const DB_NAME = 'puzzle-adventure-images-v1';
const STORE = 'blobs';

export type ImageKind = 'thumb' | 'full';

interface CacheEntry {
  id: string;
  kind: ImageKind;
  blob: Blob;
}

function cacheKey(kind: ImageKind, levelId: string): string {
  return `${kind}:${levelId}`;
}

function isRemote(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbGet(key: string): Promise<CacheEntry | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as CacheEntry | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(key: string, entry: CacheEntry): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function idbKeys(): Promise<string[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map((k) => String(k)));
    req.onerror = () => resolve([]);
  });
}

const objectUrls = new Map<string, string>();

function blobUrl(key: string, blob: Blob): string {
  const existing = objectUrls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Return a display URL. Remote files are cached in IndexedDB; local assets pass through. */
export async function ensureImage(kind: ImageKind, levelId: string, url: string): Promise<string> {
  if (!url || !isRemote(url)) return url;
  const key = cacheKey(kind, levelId);
  const cached = await idbGet(key);
  if (cached) return blobUrl(key, cached.blob);
  const blob = await fetchAsBlob(url);
  if (!blob) return url;
  await idbPut(key, { id: levelId, kind, blob });
  return blobUrl(key, blob);
}

/** Drop cached images that are not in the keep set. Scores and unlocks are not touched. */
export async function retainImages(keepIds: Set<string>): Promise<void> {
  const keys = await idbKeys();
  for (const key of keys) {
    const sep = key.indexOf(':');
    const id = sep >= 0 ? key.slice(sep + 1) : key;
    if (keepIds.has(id)) continue;
    const url = objectUrls.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrls.delete(key);
    }
    await idbDelete(key);
  }
}
