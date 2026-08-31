import type { AtlasFrame, BuiltAtlas } from './atlasBuilder';

const DB_NAME = 'puzzle-adventure-atlas-v2';
const STORE = 'atlases';
const memory = new Map<string, BuiltAtlas>();

interface CachedRecord {
  key: string;
  frames: AtlasFrame[];
  pngs: Blob[];
}

export function rememberAtlas(atlas: BuiltAtlas) {
  memory.set(atlas.cacheKey, atlas);
}

export function getMemoryAtlas(key: string): BuiltAtlas | undefined {
  return memory.get(key);
}

export async function loadCachedAtlas(key: string): Promise<BuiltAtlas | null> {
  const mem = memory.get(key);
  if (mem) return mem;
  if (import.meta.env.DEV) return null;
  const record = await idbGet(key);
  if (!record) return null;
  const canvases: HTMLCanvasElement[] = [];
  for (const blob of record.pngs) {
    const bitmap = await blobToImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    canvases.push(canvas);
  }
  const atlas: BuiltAtlas = { cacheKey: key, canvases, frames: record.frames };
  memory.set(key, atlas);
  return atlas;
}

export function persistAtlas(atlas: BuiltAtlas) {
  if (import.meta.env.DEV) return;
  void idbPut(atlas).catch((err) => console.warn('Atlas cache write failed', err));
}

async function idbPut(atlas: BuiltAtlas) {
  const pngs = await Promise.all(atlas.canvases.map(canvasToPng));
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put({ key: atlas.cacheKey, frames: atlas.frames, pngs } satisfies CachedRecord);
  });
}

async function idbGet(key: string): Promise<CachedRecord | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as CachedRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}
