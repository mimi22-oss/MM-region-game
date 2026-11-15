import { PointLight, type Scene } from 'three';
import type { QualityPresetConfig } from './qualityPreset.ts';

export interface HeroBalloonLightTarget {
  active: boolean;
  x: number;
  y: number;
  z: number;
  intensity: number;
}

const POOL_KEY = 'festivalLightPool';
const HERO_KEY = 'heroBalloonLight';
const poolListeners = new WeakMap<Scene, Set<() => void>>();

export function subscribeSceneFestivalLightPool(scene: Scene, listener: () => void) {
  let listeners = poolListeners.get(scene);
  if (!listeners) { listeners = new Set(); poolListeners.set(scene, listeners); }
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function festivalPoolCountForPreset(preset: QualityPresetConfig): number {
  if (preset.festivalLightCount <= 0) return 0;
  return Math.min(3, Math.max(1, preset.festivalLightCount));
}

export function registerSceneFestivalLightPool(scene: Scene, lights: PointLight[]): void {
  scene.userData[POOL_KEY] = lights;
  poolListeners.get(scene)?.forEach(listener => listener());
}

export function unregisterSceneFestivalLightPool(scene: Scene, lights: PointLight[]): void {
  if (scene.userData[POOL_KEY] === lights) {
    delete scene.userData[POOL_KEY];
    poolListeners.get(scene)?.forEach(listener => listener());
  }
}

export function getSceneFestivalLightPool(scene: Scene): PointLight[] | undefined {
  const pool = scene.userData[POOL_KEY];
  return Array.isArray(pool) ? (pool as PointLight[]) : undefined;
}

export function getHeroBalloonLightTarget(scene: Scene): HeroBalloonLightTarget {
  let target = scene.userData[HERO_KEY] as HeroBalloonLightTarget | undefined;
  if (!target) {
    target = { active: false, x: 0, y: 0, z: 0, intensity: 0 };
    scene.userData[HERO_KEY] = target;
  }
  return target;
}
