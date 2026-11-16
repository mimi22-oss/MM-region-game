import { gameAudio } from '../gameAudio.ts';
import {
  HORROR_AUDIO_DESCRIPTORS,
  detectOpusPlaybackSupport,
  resolveHorrorAudioUrl,
  validateHorrorAudioManifest,
  type HorrorAudioAssetEntry,
  type HorrorAudioId,
  type HorrorAudioManifest,
  type OpusSupportStatus,
} from './HorrorAudioRegistry.ts';

export interface HorrorAudioAssetLoadState {
  readonly id: HorrorAudioId;
  readonly url: string;
  readonly status: 'idle' | 'loading' | 'decoded' | 'buffered-raw' | 'failed' | 'unsupported';
  readonly error: string | null;
}

export interface HorrorAudioLoaderDiagnostics {
  readonly manifestStatus: 'idle' | 'loading' | 'loaded' | 'error';
  readonly manifestVersion: string | null;
  readonly manifestError: string | null;
  readonly opusSupport: OpusSupportStatus;
  readonly loadedCount: number;
  readonly pendingCount: number;
  readonly failedCount: number;
  readonly loadedIds: readonly HorrorAudioId[];
  readonly lastError: string | null;
  readonly currentFile: string | null;
}

export interface HorrorAudioLoaderOptions {
  readonly baseUrl?: string;
  readonly fetcher?: (url: string) => Promise<Response>;
  readonly getAudioContext?: () => AudioContext | null;
  readonly decodeAudioData?: (ctx: AudioContext, bytes: ArrayBuffer) => Promise<AudioBuffer>;
  readonly detectOpus?: () => OpusSupportStatus;
  readonly retryCooldownMs?: number;
}

const DEFAULT_RETRY_COOLDOWN_MS = 15_000;

/**
 * Builds an equal-power loop seam at the end of a decoded ambient buffer so
 * approximate Opus loops crossfade without clicks or timer jitter.
 */
export function createSeamlessLoopBuffer(
  ctx: AudioContext,
  source: AudioBuffer,
  seamSeconds = 0.35,
): { buffer: AudioBuffer; loopStartSec: number; loopEndSec: number } {
  const length = source.length;
  const sampleRate = source.sampleRate || ctx.sampleRate || 48000;
  const seamSamples = Math.min(Math.floor(length / 4), Math.floor(sampleRate * seamSeconds));
  if (seamSamples < 64 || typeof ctx.createBuffer !== 'function') {
    return { buffer: source, loopStartSec: 0, loopEndSec: source.duration };
  }

  const copy = ctx.createBuffer(source.numberOfChannels, length, sampleRate);
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const input = source.getChannelData(ch);
    const out = copy.getChannelData(ch);
    out.set(input);
    for (let i = 0; i < seamSamples; i++) {
      const k = length - seamSamples + i;
      const angle = (i / seamSamples) * Math.PI * 0.5;
      out[k] = input[k] * Math.cos(angle) + input[i] * Math.sin(angle);
    }
  }

  return {
    buffer: copy,
    loopStartSec: seamSamples / sampleRate,
    loopEndSec: copy.duration,
  };
}

export class HorrorAudioAssetLoader {
  private readonly baseUrl?: string;
  private readonly customFetcher?: (url: string) => Promise<Response>;
  private readonly getAudioContext: () => AudioContext | null;
  private readonly customDecoder?: (ctx: AudioContext, bytes: ArrayBuffer) => Promise<AudioBuffer>;
  private readonly detectOpusFn: () => OpusSupportStatus;
  private readonly retryCooldownMs: number;

  private manifest: HorrorAudioManifest | null = null;
  private manifestStatus: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';
  private manifestError: string | null = null;
  private manifestPromise: Promise<HorrorAudioManifest | null> | null = null;

  private decodedBuffers = new Map<HorrorAudioId, AudioBuffer>();
  private loopBuffers = new Map<HorrorAudioId, { buffer: AudioBuffer; loopStartSec: number; loopEndSec: number }>();
  private rawBytes = new Map<HorrorAudioId, ArrayBuffer>();
  private inFlight = new Map<HorrorAudioId, Promise<AudioBuffer | null>>();
  private inFlightBytes = new Map<HorrorAudioId, Promise<ArrayBuffer | null>>();
  private assetErrors = new Map<HorrorAudioId, { message: string; retryAfterMs: number; permanent: boolean }>();
  private opusStatus: OpusSupportStatus | null = null;
  private lastError: string | null = null;
  private currentFile: string | null = null;

  constructor(options: HorrorAudioLoaderOptions = {}) {
    this.baseUrl = options.baseUrl;
    this.customFetcher = options.fetcher;
    this.getAudioContext = options.getAudioContext ?? (() => gameAudio.context);
    this.customDecoder = options.decodeAudioData;
    this.detectOpusFn = options.detectOpus ?? detectOpusPlaybackSupport;
    this.retryCooldownMs = options.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS;
  }

  private getFetch(): ((url: string) => Promise<Response>) | null {
    if (this.customFetcher) return this.customFetcher;
    if (typeof fetch === 'function') return (url: string) => fetch(url);
    return null;
  }

  getOpusSupport(): OpusSupportStatus {
    this.opusStatus ??= this.detectOpusFn();
    return this.opusStatus;
  }

  private markOpusDecodeResult(ok: boolean, detail?: string): void {
    const base = this.getOpusSupport();
    this.opusStatus = {
      ...base,
      supported: ok ? true : false,
      runtimeDecodeOk: ok,
      method: ok ? 'decode-verified' : 'decode-failed',
      detail: detail ?? (ok ? 'Opus Web Audio decode verified' : base.detail),
    };
  }

  resolveAssetUrl(id: HorrorAudioId): string {
    const manifestEntry = this.manifest?.assets.find((a) => a.id === id);
    const relative = manifestEntry?.file ?? HORROR_AUDIO_DESCRIPTORS[id].file;
    return resolveHorrorAudioUrl(relative, this.baseUrl);
  }

  getRelativePath(id: HorrorAudioId): string {
    const manifestEntry = this.manifest?.assets.find((a) => a.id === id);
    return manifestEntry?.file ?? HORROR_AUDIO_DESCRIPTORS[id].file;
  }

  getManifestEntry(id: HorrorAudioId): HorrorAudioAssetEntry | null {
    return this.manifest?.assets.find((a) => a.id === id) ?? null;
  }

  async loadManifest(): Promise<HorrorAudioManifest | null> {
    if (this.manifest) return this.manifest;
    if (this.manifestPromise) return this.manifestPromise;

    const fetcher = this.getFetch();
    if (!fetcher) {
      this.manifestStatus = 'error';
      this.manifestError = 'fetch API unavailable in this environment';
      this.lastError = this.manifestError;
      return null;
    }

    this.manifestStatus = 'loading';
    this.manifestPromise = (async () => {
      try {
        const url = resolveHorrorAudioUrl('manifest.json', this.baseUrl);
        const res = await fetcher(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} loading horror audio manifest`);
        }
        const json = await res.json();
        const validated = validateHorrorAudioManifest(json);
        this.manifest = validated;
        this.manifestStatus = 'loaded';
        this.manifestError = null;
        return validated;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.manifestStatus = 'error';
        this.manifestError = msg;
        this.lastError = msg;
        return null;
      } finally {
        this.manifestPromise = null;
      }
    })();

    return this.manifestPromise;
  }

  getCachedBuffer(id: HorrorAudioId): AudioBuffer | null {
    return this.decodedBuffers.get(id) ?? null;
  }

  getSeamlessLoopBuffer(id: HorrorAudioId): { buffer: AudioBuffer; loopStartSec: number; loopEndSec: number } | null {
    const existing = this.loopBuffers.get(id);
    if (existing) return existing;
    const raw = this.decodedBuffers.get(id);
    const ctx = this.getAudioContext();
    if (!raw || !ctx) return null;
    const seamless = createSeamlessLoopBuffer(ctx, raw, 0.35);
    this.loopBuffers.set(id, seamless);
    return seamless;
  }

  private async fetchRawBytes(id: HorrorAudioId): Promise<ArrayBuffer | null> {
    const cachedRaw = this.rawBytes.get(id);
    if (cachedRaw) return cachedRaw;

    const existingPromise = this.inFlightBytes.get(id);
    if (existingPromise) return existingPromise;

    const errState = this.assetErrors.get(id);
    if (errState && (errState.permanent || Date.now() < errState.retryAfterMs)) {
      return null;
    }

    const fetcher = this.getFetch();
    if (!fetcher) {
      this.lastError = 'fetch API unavailable';
      return null;
    }

    const req = (async () => {
      try {
        if (!this.manifest && this.manifestStatus === 'idle') {
          await this.loadManifest();
        }
        const url = this.resolveAssetUrl(id);
        this.currentFile = this.getRelativePath(id);
        const res = await fetcher(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${this.getRelativePath(id)}`);
        }
        const buf = await res.arrayBuffer();
        if (!buf || buf.byteLength === 0) {
          throw new Error(`Empty audio payload for ${this.getRelativePath(id)}`);
        }
        this.rawBytes.set(id, buf);
        this.assetErrors.delete(id);
        return buf;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.lastError = msg;
        this.assetErrors.set(id, {
          message: msg,
          retryAfterMs: Date.now() + this.retryCooldownMs,
          permanent: false,
        });
        return null;
      } finally {
        this.inFlightBytes.delete(id);
      }
    })();

    this.inFlightBytes.set(id, req);
    return req;
  }

  /**
   * Lazily fetches raw audio (and decodes immediately if AudioContext exists) without blocking gameplay.
   * Safe before user-gesture unlock: bytes are held once and decoded once AudioContext unlocks.
   */
  async preload(ids: readonly HorrorAudioId[]): Promise<void> {
    if (ids.length === 0) return;
    const support = this.getOpusSupport();
    if (!support.supported) {
      return;
    }
    await Promise.all(
      ids.map(async (id) => {
        if (this.decodedBuffers.has(id)) return;
        const ctx = this.getAudioContext();
        if (ctx) {
          await this.loadBuffer(id);
        } else {
          await this.fetchRawBytes(id);
        }
      }),
    );
  }

  async loadBuffer(id: HorrorAudioId): Promise<AudioBuffer | null> {
    const cached = this.decodedBuffers.get(id);
    if (cached) return cached;

    const pending = this.inFlight.get(id);
    if (pending) return pending;

    const support = this.getOpusSupport();
    if (!support.supported) {
      this.assetErrors.set(id, {
        message: support.detail,
        retryAfterMs: Infinity,
        permanent: true,
      });
      this.lastError = support.detail;
      return null;
    }

    const errState = this.assetErrors.get(id);
    if (errState && (errState.permanent || Date.now() < errState.retryAfterMs)) {
      return null;
    }

    const ctx = this.getAudioContext();
    if (!ctx) {
      // Allow pre-fetch of raw bytes without prematurely creating an AudioContext.
      await this.fetchRawBytes(id);
      return null;
    }

    const req = (async () => {
      try {
        const bytes = await this.fetchRawBytes(id);
        if (!bytes) return null;

        this.currentFile = this.getRelativePath(id);
        // Clone ArrayBuffer before decodeAudioData because standard Web Audio detaches the passed buffer.
        const sliceForDecode = bytes.slice(0);
        const decoded = this.customDecoder
          ? await this.customDecoder(ctx, sliceForDecode)
          : await ctx.decodeAudioData(sliceForDecode);

        if (!decoded || decoded.length === 0) {
          throw new Error(`Decoded empty AudioBuffer for ${this.getRelativePath(id)}`);
        }

        this.decodedBuffers.set(id, decoded);
        this.rawBytes.delete(id);
        this.assetErrors.delete(id);
        this.markOpusDecodeResult(true, `Verified via decodeAudioData (${this.getRelativePath(id)})`);
        return decoded;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const decodeFailure = /decode|encoding|codec|unsupported/i.test(msg);
        this.lastError = `${this.getRelativePath(id)}: ${msg}`;
        this.assetErrors.set(id, {
          message: this.lastError,
          retryAfterMs: decodeFailure ? Infinity : Date.now() + this.retryCooldownMs,
          permanent: decodeFailure,
        });
        if (decodeFailure) {
          this.markOpusDecodeResult(false, `decodeAudioData failed (${this.getRelativePath(id)}): ${msg}`);
        }
        return null;
      } finally {
        this.inFlight.delete(id);
      }
    })();

    this.inFlight.set(id, req);
    return req;
  }

  /** Decodes any already-fetched raw bytes once AudioContext becomes available after user gesture. */
  async decodeBufferedAssets(): Promise<void> {
    if (this.rawBytes.size === 0 || !this.getAudioContext()) return;
    await Promise.all([...this.rawBytes.keys()].map((id) => this.loadBuffer(id)));
  }

  recordPlaybackFile(file: string): void {
    this.currentFile = file;
  }

  recordError(error: string): void {
    this.lastError = error;
  }

  getAssetState(id: HorrorAudioId): HorrorAudioAssetLoadState {
    const url = this.resolveAssetUrl(id);
    if (this.decodedBuffers.has(id)) {
      return { id, url, status: 'decoded', error: null };
    }
    if (this.inFlight.has(id) || this.inFlightBytes.has(id)) {
      return { id, url, status: 'loading', error: null };
    }
    if (this.rawBytes.has(id)) {
      return { id, url, status: 'buffered-raw', error: null };
    }
    const support = this.getOpusSupport();
    if (!support.supported) {
      return { id, url, status: 'unsupported', error: support.detail };
    }
    const err = this.assetErrors.get(id);
    if (err) {
      return { id, url, status: 'failed', error: err.message };
    }
    return { id, url, status: 'idle', error: null };
  }

  getDiagnostics(): HorrorAudioLoaderDiagnostics {
    return {
      manifestStatus: this.manifestStatus,
      manifestVersion: this.manifest?.version ?? null,
      manifestError: this.manifestError,
      opusSupport: this.getOpusSupport(),
      loadedCount: this.decodedBuffers.size,
      pendingCount: this.inFlight.size + this.inFlightBytes.size,
      failedCount: this.assetErrors.size,
      loadedIds: [...this.decodedBuffers.keys()],
      lastError: this.lastError,
      currentFile: this.currentFile,
    };
  }

  reset(): void {
    this.decodedBuffers.clear();
    this.loopBuffers.clear();
    this.rawBytes.clear();
    this.inFlight.clear();
    this.inFlightBytes.clear();
    this.assetErrors.clear();
    this.lastError = null;
    this.currentFile = null;
    this.manifest = null;
    this.manifestStatus = 'idle';
    this.manifestError = null;
    this.manifestPromise = null;
    this.opusStatus = null;
  }
}

export const sharedHorrorAssetLoader = new HorrorAudioAssetLoader();
