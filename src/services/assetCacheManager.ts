import {
  APP_NATIVE_BASELINE,
  checkContentPackCompatibility,
  classifyContentPack,
  DEFAULT_MAX_ASSET_STORAGE_BYTES,
  diffAssetManifests,
  isValidSha256,
  normalizeAssetPath,
  serializeContentPackDigestInput,
  validateAssetManifest,
  type AssetDeltaDiff,
  type ContentPackDescriptor,
  type ContentPackKind,
  type LocalNativeRuntimeInfo,
  type OtaChannel,
  type VersionedAssetEntry,
  type VersionedAssetManifest,
} from '../game/otaCompatibility.ts';

export const ASSET_CACHE_INDEX_KEY = 'mm-ota-asset-index-v1';
export const ASSET_BLOB_CACHE_NAME = 'mm-region-ota-blobs-v1';
export const ASSET_IDB_DATABASE_NAME = 'mm-region-ota-db-v1';
export const ASSET_IDB_STORE_NAME = 'blobs';

export type StorageBackendKind = 'indexeddb' | 'cache-storage' | 'memory' | 'custom';

export interface StoredAssetGeneration {
  readonly version: string;
  readonly codeVersion: string;
  readonly channel: OtaChannel;
  readonly schemaVersion: number;
  readonly manifestSha256: string;
  readonly activatedAt: string;
  readonly totalBytes: number;
  readonly files: Readonly<Record<string, { readonly sha256: string; readonly bytes: number }>>;
}

export interface StoredContentPackGeneration {
  readonly packId: string;
  readonly name: string;
  readonly kind: ContentPackKind;
  readonly required: boolean;
  readonly version: string;
  readonly sha256: string;
  readonly codeVersion: string;
  readonly channel: OtaChannel;
  readonly schemaVersion: number;
  readonly activatedAt: string;
  readonly totalBytes: number;
  readonly files: Readonly<Record<string, { readonly sha256: string; readonly bytes: number }>>;
}

export interface StoredContentPackState {
  readonly active: StoredContentPackGeneration | null;
  readonly previous: StoredContentPackGeneration | null;
}

export interface ContentPackStatus {
  readonly id: string;
  readonly name: string;
  readonly kind: ContentPackKind;
  readonly required: boolean;
  readonly availableVersion: string | null;
  readonly cachedVersion: string | null;
  readonly previousVersion: string | null;
  readonly totalBytes: number;
  readonly fileCount: number;
  readonly source: 'cached-pack' | 'active-ota' | 'bundled-apk';
  readonly canRollback: boolean;
}

export interface StagedDownloadProgress {
  readonly version: string;
  readonly codeVersion: string;
  readonly channel: OtaChannel;
  readonly manifestSha256: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedPaths: readonly string[];
  readonly verifiedHashes: Readonly<Record<string, { readonly sha256: string; readonly bytes: number }>>;
}

export interface AssetCacheIndexState {
  readonly schemaVersion: number;
  readonly active: StoredAssetGeneration | null;
  readonly previous: StoredAssetGeneration | null;
  readonly staging: StagedDownloadProgress | null;
  readonly packs?: Readonly<Record<string, StoredContentPackState>>;
}

export interface AssetBlobStore {
  get(sha256: string): Promise<Uint8Array | null>;
  has(sha256: string): Promise<boolean>;
  put(sha256: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  delete(sha256: string): Promise<void>;
  list(): Promise<readonly { sha256: string; bytes: number }[]>;
  getBackendKind?(): StorageBackendKind;
}

export interface AssetMetadataStore {
  read(): AssetCacheIndexState;
  write(next: AssetCacheIndexState): void;
}

export interface AssetSyncProgressEvent {
  readonly phase: 'diffing' | 'downloading' | 'verifying' | 'activating' | 'pruning' | 'complete';
  readonly completedFiles: number;
  readonly totalFiles: number;
  readonly downloadedBytes: number;
  readonly totalDownloadBytes: number;
  readonly currentPath?: string;
}

export interface AssetSyncResult {
  readonly version: string;
  readonly reusedFiles: number;
  readonly downloadedFiles: number;
  readonly resumedFiles: number;
  readonly totalBytes: number;
  readonly downloadBytes: number;
  readonly prunedBlobs: number;
  readonly activeGeneration: StoredAssetGeneration;
}

export interface AssetCacheManagerOptions {
  readonly blobStore?: AssetBlobStore;
  readonly metadataStore?: AssetMetadataStore;
  readonly maxStorageBytes?: number;
  readonly fetcher?: (url: string, signal?: AbortSignal) => Promise<Response>;
  readonly hashBytes?: (bytes: Uint8Array) => Promise<string>;
}

const EMPTY_INDEX_STATE: AssetCacheIndexState = {
  schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
  active: null,
  previous: null,
  staging: null,
};

export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto unavailable for SHA-256 verification');
  }
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  const digest = await subtle.digest('SHA-256', view.buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function inferAssetContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.glb')) return 'model/gltf-binary';
  if (lower.endsWith('.opus')) return 'audio/ogg; codecs=opus';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

export class InMemoryAssetBlobStore implements AssetBlobStore {
  private readonly blobs = new Map<string, Uint8Array>();

  async get(sha256: string): Promise<Uint8Array | null> {
    const val = this.blobs.get(sha256.toLowerCase());
    return val ? val.slice() : null;
  }

  async has(sha256: string): Promise<boolean> {
    return this.blobs.has(sha256.toLowerCase());
  }

  async put(sha256: string, bytes: Uint8Array): Promise<void> {
    this.blobs.set(sha256.toLowerCase(), bytes.slice());
  }

  async delete(sha256: string): Promise<void> {
    this.blobs.delete(sha256.toLowerCase());
  }

  async list(): Promise<readonly { sha256: string; bytes: number }[]> {
    return Array.from(this.blobs.entries()).map(([sha256, bytes]) => ({
      sha256,
      bytes: bytes.byteLength,
    }));
  }

  getBackendKind(): StorageBackendKind {
    return 'memory';
  }

  clear(): void {
    this.blobs.clear();
  }
}

export class InMemoryAssetMetadataStore implements AssetMetadataStore {
  private state: AssetCacheIndexState;

  constructor(initial: AssetCacheIndexState = EMPTY_INDEX_STATE) {
    this.state = structuredClone(initial);
  }

  read(): AssetCacheIndexState {
    return structuredClone(this.state);
  }

  write(next: AssetCacheIndexState): void {
    this.state = structuredClone(next);
  }
}

class CacheStorageAssetBlobStore implements AssetBlobStore {
  private readonly memoryFallback = new InMemoryAssetBlobStore();
  private readonly sizeByHash = new Map<string, number>();

  private keyForHash(sha256: string): string {
    return `https://ota-cache.local/blobs/${sha256.toLowerCase()}`;
  }

  private async openCache(): Promise<Cache | null> {
    try {
      if (typeof caches !== 'undefined' && typeof caches.open === 'function') {
        return await caches.open(ASSET_BLOB_CACHE_NAME);
      }
    } catch {
      // Restricted WebView private mode fallback
    }
    return null;
  }

  async get(sha256: string): Promise<Uint8Array | null> {
    const key = sha256.toLowerCase();
    const cache = await this.openCache();
    if (!cache) return this.memoryFallback.get(key);
    const match = await cache.match(this.keyForHash(key));
    if (!match) return null;
    const buffer = await match.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    this.sizeByHash.set(key, bytes.byteLength);
    return bytes;
  }

  async has(sha256: string): Promise<boolean> {
    const key = sha256.toLowerCase();
    const cache = await this.openCache();
    if (!cache) return this.memoryFallback.has(key);
    const match = await cache.match(this.keyForHash(key));
    return Boolean(match);
  }

  async put(sha256: string, bytes: Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
    const key = sha256.toLowerCase();
    const cache = await this.openCache();
    if (!cache) {
      await this.memoryFallback.put(key, bytes);
      return;
    }
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const response = new Response(copy.buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'X-OTA-SHA256': key,
      },
    });
    await cache.put(this.keyForHash(key), response);
    this.sizeByHash.set(key, bytes.byteLength);
  }

  async delete(sha256: string): Promise<void> {
    const key = sha256.toLowerCase();
    const cache = await this.openCache();
    if (!cache) {
      await this.memoryFallback.delete(key);
      return;
    }
    await cache.delete(this.keyForHash(key));
    this.sizeByHash.delete(key);
  }

  async list(): Promise<readonly { sha256: string; bytes: number }[]> {
    const cache = await this.openCache();
    if (!cache) return this.memoryFallback.list();
    const requests = await cache.keys();
    const prefix = 'https://ota-cache.local/blobs/';
    const out: { sha256: string; bytes: number }[] = [];
    for (const req of requests) {
      if (!req.url.startsWith(prefix)) continue;
      const sha256 = req.url.slice(prefix.length).toLowerCase();
      let bytes = this.sizeByHash.get(sha256);
      if (bytes === undefined) {
        const res = await cache.match(req);
        const lenHeader = res?.headers.get('Content-Length');
        bytes = lenHeader ? Number(lenHeader) : res ? (await res.arrayBuffer()).byteLength : 0;
        this.sizeByHash.set(sha256, bytes);
      }
      out.push({ sha256, bytes });
    }
    return out;
  }

  getBackendKind(): StorageBackendKind {
    return typeof caches !== 'undefined' && typeof caches.open === 'function' ? 'cache-storage' : 'memory';
  }
}

interface StoredIdbBlobRecord {
  sha256: string;
  buffer: ArrayBuffer;
  bytes: number;
  contentType: string;
}

export class IndexedDbAssetBlobStore implements AssetBlobStore {
  private readonly dbName: string;
  private readonly storeName: string;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(dbName = ASSET_IDB_DATABASE_NAME, storeName = ASSET_IDB_STORE_NAME) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined' || typeof indexedDB.open !== 'function') {
          resolve(null);
          return;
        }
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'sha256' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  async get(sha256: string): Promise<Uint8Array | null> {
    const db = await this.openDb();
    if (!db) return null;
    const key = sha256.toLowerCase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => {
          const rec = req.result as StoredIdbBlobRecord | undefined;
          if (!rec || !rec.buffer) {
            resolve(null);
            return;
          }
          resolve(new Uint8Array(rec.buffer));
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async has(sha256: string): Promise<boolean> {
    const db = await this.openDb();
    if (!db) return false;
    const key = sha256.toLowerCase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getKey(key);
        req.onsuccess = () => resolve(req.result !== undefined);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async put(sha256: string, bytes: Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
    const db = await this.openDb();
    if (!db) {
      throw new Error('IndexedDB unavailable');
    }
    const key = sha256.toLowerCase();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const record: StoredIdbBlobRecord = {
      sha256: key,
      buffer: copy.buffer,
      bytes: bytes.byteLength,
      contentType,
    };
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async delete(sha256: string): Promise<void> {
    const db = await this.openDb();
    if (!db) return;
    const key = sha256.toLowerCase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async list(): Promise<readonly { sha256: string; bytes: number }[]> {
    const db = await this.openDb();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = Array.isArray(req.result) ? (req.result as StoredIdbBlobRecord[]) : [];
          resolve(rows.map((r) => ({ sha256: r.sha256, bytes: r.bytes })));
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  getBackendKind(): StorageBackendKind {
    return typeof indexedDB !== 'undefined' ? 'indexeddb' : 'memory';
  }
}

/**
 * Primary persistent Android WebView / Desktop blob store: uses IndexedDB for large GLB & map packs
 * and falls back transparently to CacheStorage -> in-memory storage when unavailable.
 */
class AdaptiveWebAssetBlobStore implements AssetBlobStore {
  private readonly idb = new IndexedDbAssetBlobStore();
  private readonly cacheFallback = new CacheStorageAssetBlobStore();
  private idbHealthy: boolean | null = null;

  private async canUseIdb(): Promise<boolean> {
    if (typeof indexedDB === 'undefined') return false;
    if (this.idbHealthy === false) return false;
    try {
      await this.idb.list();
      this.idbHealthy = true;
      return true;
    } catch {
      this.idbHealthy = false;
      return false;
    }
  }

  async get(sha256: string): Promise<Uint8Array | null> {
    if (await this.canUseIdb()) {
      const hit = await this.idb.get(sha256);
      if (hit) return hit;
    }
    return this.cacheFallback.get(sha256);
  }

  async has(sha256: string): Promise<boolean> {
    if (await this.canUseIdb()) {
      if (await this.idb.has(sha256)) return true;
    }
    return this.cacheFallback.has(sha256);
  }

  async put(sha256: string, bytes: Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
    if (await this.canUseIdb()) {
      try {
        await this.idb.put(sha256, bytes, contentType);
        return;
      } catch {
        this.idbHealthy = false;
      }
    }
    await this.cacheFallback.put(sha256, bytes, contentType);
  }

  async delete(sha256: string): Promise<void> {
    if (await this.canUseIdb()) {
      await this.idb.delete(sha256);
    }
    await this.cacheFallback.delete(sha256);
  }

  async list(): Promise<readonly { sha256: string; bytes: number }[]> {
    const merged = new Map<string, number>();
    if (await this.canUseIdb()) {
      for (const item of await this.idb.list()) merged.set(item.sha256, item.bytes);
    }
    for (const item of await this.cacheFallback.list()) {
      if (!merged.has(item.sha256)) merged.set(item.sha256, item.bytes);
    }
    return Array.from(merged.entries()).map(([sha256, bytes]) => ({ sha256, bytes }));
  }

  getBackendKind(): StorageBackendKind {
    if (typeof indexedDB !== 'undefined' && this.idbHealthy !== false) return 'indexeddb';
    return this.cacheFallback.getBackendKind();
  }
}

export async function requestPersistentOfflineStorage(): Promise<{
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}> {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const storage = nav?.storage;
    if (!storage) return { persisted: null, usageBytes: null, quotaBytes: null };
    let persisted: boolean | null = null;
    if (typeof storage.persisted === 'function') {
      persisted = await storage.persisted().catch(() => null);
    }
    if (!persisted && typeof storage.persist === 'function') {
      persisted = await storage.persist().catch(() => persisted);
    }
    const estimate =
      typeof storage.estimate === 'function' ? await storage.estimate().catch(() => null) : null;
    return {
      persisted,
      usageBytes: typeof estimate?.usage === 'number' ? estimate.usage : null,
      quotaBytes: typeof estimate?.quota === 'number' ? estimate.quota : null,
    };
  } catch {
    return { persisted: null, usageBytes: null, quotaBytes: null };
  }
}

class LocalStorageMetadataStore implements AssetMetadataStore {
  private memoryFallback: AssetCacheIndexState = structuredClone(EMPTY_INDEX_STATE);

  read(): AssetCacheIndexState {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(ASSET_CACHE_INDEX_KEY) : null;
      if (!raw) return structuredClone(this.memoryFallback);
      const parsed = JSON.parse(raw) as Partial<AssetCacheIndexState> | null;
      if (!parsed || typeof parsed !== 'object') return structuredClone(EMPTY_INDEX_STATE);
      return {
        schemaVersion:
          typeof parsed.schemaVersion === 'number'
            ? parsed.schemaVersion
            : APP_NATIVE_BASELINE.otaSchemaVersion,
        active: parsed.active ?? null,
        previous: parsed.previous ?? null,
        staging: parsed.staging ?? null,
        ...(parsed.packs ? { packs: parsed.packs } : {}),
      };
    } catch {
      return structuredClone(this.memoryFallback);
    }
  }

  write(next: AssetCacheIndexState): void {
    this.memoryFallback = structuredClone(next);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ASSET_CACHE_INDEX_KEY, JSON.stringify(next));
      }
    } catch {
      // Ignore quota/sandbox errors; memoryFallback preserves session state
    }
  }
}

function collectReferencedHashes(
  gen: { files: Readonly<Record<string, { readonly sha256: string }>> } | null | undefined,
  target: Set<string>,
): void {
  if (!gen) return;
  for (const meta of Object.values(gen.files)) {
    target.add(meta.sha256.toLowerCase());
  }
}

function collectProtectedHashes(
  state: AssetCacheIndexState,
  options?: { includePrevious?: boolean },
): Set<string> {
  const keep = new Set<string>();
  const includePrevious = options?.includePrevious ?? true;
  collectReferencedHashes(state.active, keep);
  if (includePrevious) collectReferencedHashes(state.previous, keep);
  if (state.staging) {
    for (const item of Object.values(state.staging.verifiedHashes)) {
      keep.add(item.sha256.toLowerCase());
    }
  }
  if (state.packs) {
    for (const packState of Object.values(state.packs)) {
      collectReferencedHashes(packState.active, keep);
      if (includePrevious) collectReferencedHashes(packState.previous, keep);
    }
  }
  return keep;
}

export class AssetCacheManager {
  private readonly blobStore: AssetBlobStore;
  private readonly metadataStore: AssetMetadataStore;
  private readonly maxStorageBytes: number;
  private readonly fetcher: (url: string, signal?: AbortSignal) => Promise<Response>;
  private readonly hashBytes: (bytes: Uint8Array) => Promise<string>;
  private syncInFlight: Promise<AssetSyncResult> | null = null;

  constructor(options?: AssetCacheManagerOptions) {
    this.blobStore = options?.blobStore ?? new AdaptiveWebAssetBlobStore();
    this.metadataStore = options?.metadataStore ?? new LocalStorageMetadataStore();
    this.maxStorageBytes = options?.maxStorageBytes ?? DEFAULT_MAX_ASSET_STORAGE_BYTES;
    this.fetcher =
      options?.fetcher ??
      ((url, signal) => fetch(url, { cache: 'no-store', signal }));
    this.hashBytes = options?.hashBytes ?? sha256HexBytes;
  }

  getStorageBackend(): StorageBackendKind {
    return this.blobStore.getBackendKind?.() ?? 'custom';
  }

  getState(): AssetCacheIndexState {
    return this.metadataStore.read();
  }

  getActiveVersion(): string | null {
    return this.metadataStore.read().active?.version ?? null;
  }

  hasOfflineCopy(): boolean {
    // Either a verified active OTA asset generation exists, or the permanent APK builtin assets exist.
    return true;
  }

  isPairingCompatible(expectedCodeVersion: string): boolean {
    const active = this.metadataStore.read().active;
    if (!active) return true;
    return active.codeVersion === expectedCodeVersion;
  }

  async resolveActiveAsset(requestPath: string): Promise<{ bytes: Uint8Array; sha256: string; contentType: string } | null> {
    const cleanPath = normalizeAssetPath(requestPath);
    const state = this.metadataStore.read();
    const active = state.active;
    let bestEntry: { sha256: string; activatedAt: string } | null = null;

    if (active && active.files[cleanPath]) {
      bestEntry = { sha256: active.files[cleanPath].sha256, activatedAt: active.activatedAt };
    }
    if (state.packs) {
      for (const packState of Object.values(state.packs)) {
        const pActive = packState.active;
        const pFile = pActive?.files[cleanPath];
        if (!pActive || !pFile) continue;
        if (!bestEntry || pActive.activatedAt >= bestEntry.activatedAt) {
          bestEntry = { sha256: pFile.sha256, activatedAt: pActive.activatedAt };
        }
      }
    }

    if (!bestEntry) return null;
    const bytes = await this.blobStore.get(bestEntry.sha256);
    if (!bytes) return null;
    return {
      bytes,
      sha256: bestEntry.sha256,
      contentType: inferAssetContentType(cleanPath),
    };
  }

  private async downloadAndVerifyEntries(
    entries: readonly VersionedAssetEntry[],
    baseNormalized: string,
    totalDownloadBytes: number,
    options?: {
      signal?: AbortSignal;
      onProgress?: (event: AssetSyncProgressEvent) => void;
      onVerifiedEntry?: (entry: VersionedAssetEntry) => void;
    },
  ): Promise<{ downloadedBytes: number; downloadedCount: number }> {
    let downloadedBytes = 0;
    let downloadedCount = 0;

    for (const entry of entries) {
      if (options?.signal?.aborted) {
        throw new Error('Asset sync aborted');
      }

      options?.onProgress?.({
        phase: 'downloading',
        completedFiles: downloadedCount,
        totalFiles: entries.length,
        downloadedBytes,
        totalDownloadBytes,
        currentPath: entry.path,
      });

      const downloadUrl = `${baseNormalized}/${entry.path}`;
      const response = await this.fetcher(downloadUrl, options?.signal);
      if (!response.ok) {
        throw new Error(`Failed downloading asset "${entry.path}": HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      options?.onProgress?.({
        phase: 'verifying',
        completedFiles: downloadedCount,
        totalFiles: entries.length,
        downloadedBytes,
        totalDownloadBytes,
        currentPath: entry.path,
      });

      if (bytes.byteLength !== entry.bytes) {
        throw new Error(
          `Asset size mismatch for "${entry.path}": expected ${entry.bytes} bytes, got ${bytes.byteLength}`,
        );
      }

      const actualHash = (await this.hashBytes(bytes)).toLowerCase();
      if (actualHash !== entry.sha256.toLowerCase()) {
        throw new Error(
          `Asset SHA-256 mismatch for "${entry.path}": expected ${entry.sha256}, got ${actualHash}`,
        );
      }

      await this.blobStore.put(entry.sha256, bytes, inferAssetContentType(entry.path));
      downloadedBytes += entry.bytes;
      downloadedCount += 1;
      options?.onVerifiedEntry?.(entry);
    }

    return { downloadedBytes, downloadedCount };
  }

  async computeDelta(manifest: VersionedAssetManifest): Promise<AssetDeltaDiff> {
    const index = this.metadataStore.read();
    const verifiedReusable = new Map<string, { sha256: string; bytes?: number }>();

    // Because AssetBlobStore is strictly content-addressed and only stores SHA-256-verified blobs,
    // checking whether any target hash is already cached handles active, previous, and resumed staging uniformly.
    for (const target of manifest.files) {
      if (await this.blobStore.has(target.sha256)) {
        verifiedReusable.set(target.path, { sha256: target.sha256, bytes: target.bytes });
      }
    }

    const previousPaths = index.active ? Object.keys(index.active.files) : [];
    return diffAssetManifests(manifest, verifiedReusable, previousPaths);
  }

  async syncToManifest(
    rawManifest: unknown,
    options: {
      assetBaseUrl: string;
      codeVersion?: string;
      manifestSha256?: string;
      signal?: AbortSignal;
      onProgress?: (event: AssetSyncProgressEvent) => void;
    },
  ): Promise<AssetSyncResult> {
    if (this.syncInFlight) return this.syncInFlight;

    const run = this.performSync(rawManifest, options).finally(() => {
      if (this.syncInFlight === run) this.syncInFlight = null;
    });
    this.syncInFlight = run;
    return run;
  }

  private async performSync(
    rawManifest: unknown,
    options: {
      assetBaseUrl: string;
      codeVersion?: string;
      manifestSha256?: string;
      signal?: AbortSignal;
      onProgress?: (event: AssetSyncProgressEvent) => void;
    },
  ): Promise<AssetSyncResult> {
    const manifest = validateAssetManifest(rawManifest);
    const codeVersion = options.codeVersion ?? manifest.version;

    if (options.manifestSha256 !== undefined && !isValidSha256(options.manifestSha256)) {
      throw new Error('Expected manifest SHA-256 checksum is invalid');
    }

    if (manifest.totalBytes > this.maxStorageBytes) {
      throw new Error(
        `Manifest size (${manifest.totalBytes} bytes) exceeds storage limit (${this.maxStorageBytes} bytes)`,
      );
    }

    let state = this.metadataStore.read();

    // If active already matches the exact version & codeVersion, verify all blobs are intact before short-circuiting.
    if (
      state.active &&
      state.active.version === manifest.version &&
      state.active.codeVersion === codeVersion &&
      (!options.manifestSha256 ||
        state.active.manifestSha256.toLowerCase() === options.manifestSha256.toLowerCase())
    ) {
      let intact = true;
      for (const file of manifest.files) {
        const cur = state.active.files[file.path];
        if (!cur || cur.sha256 !== file.sha256 || !(await this.blobStore.has(file.sha256))) {
          intact = false;
          break;
        }
      }
      if (intact) {
        return {
          version: manifest.version,
          reusedFiles: manifest.files.length,
          downloadedFiles: 0,
          resumedFiles: 0,
          totalBytes: manifest.totalBytes,
          downloadBytes: 0,
          prunedBlobs: 0,
          activeGeneration: state.active,
        };
      }
    }

    const baseNormalized = options.assetBaseUrl.replace(/\/+$/, '');
    const sameVersionStaging =
      state.staging && state.staging.version === manifest.version ? state.staging : null;

    const resumedFilesCount = sameVersionStaging ? sameVersionStaging.completedPaths.length : 0;

    options.onProgress?.({
      phase: 'diffing',
      completedFiles: 0,
      totalFiles: manifest.files.length,
      downloadedBytes: 0,
      totalDownloadBytes: manifest.totalBytes,
    });

    const diff = await this.computeDelta(manifest);

    // Ensure enough headroom if adding new delta blobs exceeds maxStorageBytes; first evict any stale orphaned blobs.
    await this.enforceStorageHeadroom(diff.downloadBytes, state);

    const verifiedMap: Record<string, { sha256: string; bytes: number }> = {
      ...(sameVersionStaging?.verifiedHashes ?? {}),
    };
    const completedSet = new Set<string>(sameVersionStaging?.completedPaths ?? []);

    for (const reusableEntry of diff.reusable) {
      verifiedMap[reusableEntry.path] = {
        sha256: reusableEntry.sha256,
        bytes: reusableEntry.bytes,
      };
      completedSet.add(reusableEntry.path);
    }

    const writeStagingSnapshot = () => {
      state = {
        ...state,
        staging: {
          version: manifest.version,
          codeVersion,
          channel: manifest.channel,
          manifestSha256: options.manifestSha256 ?? '',
          startedAt: sameVersionStaging?.startedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedPaths: Array.from(completedSet),
          verifiedHashes: verifiedMap,
        },
      };
      this.metadataStore.write(state);
    };

    writeStagingSnapshot();

    const { downloadedBytes, downloadedCount } = await this.downloadAndVerifyEntries(
      diff.toDownload,
      baseNormalized,
      diff.downloadBytes,
      {
        signal: options.signal,
        onProgress: options.onProgress,
        onVerifiedEntry: (entry) => {
          verifiedMap[entry.path] = { sha256: entry.sha256, bytes: entry.bytes };
          completedSet.add(entry.path);
          // Persist after every verified file so interrupted downloads can resume cleanly
          writeStagingSnapshot();
        },
      },
    );

    // Final verification pass over the entire target manifest before atomic swap
    options.onProgress?.({
      phase: 'activating',
      completedFiles: diff.toDownload.length,
      totalFiles: diff.toDownload.length,
      downloadedBytes,
      totalDownloadBytes: diff.downloadBytes,
    });

    const committedFiles: Record<string, { sha256: string; bytes: number }> = {};
    for (const entry of manifest.files) {
      const stagedEntry = verifiedMap[entry.path];
      if (!stagedEntry || stagedEntry.sha256 !== entry.sha256 || !(await this.blobStore.has(entry.sha256))) {
        throw new Error(`Staging incomplete prior to activation: missing ${entry.path}`);
      }
      committedFiles[entry.path] = { sha256: entry.sha256, bytes: entry.bytes };
    }

    const nextGeneration: StoredAssetGeneration = {
      version: manifest.version,
      codeVersion,
      channel: manifest.channel,
      schemaVersion: manifest.schemaVersion,
      manifestSha256: options.manifestSha256 ?? '',
      activatedAt: new Date().toISOString(),
      totalBytes: manifest.totalBytes,
      files: committedFiles,
    };

    const previousCandidate =
      state.active && state.active.version !== nextGeneration.version ? state.active : state.previous;

    state = {
      schemaVersion: manifest.schemaVersion,
      active: nextGeneration,
      previous: previousCandidate,
      staging: null,
      ...(state.packs ? { packs: state.packs } : {}),
    };
    this.metadataStore.write(state);

    options.onProgress?.({
      phase: 'pruning',
      completedFiles: diff.toDownload.length,
      totalFiles: diff.toDownload.length,
      downloadedBytes,
      totalDownloadBytes: diff.downloadBytes,
    });

    const prunedBlobs = await this.pruneWithinBudget();

    options.onProgress?.({
      phase: 'complete',
      completedFiles: diff.toDownload.length,
      totalFiles: diff.toDownload.length,
      downloadedBytes,
      totalDownloadBytes: diff.downloadBytes,
    });

    return {
      version: manifest.version,
      reusedFiles: diff.reusable.length,
      downloadedFiles: downloadedCount,
      resumedFiles: resumedFilesCount,
      totalBytes: manifest.totalBytes,
      downloadBytes: downloadedBytes,
      prunedBlobs,
      activeGeneration: nextGeneration,
    };
  }

  private resolvePackDescriptor(
    manifest: VersionedAssetManifest,
    packId: string,
  ): { descriptor: ContentPackDescriptor; entries: VersionedAssetEntry[] } {
    const fileMap = new Map(manifest.files.map((f) => [f.path, f]));
    const listed = manifest.packs?.find((p) => p.id === packId);
    if (listed) {
      const entries = listed.paths
        .map((p) => fileMap.get(p))
        .filter((f): f is VersionedAssetEntry => Boolean(f));
      if (entries.length !== listed.paths.length) {
        throw new Error(`Content pack "${packId}" references missing entries in manifest`);
      }
      return { descriptor: listed, entries };
    }

    const groupedEntries = manifest.files.filter((f) => classifyContentPack(f.path).packId === packId);
    if (groupedEntries.length === 0) {
      throw new Error(`Unknown content pack "${packId}" in manifest v${manifest.version}`);
    }
    const meta = classifyContentPack(groupedEntries[0].path);
    const totalBytes = groupedEntries.reduce((sum, item) => sum + item.bytes, 0);
    return {
      descriptor: {
        id: packId,
        name: meta.name,
        kind: meta.kind,
        required: meta.required,
        version: manifest.version,
        sha256: '',
        totalBytes,
        fileCount: groupedEntries.length,
        paths: groupedEntries.map((e) => e.path),
        minNativeVersion: manifest.minNativeVersion,
        ...(manifest.maxNativeVersion ? { maxNativeVersion: manifest.maxNativeVersion } : {}),
        minAndroidVersionCode: manifest.minAndroidVersionCode,
        schemaVersion: manifest.schemaVersion,
      },
      entries: groupedEntries,
    };
  }

  /**
   * Synchronizes a single segmented content pack (e.g., `region-kanbale` or `characters-core`)
   * with SHA-256 verification, delta blob reuse, compatibility gating, and previous-pack rollback retention.
   */
  async syncPack(
    rawManifest: unknown,
    packId: string,
    options: {
      assetBaseUrl: string;
      codeVersion?: string;
      localNative?: LocalNativeRuntimeInfo;
      signal?: AbortSignal;
      onProgress?: (event: AssetSyncProgressEvent) => void;
    },
  ): Promise<{
    packId: string;
    version: string;
    reusedFiles: number;
    downloadedFiles: number;
    totalBytes: number;
    downloadBytes: number;
    prunedBlobs: number;
    activePack: StoredContentPackGeneration;
  }> {
    const manifest = validateAssetManifest(rawManifest);
    const codeVersion = options.codeVersion ?? manifest.version;
    const { descriptor, entries } = this.resolvePackDescriptor(manifest, packId);

    const state = this.metadataStore.read();
    const currentPackState = state.packs?.[packId];
    const currentActive = currentPackState?.active ?? null;

    if (options.localNative) {
      const compat = checkContentPackCompatibility(
        descriptor.sha256 ? descriptor : { ...descriptor, sha256: '0'.repeat(64) },
        options.localNative,
        currentActive?.version ?? null,
      );
      if (!compat.compatible && compat.reason !== 'up_to_date') {
        throw new Error(compat.message);
      }
    }

    if (descriptor.totalBytes > this.maxStorageBytes) {
      throw new Error(
        `Content pack "${packId}" size (${descriptor.totalBytes} bytes) exceeds storage limit (${this.maxStorageBytes} bytes)`,
      );
    }

    if (
      currentActive &&
      currentActive.version === descriptor.version &&
      currentActive.codeVersion === codeVersion &&
      (!descriptor.sha256 || currentActive.sha256 === descriptor.sha256.toLowerCase())
    ) {
      let intact = true;
      for (const file of entries) {
        const cur = currentActive.files[file.path];
        if (!cur || cur.sha256 !== file.sha256 || !(await this.blobStore.has(file.sha256))) {
          intact = false;
          break;
        }
      }
      if (intact) {
        return {
          packId,
          version: descriptor.version,
          reusedFiles: entries.length,
          downloadedFiles: 0,
          totalBytes: descriptor.totalBytes,
          downloadBytes: 0,
          prunedBlobs: 0,
          activePack: currentActive,
        };
      }
    }

    const toDownload: VersionedAssetEntry[] = [];
    const committedFiles: Record<string, { sha256: string; bytes: number }> = {};
    let downloadBytes = 0;
    let reusedFiles = 0;

    for (const entry of entries) {
      if (await this.blobStore.has(entry.sha256)) {
        reusedFiles += 1;
        committedFiles[entry.path] = { sha256: entry.sha256, bytes: entry.bytes };
      } else {
        toDownload.push(entry);
        downloadBytes += entry.bytes;
      }
    }

    await this.enforceStorageHeadroom(downloadBytes, state);

    const baseNormalized = options.assetBaseUrl.replace(/\/+$/, '');
    const { downloadedBytes, downloadedCount } = await this.downloadAndVerifyEntries(
      toDownload,
      baseNormalized,
      downloadBytes,
      {
        signal: options.signal,
        onProgress: options.onProgress,
        onVerifiedEntry: (entry) => {
          committedFiles[entry.path] = { sha256: entry.sha256, bytes: entry.bytes };
        },
      },
    );

    const actualPackDigest = (await this.hashBytes(serializeContentPackDigestInput(entries))).toLowerCase();
    if (descriptor.sha256 && actualPackDigest !== descriptor.sha256.toLowerCase()) {
      throw new Error(
        `Content pack "${packId}" digest mismatch: expected ${descriptor.sha256}, got ${actualPackDigest}`,
      );
    }

    for (const entry of entries) {
      const ref = committedFiles[entry.path];
      if (!ref || !(await this.blobStore.has(ref.sha256))) {
        throw new Error(`Content pack "${packId}" activation incomplete: missing ${entry.path}`);
      }
    }

    const nextPackGen: StoredContentPackGeneration = {
      packId,
      name: descriptor.name,
      kind: descriptor.kind,
      required: descriptor.required,
      version: descriptor.version,
      sha256: descriptor.sha256 ? descriptor.sha256.toLowerCase() : actualPackDigest,
      codeVersion,
      channel: manifest.channel,
      schemaVersion: manifest.schemaVersion,
      activatedAt: new Date().toISOString(),
      totalBytes: descriptor.totalBytes,
      files: committedFiles,
    };

    const previousCandidate =
      currentActive && currentActive.version !== nextPackGen.version
        ? currentActive
        : currentPackState?.previous ?? null;

    const latestState = this.metadataStore.read();
    const nextPacks: Record<string, StoredContentPackState> = {
      ...(latestState.packs ?? {}),
      [packId]: {
        active: nextPackGen,
        previous: previousCandidate,
      },
    };
    this.metadataStore.write({
      ...latestState,
      packs: nextPacks,
    });

    const prunedBlobs = await this.pruneWithinBudget();
    return {
      packId,
      version: descriptor.version,
      reusedFiles,
      downloadedFiles: downloadedCount,
      totalBytes: descriptor.totalBytes,
      downloadBytes: downloadedBytes,
      prunedBlobs,
      activePack: nextPackGen,
    };
  }

  /**
   * Rolls back one content pack to its preserved previous working generation, or
   * clears its pack override cleanly so bundled APK / active OTA assets serve instead.
   */
  async rollbackPack(packId: string): Promise<StoredContentPackGeneration | null> {
    const state = this.metadataStore.read();
    const current = state.packs?.[packId];
    if (!current) return null;

    if (current.previous) {
      let intact = true;
      for (const info of Object.values(current.previous.files)) {
        if (!(await this.blobStore.has(info.sha256))) {
          intact = false;
          break;
        }
      }
      if (intact) {
        const restored = current.previous;
        this.metadataStore.write({
          ...state,
          packs: {
            ...(state.packs ?? {}),
            [packId]: { active: restored, previous: null },
          },
        });
        await this.pruneWithinBudget();
        return restored;
      }
    }

    const nextPacks = { ...(state.packs ?? {}) };
    delete nextPacks[packId];
    this.metadataStore.write({
      ...state,
      packs: nextPacks,
    });
    await this.pruneWithinBudget();
    return null;
  }

  async evictPack(packId: string, options?: { allowRequired?: boolean }): Promise<boolean> {
    const state = this.metadataStore.read();
    const current = state.packs?.[packId];
    if (!current?.active) return false;
    if (current.active.required && !options?.allowRequired) {
      throw new Error(`Cannot evict required offline pack "${packId}" while required safety flag is active.`);
    }
    const nextPacks = { ...(state.packs ?? {}) };
    delete nextPacks[packId];
    this.metadataStore.write({
      ...state,
      packs: nextPacks,
    });
    await this.pruneWithinBudget();
    return true;
  }

  async rollbackPacksForCodeVersion(failedCodeVersion: string): Promise<string[]> {
    const state = this.metadataStore.read();
    const packs = state.packs;
    if (!packs) return [];
    const rolled: string[] = [];
    for (const [packId, packState] of Object.entries(packs)) {
      if (packState.active && packState.active.codeVersion === failedCodeVersion) {
        await this.rollbackPack(packId);
        rolled.push(packId);
      }
    }
    return rolled;
  }

  getPackSummaries(manifest?: VersionedAssetManifest | null): ContentPackStatus[] {
    const state = this.metadataStore.read();
    const cachedPacks = state.packs ?? {};
    const manifestPacks = new Map<string, ContentPackDescriptor>();
    if (manifest) {
      if (manifest.packs) {
        for (const p of manifest.packs) manifestPacks.set(p.id, p);
      } else {
        for (const entry of manifest.files) {
          const info = classifyContentPack(entry.path);
          const existing = manifestPacks.get(info.packId);
          if (existing) {
            manifestPacks.set(info.packId, {
              ...existing,
              totalBytes: existing.totalBytes + entry.bytes,
              fileCount: existing.fileCount + 1,
              paths: [...existing.paths, entry.path],
            });
          } else {
            manifestPacks.set(info.packId, {
              id: info.packId,
              name: info.name,
              kind: info.kind,
              required: info.required,
              version: manifest.version,
              sha256: '',
              totalBytes: entry.bytes,
              fileCount: 1,
              paths: [entry.path],
              minNativeVersion: manifest.minNativeVersion,
              minAndroidVersionCode: manifest.minAndroidVersionCode,
              schemaVersion: manifest.schemaVersion,
            });
          }
        }
      }
    }

    const allIds = new Set<string>([...manifestPacks.keys(), ...Object.keys(cachedPacks)]);
    const activeOta = state.active;
    const out: ContentPackStatus[] = [];

    for (const id of allIds) {
      const mPack = manifestPacks.get(id);
      const cState = cachedPacks[id];
      const activePack = cState?.active ?? null;
      const prevPack = cState?.previous ?? null;

      let coveredByActiveOta = false;
      if (!activePack && activeOta && mPack) {
        coveredByActiveOta = mPack.paths.every((p) => Boolean(activeOta.files[p]));
      }

      const source: ContentPackStatus['source'] = activePack
        ? 'cached-pack'
        : coveredByActiveOta
          ? 'active-ota'
          : 'bundled-apk';

      out.push({
        id,
        name: mPack?.name ?? activePack?.name ?? id,
        kind: mPack?.kind ?? activePack?.kind ?? 'media',
        required: mPack?.required ?? activePack?.required ?? false,
        availableVersion: mPack?.version ?? null,
        cachedVersion: activePack?.version ?? (coveredByActiveOta ? activeOta?.version ?? null : null),
        previousVersion: prevPack?.version ?? null,
        totalBytes: activePack?.totalBytes ?? mPack?.totalBytes ?? 0,
        fileCount: activePack ? Object.keys(activePack.files).length : mPack?.fileCount ?? 0,
        source,
        canRollback: Boolean(activePack),
      });
    }
    return out;
  }

  /**
   * Rolls back atomically to the preserved previous working generation (or clears
   * active OTA cache so the APK builtin fallback serves immediately if no previous exists).
   */
  async rollbackToPrevious(): Promise<StoredAssetGeneration | null> {
    const state = this.metadataStore.read();
    if (state.previous) {
      let intact = true;
      for (const info of Object.values(state.previous.files)) {
        if (!(await this.blobStore.has(info.sha256))) {
          intact = false;
          break;
        }
      }
      if (intact) {
        const next: AssetCacheIndexState = {
          schemaVersion: state.schemaVersion,
          active: state.previous,
          previous: null,
          staging: null,
          ...(state.packs ? { packs: state.packs } : {}),
        };
        this.metadataStore.write(next);
        await this.pruneWithinBudget();
        return next.active;
      }
    }

    this.metadataStore.write({
      schemaVersion: state.schemaVersion,
      active: null,
      previous: null,
      staging: null,
      ...(state.packs ? { packs: state.packs } : {}),
    });
    await this.pruneWithinBudget();
    return null;
  }

  async getStorageUsageBytes(): Promise<number> {
    const blobs = await this.blobStore.list();
    return blobs.reduce((acc, item) => acc + item.bytes, 0);
  }

  private async deleteUnprotectedBlobs(keepHashes: Set<string>): Promise<number> {
    let pruned = 0;
    const blobs = await this.blobStore.list();
    for (const blob of blobs) {
      if (!keepHashes.has(blob.sha256)) {
        await this.blobStore.delete(blob.sha256);
        pruned += 1;
      }
    }
    return pruned;
  }

  private stripSupersededPrevious(state: AssetCacheIndexState): { next: AssetCacheIndexState; changed: boolean } {
    let changed = false;
    let nextPrevious = state.previous;
    if (state.active && state.previous) {
      nextPrevious = null;
      changed = true;
    }
    let nextPacks = state.packs;
    if (state.packs) {
      const updatedPacks: Record<string, StoredContentPackState> = { ...state.packs };
      for (const [id, pState] of Object.entries(state.packs)) {
        if (pState.active && pState.previous) {
          updatedPacks[id] = { active: pState.active, previous: null };
          changed = true;
        }
      }
      if (changed) nextPacks = updatedPacks;
    }
    return {
      changed,
      next: {
        ...state,
        previous: nextPrevious,
        ...(nextPacks ? { packs: nextPacks } : {}),
      },
    };
  }

  private async enforceStorageHeadroom(incomingBytes: number, state: AssetCacheIndexState): Promise<void> {
    const currentUsage = await this.getStorageUsageBytes();
    if (currentUsage + incomingBytes <= this.maxStorageBytes) return;

    await this.deleteUnprotectedBlobs(collectProtectedHashes(state, { includePrevious: true }));

    let updatedUsage = await this.getStorageUsageBytes();
    if (updatedUsage + incomingBytes <= this.maxStorageBytes) return;

    // Safely evict superseded `previous` generations ONLY when an intact active generation exists.
    const { next, changed } = this.stripSupersededPrevious(state);
    if (changed) {
      this.metadataStore.write(next);
      await this.deleteUnprotectedBlobs(collectProtectedHashes(next, { includePrevious: false }));
      updatedUsage = await this.getStorageUsageBytes();
    }

    if (updatedUsage + incomingBytes > this.maxStorageBytes) {
      throw new Error(
        `Storage limit (${this.maxStorageBytes} bytes) would be exceeded (used=${updatedUsage}, incoming=${incomingBytes}); preserving existing offline copy.`,
      );
    }
  }

  async pruneWithinBudget(): Promise<number> {
    const state = this.metadataStore.read();
    let pruned = await this.deleteUnprotectedBlobs(collectProtectedHashes(state, { includePrevious: true }));

    const usageAfterOrphanPrune = await this.getStorageUsageBytes();
    if (usageAfterOrphanPrune > this.maxStorageBytes) {
      const { next, changed } = this.stripSupersededPrevious(state);
      if (changed) {
        this.metadataStore.write(next);
        pruned += await this.deleteUnprotectedBlobs(collectProtectedHashes(next, { includePrevious: false }));
      }
    }

    return pruned;
  }

  async verifyActiveIntegrity(): Promise<{ ok: boolean; missingPaths: string[]; corruptedPaths: string[] }> {
    const state = this.metadataStore.read();
    const targets: Array<{ files: Readonly<Record<string, { readonly sha256: string; readonly bytes: number }>> }> = [];
    if (state.active) targets.push(state.active);
    if (state.packs) {
      for (const packState of Object.values(state.packs)) {
        if (packState.active) targets.push(packState.active);
      }
    }
    if (targets.length === 0) return { ok: true, missingPaths: [], corruptedPaths: [] };

    const missingPaths: string[] = [];
    const corruptedPaths: string[] = [];

    for (const target of targets) {
      for (const [path, entry] of Object.entries(target.files)) {
        const bytes = await this.blobStore.get(entry.sha256);
        if (!bytes) {
          missingPaths.push(path);
          continue;
        }
        const actualHash = (await this.hashBytes(bytes)).toLowerCase();
        if (actualHash !== entry.sha256.toLowerCase()) {
          corruptedPaths.push(path);
        }
      }
    }

    return {
      ok: missingPaths.length === 0 && corruptedPaths.length === 0,
      missingPaths,
      corruptedPaths,
    };
  }
}

export type { VersionedAssetEntry };
