import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GlbSceneLoaderFn } from '../core/MotionLoader.ts';
import { MotionLruCache, type RawMotionAsset } from '../core/MotionCache.ts';
import { CORE_HUMANOID_BONES } from '../retargeting/BoneMapping.ts';
import {
  analyzeSkeleton,
  compareSkeletons,
  type SkeletonCompatibilityReport,
} from '../retargeting/SkeletonAnalyzer.ts';
import {
  cloneTransformHierarchyOnly,
  retargetMotionClip,
} from '../retargeting/SkeletonRetargeter.ts';

export type GhostClipId =
  | 'depressed'
  | 'freaky'
  | 'flee_01'
  | 'dig'
  | 'laugh_01'
  | 'flee_02'
  | 'fall';

export interface GhostClipSpec {
  readonly id: GhostClipId;
  readonly assetUrl: `/motions/ghost/${GhostClipId}.glb`;
  readonly clipName: `${GhostClipId}.001`;
  readonly durationSec: number;
  readonly defaultLoop: boolean;
  readonly crossFadeSec: number;
  readonly fadeOutSec: number;
  readonly endHoldSec: number;
  /** Default playback speed multiplier calibrated to avoid sliding in locomotion states. */
  readonly basePlaybackSpeed: number;
}

export const GHOST_CLIP_SPECS: Readonly<Record<GhostClipId, GhostClipSpec>> = {
  depressed: {
    id: 'depressed',
    assetUrl: '/motions/ghost/depressed.glb',
    clipName: 'depressed.001',
    durationSec: 4.625,
    defaultLoop: true,
    crossFadeSec: 0.35,
    fadeOutSec: 0.35,
    endHoldSec: 0,
    basePlaybackSpeed: 1.0,
  },
  freaky: {
    id: 'freaky',
    assetUrl: '/motions/ghost/freaky.glb',
    clipName: 'freaky.001',
    durationSec: 0.8333,
    defaultLoop: true,
    crossFadeSec: 0.16,
    fadeOutSec: 0.25,
    endHoldSec: 0,
    basePlaybackSpeed: 1.08,
  },
  flee_01: {
    id: 'flee_01',
    assetUrl: '/motions/ghost/flee_01.glb',
    clipName: 'flee_01.001',
    durationSec: 2.7083,
    defaultLoop: true,
    crossFadeSec: 0.2,
    fadeOutSec: 0.28,
    endHoldSec: 0,
    basePlaybackSpeed: 1.45,
  },
  dig: {
    id: 'dig',
    assetUrl: '/motions/ghost/dig.glb',
    clipName: 'dig.001',
    durationSec: 16.4167,
    defaultLoop: true,
    crossFadeSec: 0.4,
    fadeOutSec: 0.35,
    endHoldSec: 0,
    basePlaybackSpeed: 1.0,
  },
  laugh_01: {
    id: 'laugh_01',
    assetUrl: '/motions/ghost/laugh_01.glb',
    clipName: 'laugh_01.001',
    durationSec: 5.625,
    defaultLoop: false,
    crossFadeSec: 0.24,
    fadeOutSec: 0.3,
    endHoldSec: 0,
    basePlaybackSpeed: 1.0,
  },
  flee_02: {
    id: 'flee_02',
    assetUrl: '/motions/ghost/flee_02.glb',
    clipName: 'flee_02.001',
    durationSec: 3.7083,
    defaultLoop: true,
    crossFadeSec: 0.22,
    fadeOutSec: 0.28,
    endHoldSec: 0,
    basePlaybackSpeed: 1.35,
  },
  fall: {
    id: 'fall',
    assetUrl: '/motions/ghost/fall.glb',
    clipName: 'fall.001',
    durationSec: 3.0417,
    defaultLoop: false,
    crossFadeSec: 0.18,
    fadeOutSec: 0.35,
    endHoldSec: 0.35,
    basePlaybackSpeed: 1.0,
  },
};

export const ALL_GHOST_CLIP_IDS: readonly GhostClipId[] = Object.keys(
  GHOST_CLIP_SPECS,
) as GhostClipId[];

export interface GhostMotionLoadOptions {
  loaderFn?: GlbSceneLoaderFn;
  retries?: number;
}

const rawGhostMotionCache = new MotionLruCache<GhostClipId, Omit<RawMotionAsset, 'actionId'> & { id: GhostClipId }>(7);
const retargetedGhostClipCache = new MotionLruCache<string, AnimationClip>(7);
const inFlightGhostRaw = new Map<
  GhostClipId,
  Promise<Omit<RawMotionAsset, 'actionId'> & { id: GhostClipId }>
>();
const inFlightGhostRetarget = new Map<string, Promise<AnimationClip>>();

let sharedGhostLoader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!sharedGhostLoader) sharedGhostLoader = new GLTFLoader();
  return sharedGhostLoader;
}

async function fetchGhostGlbWithRetry(
  url: string,
  loaderFn: GlbSceneLoaderFn | undefined,
  retries: number,
): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  let lastError: unknown;
  const maxAttempts = Math.max(1, 1 + retries);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return loaderFn ? await loaderFn(url) : await getLoader().loadAsync(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to load ghost motion: ${url}`);
}

/**
 * Validates skeleton joint structure on the loaded ghost character rig against required Mixamo bones.
 */
export function validateGhostRigCompatibility(
  targetRig: Object3D,
  sourceActionRig?: Object3D,
): { compatible: boolean; report?: SkeletonCompatibilityReport; missingCoreJoints: string[] } {
  const analysis = analyzeSkeleton(targetRig);
  const present = new Set(analysis.boneNames);
  const missingCoreJoints = CORE_HUMANOID_BONES.filter((name) => !present.has(name));
  if (!sourceActionRig) {
    return {
      compatible: missingCoreJoints.length === 0,
      missingCoreJoints,
    };
  }
  const report = compareSkeletons(sourceActionRig, targetRig);
  return {
    compatible: report.compatible && report.missingCoreBones.length === 0 && missingCoreJoints.length === 0,
    report,
    missingCoreJoints,
  };
}

/**
 * Lazily loads an extracted ghost motion GLB (transform-only skeleton + 1 clip, zero duplicate mesh/textures)
 * and deduplicates concurrent loads.
 */
export async function loadGhostRawMotion(
  clipId: GhostClipId,
  options?: GhostMotionLoadOptions,
): Promise<Omit<RawMotionAsset, 'actionId'> & { id: GhostClipId }> {
  const cached = rawGhostMotionCache.get(clipId);
  if (cached) return cached;

  const inflight = inFlightGhostRaw.get(clipId);
  if (inflight) return inflight;

  const spec = GHOST_CLIP_SPECS[clipId];
  const promise = fetchGhostGlbWithRetry(spec.assetUrl, options?.loaderFn, options?.retries ?? 1)
    .then((gltf) => {
      const clip = gltf.animations.find((c) => c.name === spec.clipName) ?? gltf.animations[0];
      if (!clip) {
        throw new Error(`Missing ghost clip "${spec.clipName}" in ${spec.assetUrl}`);
      }
      const entry = {
        id: clipId,
        scene: cloneTransformHierarchyOnly(gltf.scene),
        clip,
      };
      rawGhostMotionCache.set(clipId, entry);
      return entry;
    })
    .finally(() => {
      inFlightGhostRaw.delete(clipId);
    });

  inFlightGhostRaw.set(clipId, promise);
  return promise;
}

/**
 * Loads and retargets a ghost animation clip onto the ghost character rig using shared
 * `retargetMotionClip` (in-place Hips XZ with preserved vertical height & world-space quaternion delta).
 */
export async function loadGhostRetargetedClip(
  clipId: GhostClipId,
  targetRigRoot: Object3D,
  options?: GhostMotionLoadOptions,
): Promise<AnimationClip> {
  const analysis = analyzeSkeleton(targetRigRoot);
  const cacheKey = `ghost:${clipId}:${analysis.rigSignature}`;

  const cached = retargetedGhostClipCache.get(cacheKey);
  if (cached) return cached;

  const inflight = inFlightGhostRetarget.get(cacheKey);
  if (inflight) return inflight;

  const promise = loadGhostRawMotion(clipId, options)
    .then((raw) => {
      const compat = validateGhostRigCompatibility(targetRigRoot, raw.scene);
      if (!compat.compatible) {
        throw new Error(
          `Incompatible ghost skeleton for clip ${clipId}; missing joints: ${compat.missingCoreJoints.join(', ')}`,
        );
      }
      const retargeted = retargetMotionClip(raw.clip, raw.scene, targetRigRoot, {
        rootMotion: 'in-place',
      });
      retargetedGhostClipCache.set(cacheKey, retargeted);
      return retargeted;
    })
    .finally(() => {
      inFlightGhostRetarget.delete(cacheKey);
    });

  inFlightGhostRetarget.set(cacheKey, promise);
  return promise;
}

export function getGhostMotionCacheCounts(): {
  rawCount: number;
  clipCount: number;
  loadedIds: GhostClipId[];
} {
  return {
    rawCount: rawGhostMotionCache.size,
    clipCount: retargetedGhostClipCache.size,
    loadedIds: rawGhostMotionCache.keys(),
  };
}

export function clearGhostMotionCaches(): void {
  rawGhostMotionCache.clear();
  retargetedGhostClipCache.clear();
  inFlightGhostRaw.clear();
  inFlightGhostRetarget.clear();
}
