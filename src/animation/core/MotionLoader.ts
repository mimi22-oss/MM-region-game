import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { analyzeSkeleton } from '../retargeting/SkeletonAnalyzer.ts';
import {
  cloneTransformHierarchyOnly,
  retargetMotionClip,
  type RetargetOptions,
} from '../retargeting/SkeletonRetargeter.ts';
import {
  inFlightRawMotions,
  inFlightRetargetedClips,
  rawMotionCache,
  recordCacheHit,
  recordCacheMiss,
  retargetedClipCache,
  type RawMotionAsset,
} from './MotionCache.ts';
import { getMotion, resolveMotionId, type MotionId } from './MotionRegistry.ts';

export type GlbSceneLoaderFn = (
  url: string,
) => Promise<{ scene: Object3D; animations: AnimationClip[] }>;

export interface MotionLoadOptions {
  loaderFn?: GlbSceneLoaderFn;
  retries?: number;
  retarget?: RetargetOptions;
}

let sharedLoader: GLTFLoader | null = null;

function getDefaultGltfLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = new GLTFLoader();
  return sharedLoader;
}

async function fetchWithRetry(
  url: string,
  loaderFn: GlbSceneLoaderFn | undefined,
  retries: number,
): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  let lastError: unknown;
  const maxAttempts = Math.max(1, 1 + retries);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return loaderFn ? await loaderFn(url) : await getDefaultGltfLoader().loadAsync(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to load motion GLB: ${url}`);
}

/**
 * Lazily loads an animation-only GLB, dedupes concurrent fetches, supports retries on transient failures,
 * and caches only a transform-only reference skeleton + AnimationClip (zero mesh/material/texture copies).
 */
export async function loadRawMotionAsset(
  id: MotionId,
  options?: MotionLoadOptions,
): Promise<RawMotionAsset> {
  const canonicalId = resolveMotionId(id);
  const cached = rawMotionCache.get(canonicalId);
  if (cached) {
    recordCacheHit();
    return cached;
  }

  const inflight = inFlightRawMotions.get(canonicalId);
  if (inflight) return inflight;

  const def = getMotion(canonicalId);
  if (!def) {
    throw new Error(`Unknown motion action: ${id}`);
  }

  recordCacheMiss();
  const promise = fetchWithRetry(def.assetUrl, options?.loaderFn, options?.retries ?? 1)
    .then((gltf) => {
      const clip = gltf.animations.find((c) => c.name === def.clipName) ?? gltf.animations[0];
      if (!clip) {
        throw new Error(`No animation clip found in ${def.assetUrl}`);
      }
      const asset: RawMotionAsset = {
        actionId: canonicalId,
        scene: cloneTransformHierarchyOnly(gltf.scene),
        clip,
      };
      rawMotionCache.set(canonicalId, asset);
      return asset;
    })
    .finally(() => {
      inFlightRawMotions.delete(canonicalId);
    });

  inFlightRawMotions.set(canonicalId, promise);
  return promise;
}

/**
 * Loads and retargets a shared motion clip onto the given target skeleton rig, caching by
 * canonical motion ID + structural rig signature (so identical rigs share one retargeted clip).
 */
export async function loadRetargetedMotionClip(
  id: MotionId,
  rigKeyOrTargetRoot: string | Object3D,
  targetRigRoot?: Object3D,
  options?: MotionLoadOptions,
): Promise<AnimationClip> {
  const canonicalId = resolveMotionId(id);
  const targetRoot =
    typeof rigKeyOrTargetRoot === 'string' ? targetRigRoot : rigKeyOrTargetRoot;
  if (!targetRoot) {
    throw new Error(`Missing target rig Object3D when loading motion ${id}`);
  }

  const analysis = analyzeSkeleton(targetRoot);
  const rigKey =
    typeof rigKeyOrTargetRoot === 'string' && rigKeyOrTargetRoot.length > 0
      ? `${rigKeyOrTargetRoot}:${analysis.rigSignature}`
      : analysis.rigSignature;
  const cacheKey = `${canonicalId}:${rigKey}`;

  const cached = retargetedClipCache.get(cacheKey);
  if (cached) {
    recordCacheHit();
    return cached;
  }

  const inflight = inFlightRetargetedClips.get(cacheKey);
  if (inflight) return inflight;

  recordCacheMiss();
  const promise = loadRawMotionAsset(canonicalId, options)
    .then((rawAsset) => {
      const retargeted = retargetMotionClip(
        rawAsset.clip,
        rawAsset.scene,
        targetRoot,
        options?.retarget,
      );
      retargetedClipCache.set(cacheKey, retargeted);
      return retargeted;
    })
    .finally(() => {
      inFlightRetargetedClips.delete(cacheKey);
    });

  inFlightRetargetedClips.set(cacheKey, promise);
  return promise;
}
