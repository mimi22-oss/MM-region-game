import { useSyncExternalStore } from 'react';

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
}

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

export function getPerfSnapshot(): PerfMetricsSnapshot {
  return snapshot;
}

export function publishPerfSnapshot(next: PerfMetricsSnapshot): void {
  snapshot = next;
  if (typeof window !== 'undefined') {
    (window as unknown as { __MM_PERF__?: PerfMetricsSnapshot }).__MM_PERF__ = next;
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
