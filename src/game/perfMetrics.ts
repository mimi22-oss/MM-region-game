import { useSyncExternalStore } from 'react';
import { getStreamedChunkStats } from './streamedChunkRegistry.ts';
import { sharedStreamedAssetPool } from './streamedAssetPool.ts';
import { startupDiagnostics, type StartupSummary } from './startupDiagnostics.ts';
import { APP_NATIVE_BASELINE, type OtaChannel } from './otaCompatibility.ts';

export interface PerfMetricsSnapshot {
  fps: number;
  avgFrameMs: number;
  dpr: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  heapUsedMb: number | null;
  platform: 'android' | 'ios' | 'web';
  updatedAt: number;
  minFps?: number;
  p1Fps?: number;
  p5Fps?: number;
  p50Fps?: number;
  p95FrameMs?: number;
  p99FrameMs?: number;
  maxFrameMs?: number;
  residentChunks?: number;
  buildingColliders?: number;
  poolGeometries?: number;
  poolMaterials?: number;
  sampleCount?: number;
}

export interface PerfBaselineSummary {
  sessionStartedAt: string;
  durationSec: number;
  sampleCount: number;
  frameSampleCount: number;
  fps: {
    current: number;
    avg: number;
    min: number;
    p1: number;
    p5: number;
    p50: number;
  };
  frameMs: {
    currentAvg: number;
    p95: number;
    p99: number;
    max: number;
  };
  dpr: number;
  dprAdaptations: number;
  drawCalls: number;
  maxDrawCalls: number;
  triangles: number;
  maxTriangles: number;
  geometries: number;
  textures: number;
  heapUsedMb: number | null;
  peakHeapUsedMb: number | null;
}

export interface AndroidBaselineReport {
  schemaVersion: number;
  recordedAt: string;
  platform: 'android' | 'ios' | 'web';
  environment: {
    userAgent: string | null;
    viewport: { width: number; height: number; dpr: number } | null;
    hardwareConcurrency: number | null;
    deviceMemoryGb: number | null;
    online: boolean | null;
  };
  app: {
    appId: string;
    nativeVersion: string;
    androidVersionCode: number;
    currentVersion: string;
    channel: OtaChannel;
    activeBundleId: string;
    activeAssetVersion: string | null;
  };
  startup: StartupSummary;
  steadyState: PerfBaselineSummary;
  streamedWorld: ReturnType<typeof getStreamedChunkStats>;
  assetPool: ReturnType<typeof sharedStreamedAssetPool.getStats>;
  offlineStorage: {
    backend: string;
    persisted: boolean | null;
    usedBytes: number;
    quotaBytes: number | null;
    cachedPacks: Array<{
      id: string;
      activeVersion: string | null;
      previousVersion: string | null;
      totalBytes: number;
      fileCount: number;
    }>;
  };
  measurementNote: string;
}

const MAX_FPS_SAMPLES = 900;
const MAX_FRAME_SAMPLES = 512;

const fpsRing = new Float32Array(MAX_FPS_SAMPLES);
let fpsWriteIdx = 0;
let fpsFilled = 0;
let fpsSum = 0;
let fpsMin = Infinity;

const frameMsRing = new Float64Array(MAX_FRAME_SAMPLES);
let frameWriteIdx = 0;
let frameFilled = 0;
let frameMaxMs = 0;

let sessionStartedMs = Date.now();
let peakHeapUsedMb: number | null = null;
let maxDrawCalls = 0;
let maxTriangles = 0;
let dprAdaptations = 0;

let snapshot: PerfMetricsSnapshot = {
  fps: 0,
  avgFrameMs: 0,
  dpr: 1,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  heapUsedMb: null,
  platform: 'web',
  updatedAt: 0,
};

const listeners = new Set<() => void>();

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function computePercentile(ring: Float32Array | Float64Array, count: number, percentile01: number): number {
  if (count <= 0) return 0;
  const copy = new Float64Array(count);
  for (let i = 0; i < count; i++) copy[i] = ring[i];
  copy.sort();
  const idx = Math.min(count - 1, Math.max(0, Math.floor((count - 1) * percentile01)));
  return round1(copy[idx]);
}

/** Records a rendered frame duration (milliseconds) using a fixed ring buffer for p95/p99 latency stats. */
export function recordFrameSample(frameMs: number): void {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return;
  frameMsRing[frameWriteIdx] = frameMs;
  frameWriteIdx = (frameWriteIdx + 1) % MAX_FRAME_SAMPLES;
  if (frameFilled < MAX_FRAME_SAMPLES) frameFilled += 1;
  if (frameMs > frameMaxMs) frameMaxMs = frameMs;
}

export function recordDprAdaptation(_nextDpr: number): void {
  dprAdaptations += 1;
}

export function resetPerfBaseline(): void {
  fpsRing.fill(0);
  fpsWriteIdx = 0;
  fpsFilled = 0;
  fpsSum = 0;
  fpsMin = Infinity;
  frameMsRing.fill(0);
  frameWriteIdx = 0;
  frameFilled = 0;
  frameMaxMs = 0;
  sessionStartedMs = Date.now();
  peakHeapUsedMb = snapshot.heapUsedMb;
  maxDrawCalls = snapshot.drawCalls;
  maxTriangles = snapshot.triangles;
  dprAdaptations = 0;
}

export function getPerfBaselineSummary(): PerfBaselineSummary {
  const durationSec = Math.max(0, Math.round((Date.now() - sessionStartedMs) / 1000));
  const avgFps = fpsFilled > 0 ? round1(fpsSum / fpsFilled) : round1(snapshot.fps);
  const minFps = fpsFilled > 0 && Number.isFinite(fpsMin) ? round1(fpsMin) : round1(snapshot.fps);

  return {
    sessionStartedAt: new Date(sessionStartedMs).toISOString(),
    durationSec,
    sampleCount: fpsFilled,
    frameSampleCount: frameFilled,
    fps: {
      current: snapshot.fps,
      avg: avgFps,
      min: minFps,
      p1: computePercentile(fpsRing, fpsFilled, 0.01),
      p5: computePercentile(fpsRing, fpsFilled, 0.05),
      p50: computePercentile(fpsRing, fpsFilled, 0.5),
    },
    frameMs: {
      currentAvg: snapshot.avgFrameMs,
      p95: computePercentile(frameMsRing, frameFilled, 0.95),
      p99: computePercentile(frameMsRing, frameFilled, 0.99),
      max: round1(frameMaxMs),
    },
    dpr: snapshot.dpr,
    dprAdaptations,
    drawCalls: snapshot.drawCalls,
    maxDrawCalls,
    triangles: snapshot.triangles,
    maxTriangles,
    geometries: snapshot.geometries,
    textures: snapshot.textures,
    heapUsedMb: snapshot.heapUsedMb,
    peakHeapUsedMb,
  };
}

export function getPerfSnapshot(): PerfMetricsSnapshot {
  return snapshot;
}

export function publishPerfSnapshot(next: PerfMetricsSnapshot): void {
  if (Number.isFinite(next.fps) && next.fps > 0) {
    if (fpsFilled >= MAX_FPS_SAMPLES) {
      fpsSum -= fpsRing[fpsWriteIdx];
    } else {
      fpsFilled += 1;
    }
    fpsRing[fpsWriteIdx] = next.fps;
    fpsSum += next.fps;
    fpsWriteIdx = (fpsWriteIdx + 1) % MAX_FPS_SAMPLES;
    if (next.fps < fpsMin) fpsMin = next.fps;
  }

  if (next.heapUsedMb !== null && (peakHeapUsedMb === null || next.heapUsedMb > peakHeapUsedMb)) {
    peakHeapUsedMb = next.heapUsedMb;
  }
  if (next.drawCalls > maxDrawCalls) maxDrawCalls = next.drawCalls;
  if (next.triangles > maxTriangles) maxTriangles = next.triangles;

  const summary = getPerfBaselineSummary();
  const enriched: PerfMetricsSnapshot = {
    ...next,
    minFps: next.minFps ?? summary.fps.min,
    p1Fps: next.p1Fps ?? summary.fps.p1,
    p5Fps: next.p5Fps ?? summary.fps.p5,
    p50Fps: next.p50Fps ?? summary.fps.p50,
    p95FrameMs: next.p95FrameMs ?? summary.frameMs.p95,
    p99FrameMs: next.p99FrameMs ?? summary.frameMs.p99,
    maxFrameMs: next.maxFrameMs ?? summary.frameMs.max,
    sampleCount: summary.sampleCount,
  };

  snapshot = enriched;
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      __MM_PERF__?: PerfMetricsSnapshot;
      __MM_PERF_EXPORT__?: () => AndroidBaselineReport;
    };
    win.__MM_PERF__ = enriched;
    win.__MM_PERF_EXPORT__ = () => buildAndroidBaselineReport();
  }
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribePerfSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePerfSnapshot(): PerfMetricsSnapshot {
  return useSyncExternalStore(subscribePerfSnapshot, getPerfSnapshot, getPerfSnapshot);
}

export function buildAndroidBaselineReport(context?: {
  nativeVersion?: string;
  androidVersionCode?: number;
  currentVersion?: string;
  channel?: OtaChannel;
  activeBundleId?: string;
  activeAssetVersion?: string | null;
  online?: boolean;
  storageBackend?: string;
  persisted?: boolean | null;
  usedBytes?: number;
  quotaBytes?: number | null;
  cachedPacks?: Array<{
    id: string;
    activeVersion: string | null;
    previousVersion: string | null;
    totalBytes: number;
    fileCount: number;
  }>;
}): AndroidBaselineReport {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : null;
  const win = typeof window !== 'undefined' ? window : null;

  return {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    platform: snapshot.platform,
    environment: {
      userAgent: nav?.userAgent ?? null,
      viewport: win
        ? { width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio ?? 1 }
        : null,
      hardwareConcurrency: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
      deviceMemoryGb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
      online: context?.online ?? (typeof nav?.onLine === 'boolean' ? nav.onLine : null),
    },
    app: {
      appId: APP_NATIVE_BASELINE.appId,
      nativeVersion: context?.nativeVersion ?? APP_NATIVE_BASELINE.nativeVersion,
      androidVersionCode: context?.androidVersionCode ?? APP_NATIVE_BASELINE.androidVersionCode,
      currentVersion: context?.currentVersion ?? APP_NATIVE_BASELINE.nativeVersion,
      channel: context?.channel ?? 'production',
      activeBundleId: context?.activeBundleId ?? 'builtin',
      activeAssetVersion: context?.activeAssetVersion ?? null,
    },
    startup: startupDiagnostics.getStartupSummary(),
    steadyState: getPerfBaselineSummary(),
    streamedWorld: getStreamedChunkStats(),
    assetPool: sharedStreamedAssetPool.getStats(),
    offlineStorage: {
      backend: context?.storageBackend ?? 'unknown',
      persisted: context?.persisted ?? null,
      usedBytes: context?.usedBytes ?? 0,
      quotaBytes: context?.quotaBytes ?? null,
      cachedPacks: context?.cachedPacks ?? [],
    },
    measurementNote:
      snapshot.platform === 'android'
        ? 'Captured inside native Android Capacitor WebView runtime.'
        : 'Captured on web/browser runtime; install and export from physical Android APK for device FPS & thermals.',
  };
}
