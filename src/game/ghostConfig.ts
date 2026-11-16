import { useSyncExternalStore } from 'react';
import type { TimeMode } from './environmentTime.ts';

export const GHOST_DEV_STORAGE_KEY = 'mm-ghost-dev-settings-v1';

/**
 * Authoritative World Scene spawn / haunt origin captured at Warehouse Row (Myothar Area 5):
 * Area: သိုလှောင်ရုံတန်း · မြို့သာ နယ်မြေ (၅)
 */
export const GHOST_WAREHOUSE_ANCHOR = {
  areaName: 'သိုလှောင်ရုံတန်း · မြို့သာ နယ်မြေ (၅)',
  regionId: 'myothar',
  x: 35.149,
  z: 36.176,
  localU: -0.726,
  localV: 50.434,
  referenceFacingDeg: 337,
  referenceYawRad: 1.186194,
} as const;

export const GHOST_MODEL_URL = '/models/ghost-woman.glb';

/** Default autonomous night ghost count distributed across randomized haunt zones. */
export const DEFAULT_GHOST_COUNT = 3;

/** Minimum world distance (meters) preserved between randomly chosen simultaneous ghost anchors. */
export const GHOST_MIN_ZONE_SEPARATION_M = 125;

/** Target normalized rest height in meters (~2x Boy 1.80m / Girl 1.69m so crouched scary poses also tower clearly). */
export const GHOST_TARGET_HEIGHT_M = 3.6;

export interface GhostScheduleConfig {
  /** Inclusive start minute in local 24h day (18:00 = 1080). */
  readonly startMinute: number;
  /** Exclusive end minute in local 24h day (05:00 = 300). */
  readonly endMinute: number;
}

export const GHOST_SCHEDULE_CONFIG: GhostScheduleConfig = {
  startMinute: 18 * 60,
  endMinute: 5 * 60,
};

export interface GhostAiConfig {
  readonly chaseAccelerationMps2?:number;
  readonly observeBeforeChaseSec?:number;
  readonly patrolRadiusM: number;
  /** Distance from anchor/ghost at which lazy model loading begins when active. */
  readonly assetLoadDistanceM: number;
  /** Distance beyond which AI ticks suspend on mobile/desktop to save CPU. */
  readonly aiSuspendDistanceM: number;
  /** Distance beyond which rendered mesh hides cleanly. */
  readonly visibleDistanceM: number;
  /** Minimum spawn offset from active player so ghost materializes in cover rather than popping directly in front. */
  readonly minSpawnPlayerClearanceM: number;
  readonly spawnDurationSec: number;
  readonly despawnDurationSec: number;
  readonly hideDurationRangeSec: readonly [number, number];
  readonly observeDurationRangeSec: readonly [number, number];
  readonly scareDurationSec: number;
  readonly laughDurationSec: number;
  readonly scareFollowupLaughChance: number;
  readonly fleeDurationSec: number;
  readonly fallDurationSec: number;
  readonly fallTriggerChance: number;
  readonly cooldownDurationSec: number;
  readonly roadCrossCooldownRangeSec: readonly [number, number];
  readonly detectRadiusM: number;
  readonly closeScareRadiusM: number;
  readonly loseSightRadiusM: number;
  /** Proximity entry threshold that increments encounterCount when entering from outside. */
  readonly encounterEntryRadiusM: number;
  /** Larger proximity exit threshold (hysteresis) that must be cleared before the next encounter. */
  readonly encounterExitRadiusM: number;
  /** Minimum cooldown between consecutive encounters in a cycle. */
  readonly encounterCooldownSec: number;
  readonly wanderSpeedMps: number;
  readonly roadCrossSpeedMps: number;
  readonly fleeSpeedMps: number;
  readonly returnSpeedMps: number;
  readonly chaseSpeedMps: number;
  readonly chaseGiveUpDistanceM: number;
  readonly maxChaseDurationSec: number;
  readonly grabRangeM: number;
  readonly grabHoldDurationSec: number;
  readonly playerFallDurationSec: number;
  readonly recoverDurationSec: number;
  readonly turnRateRadPerSec: number;
  readonly vehicleSafetyDistanceM: number;
}

export const DEFAULT_GHOST_AI_CONFIG: GhostAiConfig = {
  patrolRadiusM: 68,
  assetLoadDistanceM: 118,
  aiSuspendDistanceM: 150,
  visibleDistanceM: 210,
  minSpawnPlayerClearanceM: 12,
  spawnDurationSec: 0.9,
  despawnDurationSec: 0.9,
  hideDurationRangeSec: [3.2, 6.5],
  observeDurationRangeSec: [1.1, 2.3],
  scareDurationSec: 1.45,
  laughDurationSec: 2.0,
  scareFollowupLaughChance: 0.52,
  fleeDurationSec: 4.5,
  fallDurationSec: 2.85,
  fallTriggerChance: 0.14,
  cooldownDurationSec: 13.5,
  roadCrossCooldownRangeSec: [15, 28],
  detectRadiusM: 22,
  closeScareRadiusM: 6.2,
  loseSightRadiusM: 28,
  encounterEntryRadiusM: 14,
  encounterExitRadiusM: 22,
  encounterCooldownSec: 4.0,
  // Matched to clip stride rates at ~3.68x base 0.977m rig scale
  wanderSpeedMps: 1.45,
  roadCrossSpeedMps: 4.5,
  fleeSpeedMps: 5.2,
  returnSpeedMps: 2.8,
  chaseSpeedMps: 5.6,
  chaseGiveUpDistanceM: 45,
  maxChaseDurationSec: 12,
  grabRangeM: 2.2,
  grabHoldDurationSec: 1.15,
  playerFallDurationSec: 3.15,
  recoverDurationSec: 2.4,
  turnRateRadPerSec: 7.5,
  vehicleSafetyDistanceM: 11.5,
};

/** Rolls an integer chase threshold between 2 and 6 inclusive once per encounter cycle. */
export function rollGhostChaseThreshold(randomFn: () => number = Math.random): number {
  const rolled = Math.floor(randomFn() * 5) + 2;
  return Math.max(2, Math.min(6, rolled));
}

export type GhostGrabPhase = 'none' | 'neck-grab' | 'player-fall';

export interface GhostEncounterInteractionState {
  active: boolean;
  phase: GhostGrabPhase;
  seq: number;
  ghostX: number;
  ghostZ: number;
  fallProgress: number;
}

const IDLE_GHOST_INTERACTION: GhostEncounterInteractionState = {
  active: false,
  phase: 'none',
  seq: 0,
  ghostX: GHOST_WAREHOUSE_ANCHOR.x,
  ghostZ: GHOST_WAREHOUSE_ANCHOR.z,
  fallProgress: 0,
};

const ghostInteractionByOwner = new Map<string, GhostEncounterInteractionState>();

export function setGhostEncounterInteraction(
  next: Readonly<GhostEncounterInteractionState>,
  ownerId = 'default',
): void {
  const prev = ghostInteractionByOwner.get(ownerId);
  if (prev) {
    prev.active = next.active;
    prev.phase = next.phase;
    prev.seq = next.seq;
    prev.ghostX = next.ghostX;
    prev.ghostZ = next.ghostZ;
    prev.fallProgress = next.fallProgress;
    return;
  }
  ghostInteractionByOwner.set(ownerId, {
    active: next.active,
    phase: next.phase,
    seq: next.seq,
    ghostX: next.ghostX,
    ghostZ: next.ghostZ,
    fallProgress: next.fallProgress,
  });
}

export function clearGhostEncounterInteraction(ownerId?: string): void {
  if (typeof ownerId === 'string') {
    ghostInteractionByOwner.delete(ownerId);
    return;
  }
  ghostInteractionByOwner.clear();
}

export function isOtherGhostGrabbingPlayer(ownerId: string): boolean {
  for (const [id, state] of ghostInteractionByOwner) {
    if (id !== ownerId && state.active) return true;
  }
  return false;
}

const activeGhostThreatOwners = new Set<string>();
const ghostThreatListeners = new Set<() => void>();

export function setGhostThreatActive(ownerId: string, active: boolean): void {
  const prevAny = activeGhostThreatOwners.size > 0;
  if (active) activeGhostThreatOwners.add(ownerId);
  else activeGhostThreatOwners.delete(ownerId);
  const nextAny = activeGhostThreatOwners.size > 0;
  if (prevAny !== nextAny) {
    for (const listener of ghostThreatListeners) listener();
  }
}

export function clearGhostThreat(ownerId?: string): void {
  const prevAny = activeGhostThreatOwners.size > 0;
  if (typeof ownerId === 'string') activeGhostThreatOwners.delete(ownerId);
  else activeGhostThreatOwners.clear();
  const nextAny = activeGhostThreatOwners.size > 0;
  if (prevAny !== nextAny) {
    for (const listener of ghostThreatListeners) listener();
  }
}

export function isAnyGhostThreatActive(): boolean {
  return activeGhostThreatOwners.size > 0;
}

export function useGhostThreatActive(): boolean {
  return useSyncExternalStore(
    (cb) => {
      ghostThreatListeners.add(cb);
      return () => ghostThreatListeners.delete(cb);
    },
    isAnyGhostThreatActive,
    isAnyGhostThreatActive,
  );
}

export interface ActiveGhostZoneMarker {
  readonly ghostId: string;
  readonly zoneId: string;
  readonly zoneName: string;
  readonly x: number;
  readonly z: number;
}

const EMPTY_GHOST_ZONES: readonly ActiveGhostZoneMarker[] = [];
let activeGhostZonesSnapshot: readonly ActiveGhostZoneMarker[] = EMPTY_GHOST_ZONES;
const activeGhostZoneListeners = new Set<() => void>();

export function setActiveGhostZones(zones: readonly ActiveGhostZoneMarker[]): void {
  const next = zones.length === 0 ? EMPTY_GHOST_ZONES : zones.map((z) => ({ ...z }));
  const unchanged =
    next.length === activeGhostZonesSnapshot.length &&
    next.every((item, idx) => {
      const prev = activeGhostZonesSnapshot[idx];
      return (
        prev.ghostId === item.ghostId &&
        prev.zoneId === item.zoneId &&
        prev.x === item.x &&
        prev.z === item.z
      );
    });
  if (unchanged) return;
  activeGhostZonesSnapshot = next;
  for (const listener of activeGhostZoneListeners) listener();
}

export function getActiveGhostZones(): readonly ActiveGhostZoneMarker[] {
  return activeGhostZonesSnapshot;
}

export function useActiveGhostZones(): readonly ActiveGhostZoneMarker[] {
  return useSyncExternalStore(
    (cb) => {
      activeGhostZoneListeners.add(cb);
      return () => activeGhostZoneListeners.delete(cb);
    },
    getActiveGhostZones,
    getActiveGhostZones,
  );
}

export function getGhostEncounterInteraction(): Readonly<GhostEncounterInteractionState> {
  let fallback: GhostEncounterInteractionState | null = null;
  for (const state of ghostInteractionByOwner.values()) {
    if (state.active) return state;
    if (!fallback) fallback = state;
  }
  return fallback ?? IDLE_GHOST_INTERACTION;
}

export interface GhostDevSettings {
  forceActive: boolean;
  showDebugHud: boolean;
}

function readInitialDevSettings(): GhostDevSettings {
  const defaults: GhostDevSettings = { forceActive: false, showDebugHud: false };
  if (typeof window === 'undefined') return defaults;

  let forceFromQuery = false;
  let debugFromQuery = false;
  try {
    const params = new URLSearchParams(window.location.search);
    const ghostParam = (params.get('ghost') ?? '').toLowerCase();
    forceFromQuery = ghostParam === '1' || ghostParam === 'true' || ghostParam === 'force';
    debugFromQuery = ghostParam === 'debug' || params.get('ghostDebug') === '1';
    if (debugFromQuery) forceFromQuery = true;
  } catch {
    // Ignore malformed query string
  }

  try {
    const raw = window.localStorage?.getItem(GHOST_DEV_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GhostDevSettings> | null;
      return {
        forceActive: forceFromQuery || Boolean(parsed?.forceActive),
        showDebugHud: debugFromQuery || Boolean(parsed?.showDebugHud),
      };
    }
  } catch {
    // Ignore storage read errors in restricted WebViews
  }

  return {
    forceActive: forceFromQuery,
    showDebugHud: debugFromQuery,
  };
}

let devSnapshot: GhostDevSettings = readInitialDevSettings();
const devListeners = new Set<() => void>();

function emitDevSettings() {
  for (const listener of devListeners) listener();
}

function persistDevSettings(next: GhostDevSettings) {
  devSnapshot = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(GHOST_DEV_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota/privacy failures
  }
  emitDevSettings();
}

export function getGhostDevSettings(): GhostDevSettings {
  return devSnapshot;
}

export function setGhostDevForceActive(forceActive: boolean, showDebugHud?: boolean): void {
  persistDevSettings({
    forceActive: Boolean(forceActive),
    showDebugHud: showDebugHud ?? devSnapshot.showDebugHud,
  });
}

export function setGhostDevDebugHud(showDebugHud: boolean): void {
  persistDevSettings({
    ...devSnapshot,
    showDebugHud: Boolean(showDebugHud),
  });
}

export function useGhostDevSettings(): GhostDevSettings {
  return useSyncExternalStore(
    (cb) => {
      devListeners.add(cb);
      return () => devListeners.delete(cb);
    },
    getGhostDevSettings,
    getGhostDevSettings,
  );
}

/** Exposes dev controls cleanly only in Vite DEV or explicit dev/ghost query sessions. */
export function isGhostDevUiAvailable(): boolean {
  try {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) return true;
  } catch {
    // Node fallback
  }
  if (typeof window === 'undefined') {
    return devSnapshot.forceActive || devSnapshot.showDebugHud;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has('dev') ||
      params.has('ghost') ||
      params.has('ghostDebug') ||
      params.has('diag') ||
      devSnapshot.forceActive ||
      devSnapshot.showDebugHud
    );
  } catch {
    return devSnapshot.forceActive;
  }
}

/**
 * Evaluates whether current game time falls inside the Night Ghost window [18:00, 05:00),
 * or whether manual night override / dev testing forces activation.
 */
export function isGhostNightActive(
  minute: number,
  options?: {
    timeMode?: TimeMode;
    schedule?: GhostScheduleConfig;
    forceActive?: boolean;
  },
): boolean {
  if (options?.forceActive) return true;
  if (options?.timeMode === 'night') return true;
  if (
    options?.timeMode === 'day' ||
    options?.timeMode === 'morning' ||
    options?.timeMode === 'evening'
  ) {
    return false;
  }

  const schedule = options?.schedule ?? GHOST_SCHEDULE_CONFIG;
  const wrapped = ((minute % 1440) + 1440) % 1440;
  if (schedule.startMinute > schedule.endMinute) {
    return wrapped >= schedule.startMinute || wrapped < schedule.endMinute;
  }
  return wrapped >= schedule.startMinute && wrapped < schedule.endMinute;
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__GHOST_DEV__ = {
    getState: getGhostDevSettings,
    setForceActive: setGhostDevForceActive,
    setDebugHud: setGhostDevDebugHud,
    isNightWindow: (minute: number, timeMode?: TimeMode) =>
      isGhostNightActive(minute, { timeMode, forceActive: devSnapshot.forceActive }),
  };
}
