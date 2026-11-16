import { useSyncExternalStore } from 'react';
import { gameAudio } from '../gameAudio.ts';
import type { HorrorAudioBusId, OpusSupportStatus } from './HorrorAudioRegistry.ts';

export interface BusDiagnosticsSnapshot {
  readonly gain: number;
  readonly activeVoices: number;
}

export interface WarehouseZoneDiagnosticsSnapshot {
  readonly band: string;
  readonly inZone: boolean;
  readonly preloaded: boolean;
  readonly distanceM: number | null;
  readonly period: string;
  readonly bedMode: 'opus' | 'procedural' | 'inactive';
  readonly sources: number;
  readonly nodes: number;
  readonly disposed: boolean;
}

export interface GhostAudioDiagnosticsSnapshot {
  readonly ghostId: string;
  readonly state: string;
  readonly distToPlayerM: number | null;
  readonly chaseActive: boolean;
}

export interface AudioDiagnosticsSnapshot {
  readonly audioContextState: string;
  readonly soundEnabled: boolean;
  readonly masterVolume: number;
  readonly activeBuses: Readonly<Record<HorrorAudioBusId, BusDiagnosticsSnapshot>>;
  readonly warehouseZoneStatus: WarehouseZoneDiagnosticsSnapshot;
  readonly currentGhostState: GhostAudioDiagnosticsSnapshot | null;
  readonly currentAudioFile: string | null;
  readonly lastPlaybackError: string | null;
  readonly opusSupport: OpusSupportStatus;
}

type MixerInspectorFn = () => {
  buses: Readonly<Record<HorrorAudioBusId, BusDiagnosticsSnapshot>>;
  currentAudioFile: string | null;
  lastPlaybackError: string | null;
  opusSupport: OpusSupportStatus;
};

let soundEnabledSetting = true;
let masterVolumeSetting = 0.3;

let warehouseSnapshot: WarehouseZoneDiagnosticsSnapshot = {
  band: 'outside',
  inZone: false,
  preloaded: false,
  distanceM: null,
  period: 'day',
  bedMode: 'inactive',
  sources: 0,
  nodes: 0,
  disposed: true,
};

let ghostSnapshot: GhostAudioDiagnosticsSnapshot | null = null;
let mixerInspector: MixerInspectorFn | null = null;
let testAudioRunner: (() => Promise<void>) | null = null;

const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  listeners.forEach((fn) => fn());
}

export function setAudioSettingsDiagnostics(enabled: boolean, volume: number): void {
  const cleanVol = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
  if (soundEnabledSetting === enabled && Math.abs(masterVolumeSetting - cleanVol) < 0.001) return;
  soundEnabledSetting = enabled;
  masterVolumeSetting = cleanVol;
  emit();
}

export function setWarehouseZoneDiagnostics(next: WarehouseZoneDiagnosticsSnapshot): void {
  if (
    warehouseSnapshot.band === next.band &&
    warehouseSnapshot.inZone === next.inZone &&
    warehouseSnapshot.preloaded === next.preloaded &&
    warehouseSnapshot.period === next.period &&
    warehouseSnapshot.bedMode === next.bedMode &&
    warehouseSnapshot.sources === next.sources &&
    warehouseSnapshot.disposed === next.disposed &&
    Math.abs((warehouseSnapshot.distanceM ?? -1) - (next.distanceM ?? -1)) < 0.5
  ) {
    return;
  }
  warehouseSnapshot = next;
  emit();
}

export function setGhostAudioDiagnostics(next: GhostAudioDiagnosticsSnapshot | null): void {
  if (
    ghostSnapshot?.ghostId === next?.ghostId &&
    ghostSnapshot?.state === next?.state &&
    ghostSnapshot?.chaseActive === next?.chaseActive &&
    Math.abs((ghostSnapshot?.distToPlayerM ?? -1) - (next?.distToPlayerM ?? -1)) < 0.5
  ) {
    return;
  }
  ghostSnapshot = next;
  emit();
}

export function registerHorrorAudioInspector(inspector: MixerInspectorFn | null): void {
  mixerInspector = inspector;
  emit();
}

export function registerHorrorAudioTestRunner(runner: (() => Promise<void>) | null): void {
  testAudioRunner = runner;
}

export function notifyHorrorAudioDiagnosticsChanged(): void {
  emit();
}

export async function runDiagnosticTestAudio(): Promise<void> {
  gameAudio.unlock();
  if (testAudioRunner) {
    await testAudioRunner();
  }
  emit();
}

export function getAudioDiagnosticsSnapshot(): AudioDiagnosticsSnapshot {
  const levels = gameAudio.getLevels();
  const inspected = mixerInspector?.();
  return {
    audioContextState: typeof AudioContext === 'undefined' ? 'unavailable' : gameAudio.context?.state ?? 'locked',
    soundEnabled: soundEnabledSetting,
    masterVolume: masterVolumeSetting || levels.master,
    activeBuses: inspected?.buses ?? {
      ambience: { gain: levels.ambience, activeVoices: 0 },
      ghostEffects: { gain: levels.ghost, activeVoices: 0 },
      horrorEvents: { gain: levels.horrorEvents, activeVoices: 0 },
      chaseMusic: { gain: levels.chaseMusic, activeVoices: 0 },
    },
    warehouseZoneStatus: warehouseSnapshot,
    currentGhostState: ghostSnapshot,
    currentAudioFile: inspected?.currentAudioFile ?? null,
    lastPlaybackError: inspected?.lastPlaybackError ?? null,
    opusSupport: inspected?.opusSupport ?? {
      supported: false,
      oggOpus: '',
      rawOpus: '',
      mediaSourceOpus: false,
      runtimeDecodeOk: null,
      method: 'non-browser',
      detail: 'Mixer not attached',
    },
  };
}

let cachedSnapshot = getAudioDiagnosticsSnapshot();
let cachedVersion = -1;

function getStoreSnapshot(): AudioDiagnosticsSnapshot {
  if (cachedVersion !== version) {
    cachedSnapshot = getAudioDiagnosticsSnapshot();
    cachedVersion = version;
  }
  return cachedSnapshot;
}

export function useAudioDiagnostics(): AudioDiagnosticsSnapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getStoreSnapshot,
    getStoreSnapshot,
  );
}
