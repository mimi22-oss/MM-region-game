import { useSyncExternalStore } from 'react';
import { isNativeAndroid } from '../services/platform.ts';
import { mobileQuality } from './sceneBudget.ts';

export type QualityPresetMode = 'auto' | 'mobile' | 'low' | 'medium' | 'high';
export type ResolvedQualityPresetId = 'mobile' | 'low' | 'medium' | 'high';

export interface QualityPresetConfig {
  id: ResolvedQualityPresetId;
  label: string;
  festivalLightCount: number;
  heroBalloonLight: boolean;
  maxActiveFestivalZones: number;
  festivalZoneRadius: number;
  maxBalloonsPerZone: number;
  maxTotalBalloons: number;
  maxNearBalloons: number;
  maxMidBalloons: number;
  maxGroundDisplayBalloons: number;
  distantBalloonSimHz: number;
  decorationVisibilityInterval: number;
  characterCastShadow: boolean;
  maxAnimatedShadowCharacters: number;
  glbMaxTextureSize: number;
}

export const QUALITY_PRESET_CONFIGS: Record<ResolvedQualityPresetId, QualityPresetConfig> = {
  mobile: {
    id: 'mobile',
    label: 'Mobile',
    festivalLightCount: 1,
    heroBalloonLight: false,
    maxActiveFestivalZones: 1,
    festivalZoneRadius: 750,
    maxBalloonsPerZone: 32,
    maxTotalBalloons: 32,
    maxNearBalloons: 1,
    maxMidBalloons: 18,
    maxGroundDisplayBalloons: 1,
    distantBalloonSimHz: 8,
    decorationVisibilityInterval: 0.35,
    characterCastShadow: false,
    maxAnimatedShadowCharacters: 1,
    glbMaxTextureSize: 1024,
  },
  low: {
    id: 'low',
    label: 'Low',
    festivalLightCount: 1,
    heroBalloonLight: false,
    maxActiveFestivalZones: 1,
    festivalZoneRadius: 850,
    maxBalloonsPerZone: 48,
    maxTotalBalloons: 48,
    maxNearBalloons: 1,
    maxMidBalloons: 24,
    maxGroundDisplayBalloons: 2,
    distantBalloonSimHz: 10,
    decorationVisibilityInterval: 0.3,
    characterCastShadow: false,
    maxAnimatedShadowCharacters: 1,
    glbMaxTextureSize: 1024,
  },
  medium: {
    id: 'medium',
    label: 'Balanced (Desktop)',
    festivalLightCount: 2,
    heroBalloonLight: false,
    maxActiveFestivalZones: 2,
    festivalZoneRadius: 1100,
    maxBalloonsPerZone: 72,
    maxTotalBalloons: 110,
    maxNearBalloons: 3,
    maxMidBalloons: 48,
    maxGroundDisplayBalloons: 3,
    distantBalloonSimHz: 12,
    decorationVisibilityInterval: 0.25,
    characterCastShadow: true,
    maxAnimatedShadowCharacters: 4,
    glbMaxTextureSize: 2048,
  },
  high: {
    id: 'high',
    label: 'High (Desktop)',
    festivalLightCount: 4,
    heroBalloonLight: true,
    maxActiveFestivalZones: 3,
    festivalZoneRadius: 1600,
    maxBalloonsPerZone: 120,
    maxTotalBalloons: 220,
    maxNearBalloons: 4,
    maxMidBalloons: 72,
    maxGroundDisplayBalloons: 4,
    distantBalloonSimHz: 15,
    decorationVisibilityInterval: 0.2,
    characterCastShadow: true,
    maxAnimatedShadowCharacters: 8,
    glbMaxTextureSize: 4096,
  },
};

const STORAGE_KEY = 'myothar-quality-preset-v1';
const VALID_MODES = new Set<QualityPresetMode>(['auto', 'mobile', 'low', 'medium', 'high']);

function detectInitialMode(): QualityPresetMode {
  try {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('quality');
      if (q && VALID_MODES.has(q as QualityPresetMode)) {
        return q as QualityPresetMode;
      }
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID_MODES.has(saved as QualityPresetMode)) {
        return saved as QualityPresetMode;
      }
    }
  } catch {}
  return 'auto';
}

let currentMode: QualityPresetMode = detectInitialMode();
const listeners = new Set<() => void>();

export function detectMobileViewport(): boolean {
  if (typeof window === 'undefined') return mobileQuality;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return mobileQuality || isNativeAndroid() || coarse || window.innerWidth <= 760;
}

export function resolveQualityPresetId(mode: QualityPresetMode = currentMode): ResolvedQualityPresetId {
  if (mode === 'auto') {
    return detectMobileViewport() ? 'mobile' : 'medium';
  }
  return mode;
}

export function getQualityPresetMode(): QualityPresetMode {
  return currentMode;
}

export function getQualityPreset(): QualityPresetConfig {
  return QUALITY_PRESET_CONFIGS[resolveQualityPresetId(currentMode)];
}

export function setQualityPresetMode(mode: QualityPresetMode): QualityPresetConfig {
  currentMode = VALID_MODES.has(mode) ? mode : 'auto';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, currentMode);
    }
  } catch {}
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
  return getQualityPreset();
}

function subscribeQualityPreset(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useQualityPreset(): QualityPresetConfig {
  return useSyncExternalStore(subscribeQualityPreset, getQualityPreset, getQualityPreset);
}

export function useQualityPresetMode(): QualityPresetMode {
  return useSyncExternalStore(subscribeQualityPreset, getQualityPresetMode, getQualityPresetMode);
}
