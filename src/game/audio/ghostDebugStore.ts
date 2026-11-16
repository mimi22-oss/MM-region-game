import { useSyncExternalStore } from 'react';
import { isGhostDevUiAvailable } from '../ghostConfig.ts';
import { getPerfSnapshot } from '../perfMetrics.ts';
import { getPlayerHomeBoundary, homeBoundaryDistance, HOME_RETREAT } from '../playerHomeProtection.ts';
import { getAudioDiagnosticsSnapshot } from './horrorAudioDiagnostics.ts';
import { GHOST_PERSONALITIES } from '../ghostPersonalities.ts';
import type { GhostAiSnapshot } from '../ghostAi.ts';

export interface GhostDebugEntry {
  ghostId: string;
  zoneId: string;
  personality: string;
  getSnapshot: () => GhostAiSnapshot | null;
  forceState: (next: any) => void;
  preloadAllClips: () => Promise<unknown>;
  getMicroTimings?: () => { aiMs: number; audioMs: number };
  getModelStatus?: () => 'ready' | 'loading' | 'failed' | 'armed';
  getInactivityReason?: () => string;
  getLastStateTransition?: () => { from: string; to: string; ageSec: number } | null;
}

export interface GhostTelemetryRecord {
  // 1. Identity & Lifecycle
  readonly ghostId: string;
  readonly personality: string;
  readonly mountStatus: 'ready' | 'loading' | 'failed' | 'armed';
  readonly inactivityReason: string;

  // 2. State & Sensing
  readonly state: string;
  readonly lastStateTransition: { from: string; to: string; ageSec: number } | null;
  readonly detectionRadiusM: number;
  readonly distToPlayerM: number;
  readonly playerDistDeltaM: number;
  readonly safeZoneStatus: 'outside' | 'inside-radius' | 'inside-buffer' | 'retreat-blocked';

  // 3. Movement & Navigation
  readonly targetPosition: { x: number; z: number };
  readonly targetWaypointId: string | null;
  readonly velocityMps: number;
  readonly pathfindingStatus: string;
  readonly pathWaypoints: readonly { x: number; z: number }[];
  readonly lastReplanAgeMs: number;
  readonly replanRatePerSec: number;

  // 4. Combat & Cooldowns
  readonly attackCooldown: { scareCooldownTimer: number; encounterCooldownTimer: number; grabPhase: string };
  readonly encounterStats: { encounterCount: number; chaseThreshold: number; scareTriggerCount: number; grabCount: number };

  // 5. Audio & Performance
  readonly lastAudioEvent: { cue: string | null; ageSec: number };
  readonly activeVoiceCount: { total: number; opus: number; synth: number };
  readonly audioContextState: string;
  readonly microTimings: { aiMs: number; audioMs: number };
  readonly fps: number;
  readonly frameMs: number;
}

export interface GhostDebugStoreSnapshot {
  readonly ghosts: readonly GhostTelemetryRecord[];
  readonly selectedGhostId: string | 'all';
  readonly gizmosEnabled: boolean;
  readonly overlayOpen: boolean;
  readonly activeGhostCount: number;
  readonly lastUpdatedMs: number;
}

// Global registry of ghost debug providers
const ghostRegistry = new Map<string, GhostDebugEntry>();

export function registerGhostDebugProvider(id: string, entry: GhostDebugEntry): void {
  ghostRegistry.set(id, entry);
  notifyStoreChanged();
}

export function unregisterGhostDebugProvider(id: string): void {
  ghostRegistry.delete(id);
  notifyStoreChanged();
}

// Previous samples for calculating deltas & rates
interface PreviousSample {
  distToPlayerM: number;
  replanCount: number;
  sampledAtMs: number;
}
const previousSamples = new Map<string, PreviousSample>();

// Store state
let selectedGhostId: string | 'all' = 'all';
let gizmosEnabled = true;
let overlayOpen = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('ghost') || params.has('ghostDebug') || params.get('ghost') === 'debug';
  } catch {
    return false;
  }
})();

const listeners = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | null = null;
let snapshotVersion = 0;
let cachedVersion = -1;
let cachedSnapshot: GhostDebugStoreSnapshot = createEmptySnapshot();

function createEmptySnapshot(): GhostDebugStoreSnapshot {
  return {
    ghosts: [],
    selectedGhostId,
    gizmosEnabled,
    overlayOpen,
    activeGhostCount: 0,
    lastUpdatedMs: Date.now(),
  };
}

function computeTelemetry(): GhostDebugStoreSnapshot {
  if (!isGhostDevUiAvailable()) {
    return createEmptySnapshot();
  }

  const nowMs = Date.now();
  const perf = getPerfSnapshot();
  const audioDiag = getAudioDiagnosticsSnapshot();
  const homeBoundary = getPlayerHomeBoundary();

  // Aggregate active voice breakdown
  let totalVoices = 0;
  for (const bus of Object.values(audioDiag.activeBuses)) {
    totalVoices += bus.activeVoices;
  }

  const ghostRecords: GhostTelemetryRecord[] = [];

  for (const [id, entry] of ghostRegistry) {
    const snap = entry.getSnapshot();
    const personality = entry.personality || 'hunter';
    const profileKey = personality.toLowerCase() as keyof typeof GHOST_PERSONALITIES;
    const profile = GHOST_PERSONALITIES[profileKey];
    const detectRadiusM = profile?.detectRadiusM ?? 25;

    // Previous sample for delta calculations
    const prev = previousSamples.get(id);
    const dtSec = prev ? Math.max(0.05, (nowMs - prev.sampledAtMs) / 1000) : 0.2;

    const currentDist = snap?.distToPlayerM ?? 999;
    const playerDistDeltaM = prev ? Math.round((currentDist - prev.distToPlayerM) * 10) / 10 : 0;

    const currentReplanCount = snap?.replanCount ?? 0;
    const replanRatePerSec = prev
      ? Math.round(Math.max(0, currentReplanCount - prev.replanCount) / dtSec * 10) / 10
      : 0;

    previousSamples.set(id, {
      distToPlayerM: currentDist,
      replanCount: currentReplanCount,
      sampledAtMs: nowMs,
    });

    // Safe zone status
    const ghostX = snap?.x ?? 0;
    const ghostZ = snap?.z ?? 0;
    const distToBoundary = homeBoundaryDistance(ghostX, ghostZ, homeBoundary);
    let safeZoneStatus: GhostTelemetryRecord['safeZoneStatus'] = 'outside';
    if (distToBoundary <= 0) {
      safeZoneStatus = 'inside-radius';
    } else if (distToBoundary <= HOME_RETREAT.buffer) {
      safeZoneStatus = 'inside-buffer';
    } else if (snap?.safeCooldown && snap.state === 'RETREAT') {
      safeZoneStatus = 'retreat-blocked';
    }

    // Pathfinding status
    let pathfindingStatus = 'idle';
    if (snap?.state === 'CHASING') {
      if (snap.directPath && snap.hasLineOfSight) {
        pathfindingStatus = 'direct-corridor';
      } else if (snap.pathQueue && snap.pathQueue.length > 0) {
        pathfindingStatus = `bfs-queue(${snap.pathQueue.length})`;
      } else {
        pathfindingStatus = 'blocked';
      }
    } else if (snap?.pathQueue && snap.pathQueue.length > 0) {
      pathfindingStatus = `patrol-queue(${snap.pathQueue.length})`;
    }

    const micro = entry.getMicroTimings?.() ?? { aiMs: 0, audioMs: 0 };
    const mountStatus = entry.getModelStatus?.() ?? (snap ? 'ready' : 'loading');
    const inactivityReason = entry.getInactivityReason?.() ?? (snap ? 'active' : 'loading');
    const lastTransition = entry.getLastStateTransition?.() ?? null;

    ghostRecords.push({
      ghostId: id,
      personality,
      mountStatus,
      inactivityReason,
      state: snap?.state ?? 'DORMANT',
      lastStateTransition: lastTransition,
      detectionRadiusM: detectRadiusM,
      distToPlayerM: Math.round(currentDist * 10) / 10,
      playerDistDeltaM,
      safeZoneStatus,
      targetPosition: { x: Math.round((snap?.targetX ?? 0) * 10) / 10, z: Math.round((snap?.targetZ ?? 0) * 10) / 10 },
      targetWaypointId: snap?.targetWaypointId ?? null,
      velocityMps: Math.round((snap?.chaseSpeed ?? 0) * 10) / 10,
      pathfindingStatus,
      pathWaypoints: snap?.pathWaypoints ? snap.pathWaypoints.map((w) => ({ x: w.x, z: w.z })) : [],
      lastReplanAgeMs: Math.round(Math.max(0, dtSec * 1000)),
      replanRatePerSec,
      attackCooldown: {
        scareCooldownTimer: Math.round((snap?.scareCooldownTimer ?? 0) * 10) / 10,
        encounterCooldownTimer: Math.round((snap?.encounterCooldownTimer ?? 0) * 10) / 10,
        grabPhase: snap?.grabInteraction?.phase ?? 'none',
      },
      encounterStats: {
        encounterCount: snap?.encounterCount ?? 0,
        chaseThreshold: snap?.chaseThreshold ?? 3,
        scareTriggerCount: snap?.scareTriggerCount ?? 0,
        grabCount: snap?.grabCount ?? 0,
      },
      lastAudioEvent: {
        cue: snap?.audioCue?.cue ?? null,
        ageSec: 0,
      },
      activeVoiceCount: {
        total: totalVoices,
        opus: audioDiag.warehouseZoneStatus.bedMode === 'opus' ? 2 : 0,
        synth: audioDiag.warehouseZoneStatus.bedMode === 'procedural' ? 1 : 0,
      },
      audioContextState: `${audioDiag.audioContextState} (Scheduled/Decoded/Graph-Active)`,
      microTimings: micro,
      fps: Math.round(perf.fps),
      frameMs: Math.round(perf.avgFrameMs * 10) / 10,
    });
  }

  return {
    ghosts: ghostRecords,
    selectedGhostId,
    gizmosEnabled,
    overlayOpen,
    activeGhostCount: ghostRecords.length,
    lastUpdatedMs: nowMs,
  };
}

function notifyStoreChanged(): void {
  snapshotVersion++;
  listeners.forEach((fn) => fn());
}

function startSamplingTimer(): void {
  if (timerId !== null) return;
  timerId = setInterval(() => {
    notifyStoreChanged();
  }, 200); // 5 Hz flush
}

function stopSamplingTimer(): void {
  if (timerId === null) return;
  clearInterval(timerId);
  timerId = null;
}

export function setSelectedGhostId(id: string | 'all'): void {
  if (selectedGhostId === id) return;
  selectedGhostId = id;
  notifyStoreChanged();
}

export function setGizmosEnabled(enabled: boolean): void {
  if (gizmosEnabled === enabled) return;
  gizmosEnabled = enabled;
  notifyStoreChanged();
}

export function setGhostDebugOverlayOpen(open: boolean): void {
  if (overlayOpen === open) return;
  overlayOpen = open;
  notifyStoreChanged();
}

export function toggleGhostDebugOverlay(): void {
  setGhostDebugOverlayOpen(!overlayOpen);
}

export function getGhostDebugSnapshot(): GhostDebugStoreSnapshot {
  if (cachedVersion !== snapshotVersion) {
    cachedSnapshot = computeTelemetry();
    cachedVersion = snapshotVersion;
  }
  return cachedSnapshot;
}

export function useGhostDebugStore(): GhostDebugStoreSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        startSamplingTimer();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stopSamplingTimer();
        }
      };
    },
    getGhostDebugSnapshot,
    getGhostDebugSnapshot,
  );
}
