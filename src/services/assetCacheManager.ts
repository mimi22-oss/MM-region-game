import {
  APP_NATIVE_BASELINE,
  DEFAULT_MAX_ASSET_STORAGE_BYTES,
  diffAssetManifests,
  isValidSha256,
  normalizeAssetPath,
  validateAssetManifest,
  type AssetDeltaDiff,
  type OtaChannel,
  type VersionedAssetEntry,
  type VersionedAssetManifest,
} from '../game/otaCompatibility.ts';

export const ASSET_CACHE_INDEX_KEY = 'mm-ota-asset-index-v1';
export const ASSET_BLOB_CACHE_NAME = 'mm-region-ota-blobs-v1';

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
}

export interface AssetBlobStore {
  get(sha256: string): Promise<Uint8Array | null>;
  has(sha256: string): Promise<boolean>;
  put(sha256: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  delete(sha256: string): Promise<void>;
  list(): Promise<readonly { sha256: string; bytes: number }[]>;
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

function collectReferencedHashes(gen: StoredAssetGeneration | null | undefined, target: Set<string>): void {
  if (!gen) return;
  for (const meta of Object.values(gen.files)) {
    target.add(meta.sha256.toLowerCase());
  }
}

export class AssetCacheManager {
  private readonly blobStore: AssetBlobStore;
  private readonly metadataStore: AssetMetadataStore;
  private readonly maxStorageBytes: number;
  private readonly fetcher: (url: string, signal?: AbortSignal) => Promise<Response>;
  private readonly hashBytes: (bytes: Uint8Array) => Promise<string>;
  private syncInFlight: Promise<AssetSyncResult> | null = null;

  constructor(options?: AssetCacheManagerOptions) {
    this.blobStore = options?.blobStore ?? new CacheStorageAssetBlobStore();
    this.metadataStore = options?.metadataStore ?? new LocalStorageMetadataStore();
    this.maxStorageBytes = options?.maxStorageBytes ?? DEFAULT_MAX_ASSET_STORAGE_BYTES;
    this.fetcher =
      options?.fetcher ??
      ((url, signal) => fetch(url, { cache: 'no-store', signal }));
    this.hashBytes = options?.hashBytes ?? sha256HexBytes;
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
    const active = this.metadataStore.read().active;
    if (!active) return null;
    const entry = active.files[cleanPath];
    if (!entry) return null;

    const bytes = await this.blobStore.get(entry.sha256);
    if (!bytes) return null;
    return {
      bytes,
      sha256: entry.sha256,
      contentType: inferAssetContentType(cleanPath),
    };
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

    let downloadedBytes = 0;
    let downloadedCount = 0;

    for (const entry of diff.toDownload) {
      if (options.signal?.aborted) {
        throw new Error('Asset sync aborted');
      }

      options.onProgress?.({
        phase: 'downloading',
        completedFiles: downloadedCount,
        totalFiles: diff.toDownload.length,
        downloadedBytes,
        totalDownloadBytes: diff.downloadBytes,
        currentPath: entry.path,
      });

      const downloadUrl = `${baseNormalized}/${entry.path}`;
      const response = await this.fetcher(downloadUrl, options.signal);
      if (!response.ok) {
        throw new Error(`Failed downloading asset "${entry.path}": HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      options.onProgress?.({
        phase: 'verifying',
        completedFiles: downloadedCount,
        totalFiles: diff.toDownload.length,
        downloadedBytes,
        totalDownloadBytes: diff.downloadBytes,
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
      verifiedMap[entry.path] = { sha256: entry.sha256, bytes: entry.bytes };
      completedSet.add(entry.path);
      downloadedBytes += entry.bytes;
      downloadedCount += 1;

      // Persist after every verified file so interrupted downloads can resume cleanly
      writeStagingSnapshot();
    }

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
    });
    await this.pruneWithinBudget();
    return null;
  }

  async getStorageUsageBytes(): Promise<number> {
    const blobs = await this.blobStore.list();
    return blobs.reduce((acc, item) => acc + item.bytes, 0);
  }

  private async enforceStorageHeadroom(incomingBytes: number, state: AssetCacheIndexState): Promise<void> {
    const currentUsage = await this.getStorageUsageBytes();
    if (currentUsage + incomingBytes <= this.maxStorageBytes) return;

    // First drop unreferenced orphaned blobs (keep active, previous, and current staging hashes).
    const protectedHashes = new Set<string>();
    collectReferencedHashes(state.active, protectedHashes);
    collectReferencedHashes(state.previous, protectedHashes);
    if (state.staging) {
      for (const item of Object.values(state.staging.verifiedHashes)) {
        protectedHashes.add(item.sha256.toLowerCase());
      }
    }

    let blobs = await this.blobStore.list();
    for (const blob of blobs) {
      if (!protectedHashes.has(blob.sha256)) {
        await this.blobStore.delete(blob.sha256);
      }
    }

    let updatedUsage = await this.getStorageUsageBytes();
    if (updatedUsage + incomingBytes <= this.maxStorageBytes) return;

    // If still tight and an active generation exists as working copy, safely evict `previous` generation
    // ONLY when an intact `active` generation exists (never delete the sole working offline copy!).
    if (state.active && state.previous) {
      const keepHashes = new Set<string>();
      collectReferencedHashes(state.active, keepHashes);
      if (state.staging) {
        for (const item of Object.values(state.staging.verifiedHashes)) {
          keepHashes.add(item.sha256.toLowerCase());
        }
      }
      this.metadataStore.write({ ...state, previous: null });
      blobs = await this.blobStore.list();
      for (const blob of blobs) {
        if (!keepHashes.has(blob.sha256)) {
          await this.blobStore.delete(blob.sha256);
        }
      }
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
    const keepHashes = new Set<string>();
    // Always protect active and staging hashes; never delete the sole working offline copy.
    collectReferencedHashes(state.active, keepHashes);
    collectReferencedHashes(state.previous, keepHashes);
    if (state.staging) {
      for (const item of Object.values(state.staging.verifiedHashes)) {
        keepHashes.add(item.sha256.toLowerCase());
      }
    }

    let pruned = 0;
    const blobs = await this.blobStore.list();
    for (const blob of blobs) {
      if (!keepHashes.has(blob.sha256)) {
        await this.blobStore.delete(blob.sha256);
        pruned += 1;
      }
    }

    const usageAfterOrphanPrune = await this.getStorageUsageBytes();
    if (usageAfterOrphanPrune > this.maxStorageBytes && state.active && state.previous) {
      // Safe eviction of superseded `previous` generation because `active` is verified and intact.
      const activeOnlyHashes = new Set<string>();
      collectReferencedHashes(state.active, activeOnlyHashes);
      if (state.staging) {
        for (const item of Object.values(state.staging.verifiedHashes)) {
          activeOnlyHashes.add(item.sha256.toLowerCase());
        }
      }
      this.metadataStore.write({ ...state, previous: null });
      for (const blob of await this.blobStore.list()) {
        if (!activeOnlyHashes.has(blob.sha256)) {
          await this.blobStore.delete(blob.sha256);
          pruned += 1;
        }
      }
    }

    return pruned;
  }

  async verifyActiveIntegrity(): Promise<{ ok: boolean; missingPaths: string[]; corruptedPaths: string[] }> {
    const active = this.metadataStore.read().active;
    if (!active) return { ok: true, missingPaths: [], corruptedPaths: [] };

    const missingPaths: string[] = [];
    const corruptedPaths: string[] = [];

    for (const [path, entry] of Object.entries(active.files)) {
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

    return {
      ok: missingPaths.length === 0 && corruptedPaths.length === 0,
      missingPaths,
      corruptedPaths,
    };
  }
}

export type { VersionedAssetEntry };
