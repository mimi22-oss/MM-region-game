import { useSyncExternalStore } from 'react';
import {
  BALLOON_PALETTE,
  VILLAGE_LAUNCH_HUBS,
  type VillageLaunchHub,
} from '../game/fireBalloonModel.ts';
import { BALLOON_LAUNCH } from '../game/balloonRide.ts';
import { setThadingyutFestivalActive } from '../game/thadingyutFestival.ts';

/**
 * Tazaungdaing Festival Official Event Window:
 * November 15, 2026 through November 24, 2026 (inclusive, local calendar date).
 */
export const TAZAUNGDAING_START_DATE = '2026-11-15';
export const TAZAUNGDAING_END_DATE = '2026-11-24';
export const FESTIVAL_CONFIG_STORAGE_KEY = 'mm-festival-configuration-v1';

export type FestivalScheduleMode = 'auto' | 'manual';

export interface CustomFestivalZone {
  x: number;
  z: number;
  groundY: number;
  spreadRadius: number;
}

export interface FestivalConfigurationState {
  /** Master enable flag when scheduleMode === 'manual', or current effective override. */
  enabled: boolean;
  /** 'auto' activates automatically during 2026-11-15..2026-11-24; 'manual' uses `enabled`. */
  scheduleMode: FestivalScheduleMode;
  /** ID of the registered festival plugin to run when active. */
  activeFestivalId: string;
  /** 'all' | 'myothar' | village hub id | 'custom' */
  activeZoneId: string;
  /** Configurable custom event zone coordinates and radius. */
  customZone: CustomFestivalZone;
  /** Number of decorative balloons launched per active zone (clamped for performance). */
  balloonsPerZone: number;
  /** Whether ground festival arches, lantern garlands, and display balloons are shown. */
  decorationsEnabled: boolean;
  /** Allow decorative balloon launch show during daytime for admin previewing. */
  allowDaytimePreview: boolean;
  /** Deterministic simulation seed for decorative balloon trajectories. */
  seed: number;
}

/**
 * Built-in Myothar Town Festival Ground hub (centered near the football field launch ground).
 */
export const MYOTHAR_FESTIVAL_HUB: VillageLaunchHub = {
  id: 'myothar',
  name: 'Myothar Festival Ground',
  myanmarName: 'မြို့သာ ပွဲတော်ကွင်း',
  x: BALLOON_LAUNCH.x,
  z: BALLOON_LAUNCH.z,
  groundY: 0,
  spreadRadius: 220,
  palette: [...BALLOON_PALETTE],
};

export const ALL_FESTIVAL_ZONES: VillageLaunchHub[] = [
  MYOTHAR_FESTIVAL_HUB,
  ...VILLAGE_LAUNCH_HUBS,
];

/**
 * Formats a Date object as local YYYY-MM-DD for calendar-date comparisons.
 */
export function formatLocalCalendarDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns true if the given date falls within [startDate, endDate] inclusive (YYYY-MM-DD).
 */
export function isDateWithinFestivalWindow(
  date: Date = new Date(),
  startDate: string = TAZAUNGDAING_START_DATE,
  endDate: string = TAZAUNGDAING_END_DATE,
): boolean {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const dayStr = formatLocalCalendarDate(date);
  return dayStr >= startDate && dayStr <= endDate;
}

export function createDefaultFestivalConfig(now: Date = new Date()): FestivalConfigurationState {
  const inWindow = isDateWithinFestivalWindow(now);
  return {
    enabled: inWindow,
    scheduleMode: 'auto',
    activeFestivalId: 'tazaungdaing',
    activeZoneId: 'all',
    customZone: {
      x: BALLOON_LAUNCH.x,
      z: BALLOON_LAUNCH.z,
      groundY: 0,
      spreadRadius: 240,
    },
    balloonsPerZone: 120,
    decorationsEnabled: true,
    allowDaytimePreview: false,
    seed: 20261115,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function sanitizeFestivalConfig(
  raw: unknown,
  now: Date = new Date(),
): FestivalConfigurationState {
  const defaults = createDefaultFestivalConfig(now);
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  const scheduleMode: FestivalScheduleMode =
    obj.scheduleMode === 'manual' || obj.scheduleMode === 'auto'
      ? obj.scheduleMode
      : defaults.scheduleMode;

  const validZoneIds = new Set(['all', 'custom', ...ALL_FESTIVAL_ZONES.map((z) => z.id)]);
  const activeZoneId =
    typeof obj.activeZoneId === 'string' && validZoneIds.has(obj.activeZoneId)
      ? obj.activeZoneId
      : defaults.activeZoneId;

  const rawCustom =
    obj.customZone && typeof obj.customZone === 'object'
      ? (obj.customZone as Record<string, unknown>)
      : {};

  const customZone: CustomFestivalZone = {
    x: clampNumber(rawCustom.x, -4500, 4500, defaults.customZone.x),
    z: clampNumber(rawCustom.z, -4500, 4500, defaults.customZone.z),
    groundY: clampNumber(rawCustom.groundY, -20, 600, defaults.customZone.groundY),
    spreadRadius: clampNumber(rawCustom.spreadRadius, 40, 800, defaults.customZone.spreadRadius),
  };

  const enabled =
    typeof obj.enabled === 'boolean' ? obj.enabled : defaults.enabled;

  return {
    enabled,
    scheduleMode,
    activeFestivalId:
      typeof obj.activeFestivalId === 'string' && obj.activeFestivalId.trim().length > 0
        ? obj.activeFestivalId
        : defaults.activeFestivalId,
    activeZoneId,
    customZone,
    balloonsPerZone: Math.round(clampNumber(obj.balloonsPerZone, 8, 400, defaults.balloonsPerZone)),
    decorationsEnabled:
      typeof obj.decorationsEnabled === 'boolean'
        ? obj.decorationsEnabled
        : defaults.decorationsEnabled,
    allowDaytimePreview:
      typeof obj.allowDaytimePreview === 'boolean'
        ? obj.allowDaytimePreview
        : defaults.allowDaytimePreview,
    seed: Math.round(clampNumber(obj.seed, 1, 2147483647, defaults.seed)),
  };
}

/**
 * Determines whether the festival overlay is effectively active for the given config and date.
 */
export function isFestivalActive(
  config: FestivalConfigurationState = currentConfig,
  now: Date = new Date(),
  startDate: string = TAZAUNGDAING_START_DATE,
  endDate: string = TAZAUNGDAING_END_DATE,
): boolean {
  if (config.scheduleMode === 'auto') {
    return isDateWithinFestivalWindow(now, startDate, endDate);
  }
  return Boolean(config.enabled);
}

/**
 * Resolves the list of active launch/decoration zones from the current configuration.
 */
export function resolveActiveFestivalZones(
  config: FestivalConfigurationState = currentConfig,
): VillageLaunchHub[] {
  if (config.activeZoneId === 'all') {
    return ALL_FESTIVAL_ZONES;
  }
  if (config.activeZoneId === 'custom') {
    return [
      {
        id: 'custom',
        name: 'Custom Festival Zone',
        myanmarName: 'သတ်မှတ်ပွဲတော်နယ်မြေ',
        x: config.customZone.x,
        z: config.customZone.z,
        groundY: config.customZone.groundY,
        spreadRadius: config.customZone.spreadRadius,
        palette: [...BALLOON_PALETTE],
      },
    ];
  }
  const found = ALL_FESTIVAL_ZONES.find((z) => z.id === config.activeZoneId);
  return found ? [found] : [MYOTHAR_FESTIVAL_HUB];
}

type Listener = () => void;
const listeners = new Set<Listener>();

function loadInitialConfig(): FestivalConfigurationState {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(FESTIVAL_CONFIG_STORAGE_KEY);
      if (saved) {
        return sanitizeFestivalConfig(JSON.parse(saved));
      }
    }
  } catch {}
  return createDefaultFestivalConfig();
}

let currentConfig: FestivalConfigurationState = loadInitialConfig();

// Sync initial state with legacy candle visibility controller
try {
  setThadingyutFestivalActive(isFestivalActive(currentConfig));
} catch {}

function persistAndNotify(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FESTIVAL_CONFIG_STORAGE_KEY, JSON.stringify(currentConfig));
    }
  } catch {}

  try {
    setThadingyutFestivalActive(isFestivalActive(currentConfig));
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('festival-configuration-changed', {
        detail: {
          config: currentConfig,
          active: isFestivalActive(currentConfig),
        },
      }),
    );
  }

  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function getFestivalConfiguration(): FestivalConfigurationState {
  return currentConfig;
}

export function updateFestivalConfiguration(
  patch:
    | Partial<FestivalConfigurationState>
    | ((prev: FestivalConfigurationState) => Partial<FestivalConfigurationState>),
): FestivalConfigurationState {
  const nextPatch = typeof patch === 'function' ? patch(currentConfig) : patch;
  currentConfig = sanitizeFestivalConfig({
    ...currentConfig,
    ...nextPatch,
    customZone: {
      ...currentConfig.customZone,
      ...(nextPatch.customZone ?? {}),
    },
  });
  persistAndNotify();
  return currentConfig;
}

/**
 * Convenience helper to explicitly enable or disable the festival in manual mode.
 */
export function setFestivalEnabled(enabled: boolean): FestivalConfigurationState {
  return updateFestivalConfiguration({
    scheduleMode: 'manual',
    enabled: Boolean(enabled),
  });
}

export function resetFestivalConfiguration(now: Date = new Date()): FestivalConfigurationState {
  currentConfig = createDefaultFestivalConfig(now);
  persistAndNotify();
  return currentConfig;
}

export function subscribeFestivalConfiguration(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFestivalConfiguration(): FestivalConfigurationState {
  return useSyncExternalStore(subscribeFestivalConfiguration, getFestivalConfiguration);
}
