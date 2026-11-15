import { useSyncExternalStore } from 'react';

export type IntroPlayMode = 'first-entry' | 'every-entry' | 'travel-entry' | 'off';
export type IntroTrigger = 'entry' | 'travel';
export type IntroBehavior = 'cinematic' | 'reduced-settle' | 'skip';

export type IntroSettings = {
  mode: IntroPlayMode;
  durationSec: number;
  respectReducedMotion: boolean;
  hasCompletedFirstEntry: boolean;
};

export type IntroSettingsStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const INTRO_SETTINGS_STORAGE_KEY = 'mm-town-intro-settings-v1';
export const DEFAULT_INTRO_DURATION_SEC = 7;
export const MIN_INTRO_DURATION_SEC = 3;
export const MAX_INTRO_DURATION_SEC = 14;
export const REDUCED_MOTION_DURATION_SEC = 0.45;
export const DEFAULT_INTRO_MODE: IntroPlayMode = 'first-entry';

export const DEFAULT_INTRO_SETTINGS: IntroSettings = {
  mode: DEFAULT_INTRO_MODE,
  durationSec: DEFAULT_INTRO_DURATION_SEC,
  respectReducedMotion: true,
  hasCompletedFirstEntry: false,
};

const VALID_MODES = new Set<IntroPlayMode>(['first-entry', 'every-entry', 'travel-entry', 'off']);

export function clampIntroDuration(durationSec: number): number {
  if (!Number.isFinite(durationSec)) return DEFAULT_INTRO_DURATION_SEC;
  return Math.max(MIN_INTRO_DURATION_SEC, Math.min(MAX_INTRO_DURATION_SEC, Math.round(durationSec * 10) / 10));
}

export function normalizeIntroSettings(raw: Partial<IntroSettings> | null | undefined): IntroSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_INTRO_SETTINGS };
  }
  const mode = raw.mode && VALID_MODES.has(raw.mode) ? raw.mode : DEFAULT_INTRO_SETTINGS.mode;
  const durationSec = clampIntroDuration(raw.durationSec ?? DEFAULT_INTRO_SETTINGS.durationSec);
  const respectReducedMotion =
    typeof raw.respectReducedMotion === 'boolean'
      ? raw.respectReducedMotion
      : DEFAULT_INTRO_SETTINGS.respectReducedMotion;
  const hasCompletedFirstEntry =
    typeof raw.hasCompletedFirstEntry === 'boolean'
      ? raw.hasCompletedFirstEntry
      : DEFAULT_INTRO_SETTINGS.hasCompletedFirstEntry;

  return {
    mode,
    durationSec,
    respectReducedMotion,
    hasCompletedFirstEntry,
  };
}

function defaultStorage(): IntroSettingsStorage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage may throw in restricted embedded contexts.
  }
  return null;
}

export function loadIntroSettings(storage: IntroSettingsStorage | null = defaultStorage()): IntroSettings {
  if (!storage) return { ...DEFAULT_INTRO_SETTINGS };
  try {
    const raw = storage.getItem(INTRO_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INTRO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<IntroSettings>;
    return normalizeIntroSettings(parsed);
  } catch {
    return { ...DEFAULT_INTRO_SETTINGS };
  }
}

export function saveIntroSettings(
  settings: IntroSettings,
  storage: IntroSettingsStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(INTRO_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeIntroSettings(settings)));
  } catch {
    // Ignore quota / security errors.
  }
}

export function isReducedMotionPreferred(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch {
    // Ignore environments without matchMedia.
  }
  return false;
}

export function shouldPlayIntro(
  trigger: IntroTrigger,
  settings: IntroSettings = currentSettings,
  options?: { diagnosticDisabled?: boolean },
): boolean {
  if (options?.diagnosticDisabled) return false;
  switch (settings.mode) {
    case 'off':
      return false;
    case 'first-entry':
      return trigger === 'entry' && !settings.hasCompletedFirstEntry;
    case 'every-entry':
      return trigger === 'entry';
    case 'travel-entry':
      return trigger === 'travel' || (trigger === 'entry' && !settings.hasCompletedFirstEntry);
    default:
      return false;
  }
}

/**
 * Determine whether to run the full drone sweep, a brief non-vestibular settle, or skip.
 */
export function resolveIntroBehavior(
  trigger: IntroTrigger,
  settings: IntroSettings = currentSettings,
  options?: { reducedMotion?: boolean; diagnosticDisabled?: boolean },
): IntroBehavior {
  if (!shouldPlayIntro(trigger, settings, { diagnosticDisabled: options?.diagnosticDisabled })) {
    return 'skip';
  }
  const prefersReduced = options?.reducedMotion ?? isReducedMotionPreferred();
  if (settings.respectReducedMotion && prefersReduced) {
    return 'reduced-settle';
  }
  return 'cinematic';
}

let currentSettings: IntroSettings = loadIntroSettings();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getIntroSettings(): IntroSettings {
  return currentSettings;
}

export function updateIntroSettings(
  patch: Partial<IntroSettings>,
  storage: IntroSettingsStorage | null = defaultStorage(),
): IntroSettings {
  currentSettings = normalizeIntroSettings({ ...currentSettings, ...patch });
  saveIntroSettings(currentSettings, storage);
  emit();
  return currentSettings;
}

export function markFirstEntryCompleted(storage: IntroSettingsStorage | null = defaultStorage()): IntroSettings {
  if (currentSettings.hasCompletedFirstEntry) return currentSettings;
  return updateIntroSettings({ hasCompletedFirstEntry: true }, storage);
}

export function resetIntroSettings(storage: IntroSettingsStorage | null = defaultStorage()): IntroSettings {
  currentSettings = { ...DEFAULT_INTRO_SETTINGS };
  saveIntroSettings(currentSettings, storage);
  emit();
  return currentSettings;
}

export function subscribeIntroSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIntroSettings(): IntroSettings {
  return useSyncExternalStore(subscribeIntroSettings, getIntroSettings, getIntroSettings);
}
