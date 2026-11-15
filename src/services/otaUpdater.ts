import { useSyncExternalStore } from 'react';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import {
  APP_NATIVE_BASELINE,
  checkUpdateCompatibility,
  DEFAULT_OTA_BASE_URL,
  validateAssetManifest,
  type ChannelReleaseDescriptor,
  type OtaChannel,
  type UpdateCompatibilityResult,
} from '../game/otaCompatibility.ts';
import {
  evaluateUpdateApplySafety,
  runAtSafeUpdateBoundary,
  type UpdateBusyContext,
  type UpdateSafetyEvaluation,
} from '../game/updateSafety.ts';
import { isNativeAndroid } from './platform.ts';
import { isNetworkOnline, subscribeNetworkState } from './networkStatus.ts';
import { AssetCacheManager, type AssetSyncProgressEvent } from './assetCacheManager.ts';

export const OTA_STORAGE_KEY = 'mm-ota-state-v1';

export type OtaUpdatePhase =
  | 'idle'
  | 'checking'
  | 'up_to_date'
  | 'offline'
  | 'update_available'
  | 'downloading'
  | 'verifying'
  | 'ready_to_restart'
  | 'applying'
  | 'deferred_busy'
  | 'native_apk_required'
  | 'failed'
  | 'rolled_back';

export interface RollbackNotification {
  readonly failedVersion: string;
  readonly recoveredToVersion: string;
  readonly reason: string;
  readonly timestamp: string;
}

export interface OtaUpdateState {
  readonly platform: 'android-native' | 'web';
  readonly channel: OtaChannel;
  readonly updateBaseUrl: string;
  readonly currentVersion: string;
  readonly nativeVersion: string;
  readonly androidVersionCode: number;
  readonly activeBundleId: string;
  readonly activeAssetVersion: string | null;
  readonly online: boolean;
  readonly phase: OtaUpdatePhase;
  readonly statusMessage: string;
  readonly availableRelease: ChannelReleaseDescriptor | null;
  readonly compatibility: UpdateCompatibilityResult | null;
  readonly pendingBundleId: string | null;
  readonly downloadPercent: number;
  readonly downloadedBytes: number;
  readonly totalDownloadBytes: number;
  readonly safety: UpdateSafetyEvaluation;
  readonly rollbackNotification: RollbackNotification | null;
  readonly lastCheckedAt: string | null;
  readonly lastError: string | null;
  readonly offlineFallbackReady: boolean;
  readonly pendingApplyOnSafeBoundary: boolean;
}

interface PersistedOtaMeta {
  channel: OtaChannel;
  pendingApply: {
    version: string;
    bundleId: string;
    previousVersion: string;
    requestedAt: string;
  } | null;
  rollbackNotification: RollbackNotification | null;
  lastCheckedAt: string | null;
}

export interface NativeUpdaterBridge {
  notifyAppReady(): Promise<void>;
  current(): Promise<{ bundle: BundleInfo; native: string }>;
  list(): Promise<{ bundles: BundleInfo[] }>;
  download(options: {
    url: string;
    version: string;
    checksum: string;
    manifest?: { file_name: string | null; file_hash: string | null; download_url: string | null }[];
  }): Promise<BundleInfo>;
  next(options: { id: string }): Promise<BundleInfo>;
  set(options: { id: string }): Promise<void>;
  reset(options?: { toLastSuccessful?: boolean }): Promise<void>;
  addListener(
    eventName: 'download' | 'downloadComplete' | 'downloadFailed' | 'updateFailed',
    listener: (payload: Record<string, unknown>) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export interface OtaCoordinatorDependencies {
  readonly isNativeAndroidPlatform?: () => boolean;
  readonly nativeUpdater?: NativeUpdaterBridge;
  readonly assetCacheManager?: AssetCacheManager;
  readonly fetcher?: (url: string, signal?: AbortSignal) => Promise<Response>;
  readonly getOnline?: () => boolean;
  readonly subscribeOnline?: (cb: (online: boolean) => void) => () => void;
  readonly onReloadWeb?: () => void;
  readonly initialVersion?: string;
  readonly nativeVersion?: string;
  readonly androidVersionCode?: number;
  readonly updateBaseUrl?: string;
  readonly allowLocalDevHttp?: boolean;
  readonly metaStore?: {
    read(): Partial<PersistedOtaMeta> | null;
    write(meta: PersistedOtaMeta): void;
  };
}

const DEFAULT_BUSY_CONTEXT: UpdateBusyContext = {
  ghostThreatActive: false,
  ghostGrabActive: false,
  ridingMotorcycle: false,
  drivingCar: false,
  ridingBalloon: false,
  introActive: false,
  sceneLoading: false,
  activeModalBlocking: false,
};

function readBuildVersionFallback(): string {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (env?.VITE_APP_VERSION) return env.VITE_APP_VERSION;
  } catch {
    // Node fallback
  }
  return APP_NATIVE_BASELINE.nativeVersion;
}

function readDefaultChannelFallback(): OtaChannel {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (env?.VITE_OTA_CHANNEL === 'staging') return 'staging';
  } catch {
    // Node fallback
  }
  return 'production';
}

function createLocalStorageMetaStore(): {
  read(): Partial<PersistedOtaMeta> | null;
  write(meta: PersistedOtaMeta): void;
} {
  let memoryCopy: PersistedOtaMeta | null = null;
  return {
    read() {
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(OTA_STORAGE_KEY) : null;
        if (!raw) return memoryCopy;
        return JSON.parse(raw) as Partial<PersistedOtaMeta>;
      } catch {
        return memoryCopy;
      }
    },
    write(meta: PersistedOtaMeta) {
      memoryCopy = meta;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(OTA_STORAGE_KEY, JSON.stringify(meta));
        }
      } catch {
        // Ignore restricted WebView storage errors
      }
    },
  };
}

function createCapacitorNativeBridge(): NativeUpdaterBridge {
  return {
    notifyAppReady: async () => {
      await CapacitorUpdater.notifyAppReady();
    },
    current: () => CapacitorUpdater.current(),
    list: () => CapacitorUpdater.list(),
    download: (options) => CapacitorUpdater.download(options),
    next: (options) => CapacitorUpdater.next(options),
    set: (options) => CapacitorUpdater.set(options),
    reset: (options) => CapacitorUpdater.reset(options),
    addListener: async (eventName, listener) => {
      switch (eventName) {
        case 'download':
          return CapacitorUpdater.addListener('download', (ev) =>
            listener(ev as unknown as Record<string, unknown>),
          );
        case 'downloadComplete':
          return CapacitorUpdater.addListener('downloadComplete', (ev) =>
            listener(ev as unknown as Record<string, unknown>),
          );
        case 'downloadFailed':
          return CapacitorUpdater.addListener('downloadFailed', (ev) =>
            listener(ev as unknown as Record<string, unknown>),
          );
        case 'updateFailed':
          return CapacitorUpdater.addListener('updateFailed', (ev) =>
            listener(ev as unknown as Record<string, unknown>),
          );
      }
    },
  };
}

async function parseOtaJsonResponse<T>(
  response: Response,
  url: string,
  label: string,
): Promise<T> {
  if (response.status === 404) {
    throw new Error(`${label} not published yet at ${url} (HTTP 404).`);
  }
  if (!response.ok) {
    throw new Error(`${label} unavailable at ${url} (HTTP ${response.status}).`);
  }

  const contentType = response.headers?.get?.('content-type')?.toLowerCase() ?? '';
  if (typeof response.text === 'function') {
    const rawText = await response.text();
    const trimmed = rawText.trimStart();
    if (
      contentType.includes('text/html') ||
      /^<(?:!doctype|html|head|body)\b/i.test(trimmed) ||
      trimmed.startsWith('<')
    ) {
      throw new Error(
        `${label} returned HTML instead of JSON (${url}). Deploy the latest web build with /ota/*.json manifests enabled.`,
      );
    }
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new Error(
        `${label} returned invalid JSON${contentType ? ` (${contentType})` : ''} from ${url}.`,
      );
    }
  }

  if (contentType.includes('text/html')) {
    throw new Error(
      `${label} returned HTML instead of JSON (${url}). Deploy the latest web build with /ota/*.json manifests enabled.`,
    );
  }
  return (await response.json()) as T;
}

export class OtaCoordinator {
  private readonly checkNativeAndroid: () => boolean;
  private readonly nativeUpdater: NativeUpdaterBridge;
  readonly assetCache: AssetCacheManager;
  private readonly fetcher: (url: string, signal?: AbortSignal) => Promise<Response>;
  private readonly getOnline: () => boolean;
  private readonly subscribeOnline: (cb: (online: boolean) => void) => () => void;
  private readonly onReloadWeb: () => void;
  private readonly metaStore: {
    read(): Partial<PersistedOtaMeta> | null;
    write(meta: PersistedOtaMeta): void;
  };
  private readonly allowLocalDevHttp: boolean;

  private readonly listeners = new Set<() => void>();
  private listenerRemovers: Array<() => void> = [];
  private busyContext: UpdateBusyContext = DEFAULT_BUSY_CONTEXT;
  private flushSaveFn: () => unknown = () => null;
  private initialized = false;
  private checkInFlight: Promise<OtaUpdateState> | null = null;
  private downloadInFlight: Promise<OtaUpdateState> | null = null;
  private pendingManifest: ReturnType<typeof validateAssetManifest> | null = null;
  private state: OtaUpdateState;

  constructor(deps: OtaCoordinatorDependencies = {}) {
    this.checkNativeAndroid = deps.isNativeAndroidPlatform ?? isNativeAndroid;
    this.nativeUpdater = deps.nativeUpdater ?? createCapacitorNativeBridge();
    this.assetCache = deps.assetCacheManager ?? new AssetCacheManager({ fetcher: deps.fetcher });
    this.fetcher =
      deps.fetcher ??
      ((url, signal) => fetch(url, { cache: 'no-store', signal }));
    this.getOnline = deps.getOnline ?? (() => isNetworkOnline());
    this.subscribeOnline =
      deps.subscribeOnline ??
      ((cb) => subscribeNetworkState(() => cb(isNetworkOnline())));
    this.onReloadWeb =
      deps.onReloadWeb ??
      (() => {
        if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
          window.location.reload();
        }
      });
    this.metaStore = deps.metaStore ?? createLocalStorageMetaStore();
    this.allowLocalDevHttp = deps.allowLocalDevHttp ?? false;

    const persisted = this.metaStore.read();
    const initialChannel: OtaChannel =
      persisted?.channel === 'staging' || persisted?.channel === 'production'
        ? persisted.channel
        : readDefaultChannelFallback();
    const nativeVersion = deps.nativeVersion ?? APP_NATIVE_BASELINE.nativeVersion;
    const currentVersion = deps.initialVersion ?? readBuildVersionFallback();
    const online = this.getOnline();

    this.state = {
      platform: this.checkNativeAndroid() ? 'android-native' : 'web',
      channel: initialChannel,
      updateBaseUrl: (deps.updateBaseUrl ?? DEFAULT_OTA_BASE_URL).replace(/\/+$/, ''),
      currentVersion,
      nativeVersion,
      androidVersionCode: deps.androidVersionCode ?? APP_NATIVE_BASELINE.androidVersionCode,
      activeBundleId: 'builtin',
      activeAssetVersion: this.assetCache.getActiveVersion(),
      online,
      phase: online ? 'idle' : 'offline',
      statusMessage: online ? 'Up to date check ready' : 'Offline · Running local bundled version',
      availableRelease: null,
      compatibility: null,
      pendingBundleId: null,
      downloadPercent: 0,
      downloadedBytes: 0,
      totalDownloadBytes: 0,
      safety: evaluateUpdateApplySafety(this.busyContext),
      rollbackNotification: persisted?.rollbackNotification ?? null,
      lastCheckedAt: persisted?.lastCheckedAt ?? null,
      lastError: null,
      offlineFallbackReady: this.assetCache.hasOfflineCopy(),
      pendingApplyOnSafeBoundary: false,
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private patchState(partial: Partial<OtaUpdateState>): void {
    this.state = {
      ...this.state,
      ...partial,
      activeAssetVersion: this.assetCache.getActiveVersion(),
      offlineFallbackReady: this.assetCache.hasOfflineCopy(),
      safety: evaluateUpdateApplySafety(this.busyContext),
    };
    this.emit();
  }

  private persistMeta(patch: Partial<PersistedOtaMeta>): void {
    const existing = this.metaStore.read();
    this.metaStore.write({
      channel: patch.channel ?? existing?.channel ?? this.state.channel,
      pendingApply: patch.pendingApply !== undefined ? patch.pendingApply : existing?.pendingApply ?? null,
      rollbackNotification:
        patch.rollbackNotification !== undefined
          ? patch.rollbackNotification
          : existing?.rollbackNotification ?? this.state.rollbackNotification,
      lastCheckedAt:
        patch.lastCheckedAt !== undefined
          ? patch.lastCheckedAt
          : existing?.lastCheckedAt ?? this.state.lastCheckedAt,
    });
  }

  getState = (): OtaUpdateState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setSafetyContext(nextCtx: UpdateBusyContext, flushSaveFn?: () => unknown): void {
    this.busyContext = nextCtx;
    if (flushSaveFn) this.flushSaveFn = flushSaveFn;
    const safety = evaluateUpdateApplySafety(this.busyContext);
    const prevSafe = this.state.safety.safeToApplyNow;
    if (prevSafe !== safety.safeToApplyNow) {
      this.patchState({});
    }
    if (
      safety.safeToApplyNow &&
      this.state.pendingApplyOnSafeBoundary &&
      (this.state.phase === 'ready_to_restart' || this.state.phase === 'deferred_busy')
    ) {
      void this.applyUpdateNow();
    }
  }

  async setChannel(channel: OtaChannel): Promise<void> {
    if (this.state.channel === channel) return;
    this.persistMeta({ channel });
    this.pendingManifest = null;
    this.patchState({
      channel,
      availableRelease: null,
      compatibility: null,
      pendingBundleId: null,
      pendingApplyOnSafeBoundary: false,
      phase: this.getOnline() ? 'idle' : 'offline',
      statusMessage: `Switched channel to ${channel}`,
      lastError: null,
    });
    if (this.getOnline()) {
      await this.checkForUpdate({ allowChannelSwitch: true });
    }
  }

  dismissRollbackNotification(): void {
    this.persistMeta({ rollbackNotification: null });
    this.patchState({ rollbackNotification: null });
  }

  async initialize(): Promise<OtaUpdateState> {
    if (this.initialized) return this.state;
    this.initialized = true;

    const unsubOnline = this.subscribeOnline((online) => {
      const nextPhase = !online && (this.state.phase === 'idle' || this.state.phase === 'up_to_date')
        ? 'offline'
        : online && this.state.phase === 'offline'
          ? 'idle'
          : this.state.phase;
      this.patchState({
        online,
        phase: nextPhase,
        statusMessage: online ? this.state.statusMessage : 'Offline · Running local bundled version',
      });
    });
    this.listenerRemovers.push(unsubOnline);

    if (this.checkNativeAndroid()) {
      // CRITICAL: Confirm bundle health BEFORE any network request so offline boot never trips appReadyTimeout.
      try {
        await this.nativeUpdater.notifyAppReady();
      } catch {
        // notifyAppReady never blocks offline launch
      }

      try {
        const cur = await this.nativeUpdater.current();
        const bundleId = cur.bundle.id || 'builtin';
        const nativeVer = cur.native || this.state.nativeVersion;
        const bundleVersion =
          bundleId === 'builtin' ? nativeVer : cur.bundle.version || this.state.currentVersion;

        const persisted = this.metaStore.read();
        let rollbackNote = persisted?.rollbackNotification ?? null;

        if (persisted?.pendingApply) {
          const expected = persisted.pendingApply;
          if (bundleId !== expected.bundleId && bundleVersion !== expected.version) {
            await this.assetCache.rollbackToPrevious();
            rollbackNote = {
              failedVersion: expected.version,
              recoveredToVersion: bundleVersion,
              reason: `Bundle ${expected.version} failed verification or startup and rolled back safely.`,
              timestamp: new Date().toISOString(),
            };
          }
          this.persistMeta({ pendingApply: null, rollbackNotification: rollbackNote });
        }

        const listResult = await this.nativeUpdater.list().catch(() => ({ bundles: [] as BundleInfo[] }));
        if (!rollbackNote) {
          const errored = listResult.bundles.find((b) => b.status === 'error');
          if (errored) {
            await this.assetCache.rollbackToPrevious();
            rollbackNote = {
              failedVersion: errored.version || errored.id,
              recoveredToVersion: bundleVersion,
              reason: 'Previous OTA bundle failed health check and automatically rolled back.',
              timestamp: new Date().toISOString(),
            };
            this.persistMeta({ rollbackNotification: rollbackNote });
          }
        }

        // Verify paired code/asset integrity; fall back cleanly if corrupted
        const integrity = await this.assetCache.verifyActiveIntegrity();
        if (!integrity.ok) {
          await this.assetCache.rollbackToPrevious();
        }

        this.patchState({
          nativeVersion: nativeVer,
          currentVersion: bundleVersion,
          activeBundleId: bundleId,
          rollbackNotification: rollbackNote,
          phase: rollbackNote ? 'rolled_back' : this.getOnline() ? 'idle' : 'offline',
          statusMessage: rollbackNote
            ? rollbackNote.reason
            : this.getOnline()
              ? `Running v${bundleVersion}`
              : `Offline · Running v${bundleVersion}`,
        });
      } catch {
        // Native bridge degraded gracefully to bundled defaults
      }

      try {
        const h1 = await this.nativeUpdater.addListener('download', (payload) => {
          const percent = typeof payload.percent === 'number' ? Math.max(0, Math.min(100, payload.percent)) : 0;
          this.patchState({
            phase: 'downloading',
            downloadPercent: Math.max(this.state.downloadPercent, Math.round(50 + percent * 0.5)),
            statusMessage: `Downloading app bundle (${Math.round(percent)}%)...`,
          });
        });
        const h2 = await this.nativeUpdater.addListener('updateFailed', (payload) => {
          const bundle = payload.bundle as Partial<BundleInfo> | undefined;
          const failedVersion = bundle?.version || 'unknown';
          const rollbackNote: RollbackNotification = {
            failedVersion,
            recoveredToVersion: this.state.currentVersion,
            reason: `OTA bundle ${failedVersion} failed activation and rolled back.`,
            timestamp: new Date().toISOString(),
          };
          void this.assetCache.rollbackToPrevious();
          this.persistMeta({ pendingApply: null, rollbackNotification: rollbackNote });
          this.patchState({
            phase: 'rolled_back',
            rollbackNotification: rollbackNote,
            statusMessage: rollbackNote.reason,
          });
        });
        this.listenerRemovers.push(() => void h1.remove(), () => void h2.remove());
      } catch {
        // Ignore listener failure on web/mock
      }
    } else {
      const integrity = await this.assetCache.verifyActiveIntegrity();
      if (!integrity.ok) {
        await this.assetCache.rollbackToPrevious();
      }
    }

    return this.state;
  }

  async checkForUpdate(options?: { allowChannelSwitch?: boolean; signal?: AbortSignal }): Promise<OtaUpdateState> {
    if (this.checkInFlight) return this.checkInFlight;

    const task = this.performCheck(options).finally(() => {
      if (this.checkInFlight === task) this.checkInFlight = null;
    });
    this.checkInFlight = task;
    return task;
  }

  private async performCheck(options?: { allowChannelSwitch?: boolean; signal?: AbortSignal }): Promise<OtaUpdateState> {
    if (!this.getOnline()) {
      this.patchState({
        online: false,
        phase: 'offline',
        statusMessage: 'Offline · Cannot check updates now (bundled game remains playable)',
      });
      return this.state;
    }

    this.patchState({
      phase: 'checking',
      lastError: null,
      statusMessage: `Checking ${this.state.channel} updates...`,
    });

    const channelUrl = `${this.state.updateBaseUrl}/ota/${this.state.channel}.json`;

    try {
      const response = await this.fetcher(channelUrl, options?.signal);
      const descriptor = await parseOtaJsonResponse<ChannelReleaseDescriptor>(
        response,
        channelUrl,
        'Update metadata',
      );
      const nowIso = new Date().toISOString();
      this.persistMeta({ lastCheckedAt: nowIso });

      const compat = checkUpdateCompatibility(
        descriptor,
        {
          nativeVersion: this.state.nativeVersion,
          androidVersionCode: this.state.androidVersionCode,
          schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
          currentVersion: this.state.currentVersion,
          channel: this.state.channel,
        },
        {
          allowChannelSwitch: options?.allowChannelSwitch,
          allowLocalDevHttp: this.allowLocalDevHttp,
        },
      );

      if (compat.requiresNativeApk) {
        this.patchState({
          phase: 'native_apk_required',
          availableRelease: descriptor,
          compatibility: compat,
          lastCheckedAt: nowIso,
          statusMessage: compat.message,
          lastError: null,
        });
        return this.state;
      }

      if (!compat.compatible) {
        this.patchState({
          phase: 'failed',
          compatibility: compat,
          lastCheckedAt: nowIso,
          lastError: compat.message,
          statusMessage: 'Update compatibility check did not pass; bundled version remains active.',
        });
        return this.state;
      }

      if (!compat.updateAvailable) {
        this.patchState({
          phase: 'up_to_date',
          availableRelease: null,
          compatibility: compat,
          lastCheckedAt: nowIso,
          lastError: null,
          statusMessage: compat.message,
        });
        return this.state;
      }

      // Pre-fetch and validate the versioned asset manifest so delta bytes can be surfaced accurately
      const manifestResp = await this.fetcher(descriptor.assetManifestUrl, options?.signal);
      const manifestRaw = await parseOtaJsonResponse<unknown>(
        manifestResp,
        descriptor.assetManifestUrl,
        'Asset manifest',
      );
      const validatedManifest = validateAssetManifest(manifestRaw);
      if (validatedManifest.version !== descriptor.version) {
        throw new Error(
          `Version mismatch between channel descriptor (${descriptor.version}) and asset manifest (${validatedManifest.version})`,
        );
      }

      const delta = await this.assetCache.computeDelta(validatedManifest);
      this.pendingManifest = validatedManifest;

      this.patchState({
        phase: 'update_available',
        availableRelease: descriptor,
        compatibility: compat,
        lastCheckedAt: nowIso,
        totalDownloadBytes: delta.downloadBytes,
        downloadedBytes: 0,
        downloadPercent: 0,
        lastError: null,
        statusMessage: `Update v${descriptor.version} available (${Math.round(delta.downloadBytes / 1024)} KB delta)`,
      });
      return this.state;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Update check failed';
      const offlineNow = !this.getOnline();
      this.patchState({
        online: !offlineNow,
        phase: offlineNow ? 'offline' : 'failed',
        lastError: offlineNow ? null : msg,
        statusMessage: offlineNow
          ? 'Offline · Running local bundled version'
          : 'Unable to check online updates · Bundled game remains playable offline.',
      });
      return this.state;
    }
  }

  async downloadAvailableUpdate(signal?: AbortSignal): Promise<OtaUpdateState> {
    if (this.downloadInFlight) return this.downloadInFlight;
    const task = this.performDownload(signal).finally(() => {
      if (this.downloadInFlight === task) this.downloadInFlight = null;
    });
    this.downloadInFlight = task;
    return task;
  }

  private async performDownload(signal?: AbortSignal): Promise<OtaUpdateState> {
    const release = this.state.availableRelease;
    if (!release) {
      await this.checkForUpdate({ signal });
    }
    const target = this.state.availableRelease;
    if (!target || !this.state.compatibility?.updateAvailable) {
      return this.state;
    }

    if (!this.getOnline()) {
      this.patchState({
        online: false,
        phase: 'offline',
        statusMessage: 'Offline · Download paused until connection returns',
      });
      return this.state;
    }

    const safety = evaluateUpdateApplySafety(this.busyContext);
    if (!safety.safeToDownloadInBackground) {
      this.patchState({
        phase: 'deferred_busy',
        statusMessage: `Download deferred: ${safety.summaryEn}`,
      });
      return this.state;
    }

    try {
      let manifest = this.pendingManifest;
      if (!manifest || manifest.version !== target.version) {
        const res = await this.fetcher(target.assetManifestUrl, signal);
        const manifestJson = await parseOtaJsonResponse<unknown>(
          res,
          target.assetManifestUrl,
          'Asset manifest',
        );
        manifest = validateAssetManifest(manifestJson);
        this.pendingManifest = manifest;
      }

      const handleAssetProgress = (ev: AssetSyncProgressEvent) => {
        const pct =
          ev.totalDownloadBytes > 0
            ? Math.min(50, Math.round((ev.downloadedBytes / ev.totalDownloadBytes) * 50))
            : ev.phase === 'complete'
              ? 50
              : 10;
        this.patchState({
          phase: ev.phase === 'verifying' ? 'verifying' : 'downloading',
          downloadPercent: this.checkNativeAndroid() ? pct : pct * 2,
          downloadedBytes: ev.downloadedBytes,
          totalDownloadBytes: ev.totalDownloadBytes,
          statusMessage:
            ev.phase === 'verifying'
              ? `Verifying ${ev.currentPath ?? 'assets'}...`
              : `Syncing assets (${ev.completedFiles}/${ev.totalFiles})...`,
        });
      };

      await this.assetCache.syncToManifest(manifest, {
        assetBaseUrl: this.state.updateBaseUrl,
        codeVersion: target.version,
        manifestSha256: target.assetManifestSha256,
        signal,
        onProgress: handleAssetProgress,
      });

      let bundleId: string | null = null;
      if (this.checkNativeAndroid()) {
        this.patchState({
          phase: 'downloading',
          downloadPercent: Math.max(this.state.downloadPercent, 55),
          statusMessage: `Downloading Android bundle v${target.version}...`,
        });

        const downloaded = await this.nativeUpdater.download({
          url: target.bundleUrl,
          version: target.version,
          checksum: target.bundleSha256,
          ...(target.deltaManifest && target.deltaManifest.length > 0
            ? {
                manifest: target.deltaManifest.map((item) => ({
                  file_name: item.file_name,
                  file_hash: item.file_hash,
                  download_url: item.download_url,
                })),
              }
            : {}),
        });
        bundleId = downloaded.id;
      }

      this.patchState({
        phase: 'ready_to_restart',
        pendingBundleId: bundleId,
        downloadPercent: 100,
        lastError: null,
        statusMessage: `v${target.version} downloaded and verified. Ready to restart when safe.`,
      });
      return this.state;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Download failed';
      const offlineNow = !this.getOnline();
      this.patchState({
        online: !offlineNow,
        phase: offlineNow ? 'offline' : 'failed',
        lastError: offlineNow ? null : msg,
        statusMessage: offlineNow
          ? 'Download interrupted offline · Verified partial assets saved for resume'
          : `Update failed cleanly (existing version preserved): ${msg}`,
      });
      return this.state;
    }
  }

  async applyUpdateNow(): Promise<{ applied: boolean; deferred: boolean; reason?: string }> {
    const release = this.state.availableRelease;
    if (this.state.phase !== 'ready_to_restart' && this.state.phase !== 'deferred_busy') {
      return { applied: false, deferred: false, reason: 'No downloaded update ready to apply.' };
    }

    const result = await runAtSafeUpdateBoundary(
      this.busyContext,
      () => this.flushSaveFn(),
      async () => {
        this.patchState({
          phase: 'applying',
          pendingApplyOnSafeBoundary: false,
          statusMessage: 'Saving game progress and restarting into new version...',
        });

        if (this.checkNativeAndroid()) {
          const bundleId = this.state.pendingBundleId;
          if (!bundleId || !release) {
            throw new Error('Missing verified native bundle identifier');
          }
          this.persistMeta({
            pendingApply: {
              version: release.version,
              bundleId,
              previousVersion: this.state.currentVersion,
              requestedAt: new Date().toISOString(),
            },
          });
          await this.nativeUpdater.set({ id: bundleId });
        } else {
          this.patchState({
            currentVersion: release?.version ?? this.state.currentVersion,
            phase: 'up_to_date',
            availableRelease: null,
          });
          this.onReloadWeb();
        }
      },
    );

    if (result.deferred) {
      this.patchState({
        phase: 'deferred_busy',
        pendingApplyOnSafeBoundary: true,
        statusMessage: `Waiting for safe moment (${result.safety.summaryEn})`,
      });
      return { applied: false, deferred: true, reason: result.safety.summaryEn };
    }

    return { applied: true, deferred: false };
  }

  async rollbackManually(): Promise<void> {
    this.flushSaveFn();
    await this.assetCache.rollbackToPrevious();
    if (this.checkNativeAndroid()) {
      this.persistMeta({
        pendingApply: null,
        rollbackNotification: {
          failedVersion: this.state.currentVersion,
          recoveredToVersion: this.state.nativeVersion,
          reason: 'Manually restored bundled fallback version.',
          timestamp: new Date().toISOString(),
        },
      });
      await this.nativeUpdater.reset({ toLastSuccessful: true });
      return;
    }
    this.patchState({
      phase: 'rolled_back',
      statusMessage: 'Restored bundled offline assets.',
    });
  }

  dispose(): void {
    for (const remove of this.listenerRemovers) remove();
    this.listenerRemovers = [];
    this.listeners.clear();
  }
}

export const otaCoordinator = new OtaCoordinator();

export function useOtaUpdateState(): OtaUpdateState {
  return useSyncExternalStore(
    otaCoordinator.subscribe,
    otaCoordinator.getState,
    otaCoordinator.getState,
  );
}
