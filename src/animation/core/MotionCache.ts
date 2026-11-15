import type { AnimationClip, Object3D } from 'three';
import type { MotionId } from './MotionRegistry.ts';

export const DEFAULT_MAX_RAW_CACHE = 4;
export const DEFAULT_MAX_CLIP_CACHE = 6;

export interface RawMotionAsset {
  readonly actionId: MotionId;
  readonly scene: Object3D;
  readonly clip: AnimationClip;
}

export interface MotionCacheStats {
  readonly rawCount: number;
  readonly maxRawEntries: number;
  readonly clipCount: number;
  readonly maxClipEntries: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly loadedActionIds: MotionId[];
}

/**
 * Bounded LRU cache with explicit hit/miss/eviction metrics for shared animation assets and retargeted clips.
 */
export class MotionLruCache<K, V> {
  private readonly map = new Map<K, V>();
  private readonly maxEntries: number;
  public evictions = 0;

  constructor(maxEntries: number) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  keys(): K[] {
    return Array.from(this.map.keys());
  }

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
        this.evictions++;
      }
    }
    this.map.set(key, value);
  }

  clear(): void {
    this.map.clear();
  }
}

export const rawMotionCache = new MotionLruCache<MotionId, RawMotionAsset>(DEFAULT_MAX_RAW_CACHE);
export const retargetedClipCache = new MotionLruCache<string, AnimationClip>(DEFAULT_MAX_CLIP_CACHE);
export const inFlightRawMotions = new Map<MotionId, Promise<RawMotionAsset>>();
export const inFlightRetargetedClips = new Map<string, Promise<AnimationClip>>();

let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheHit(): void {
  cacheHits++;
}

export function recordCacheMiss(): void {
  cacheMisses++;
}

export function getMotionCacheStats(): MotionCacheStats {
  return {
    rawCount: rawMotionCache.size,
    maxRawEntries: DEFAULT_MAX_RAW_CACHE,
    clipCount: retargetedClipCache.size,
    maxClipEntries: DEFAULT_MAX_CLIP_CACHE,
    hits: cacheHits,
    misses: cacheMisses,
    evictions: rawMotionCache.evictions + retargetedClipCache.evictions,
    loadedActionIds: rawMotionCache.keys(),
  };
}

export function clearMotionCaches(): void {
  rawMotionCache.clear();
  retargetedClipCache.clear();
  inFlightRawMotions.clear();
  inFlightRetargetedClips.clear();
  rawMotionCache.evictions = 0;
  retargetedClipCache.evictions = 0;
  cacheHits = 0;
  cacheMisses = 0;
}
