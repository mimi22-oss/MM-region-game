/**
 * src/game/ghostModelLoader.ts
 *
 * Dedicated loader service for the 3D ghost GLB asset with bounded retry backoff,
 * clamp texture optimization, and offline/transient failure recovery.
 *
 * F05 fix: decouples GLB loading failure and retry mechanics from React components,
 * ensuring transient network failures (HTTP 500, offline boot) do not permanently
 * block the ghost entity from mounting once connectivity recovers.
 */

import { Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getQualityPreset } from './qualityPreset.ts';
import { GHOST_MODEL_URL } from './ghostConfig.ts';

export { GHOST_MODEL_URL };

export const GHOST_LOAD_RETRY_DELAYS_MS: readonly number[] = [5000, 15000, 30000];

let cachedGhostModelPromise: Promise<GLTF> | null = null;
let customGhostModelLoader: (() => Promise<GLTF>) | null = null;

export function setGhostModelLoaderForTest(loader: (() => Promise<GLTF>) | null): void {
  customGhostModelLoader = loader;
  cachedGhostModelPromise = null;
}

export function resetGhostModelCacheForTest(): void {
  cachedGhostModelPromise = null;
  customGhostModelLoader = null;
}

export function clampGhostGltfTextures(gltf: GLTF, maxSize: number): GLTF {
  if (typeof document === 'undefined') return gltf;
  const seen = new Set<Texture>();
  gltf.scene.traverse((obj) => {
    if ((obj as Mesh).isMesh) {
      const mesh = obj as Mesh;
      const mat = mesh.material as MeshStandardMaterial;
      if (!mat) return;
      const texKeys: (keyof MeshStandardMaterial)[] = [
        'map',
        'roughnessMap',
        'metalnessMap',
        'normalMap',
        'alphaMap',
        'emissiveMap',
      ];
      for (const key of texKeys) {
        const tex = mat[key] as Texture | null | undefined;
        if (!tex || seen.has(tex)) continue;
        seen.add(tex);
        tex.anisotropy = Math.min(tex.anisotropy || 1, maxSize <= 1024 ? 2 : 4);
        const img = tex.image as { width?: number; height?: number } | undefined;
        if (!img || typeof img.width !== 'number' || typeof img.height !== 'number') continue;
        const maxDim = Math.max(img.width, img.height);
        if (maxDim <= maxSize) continue;
        const scale = maxSize / maxDim;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
          tex.image = canvas;
          tex.needsUpdate = true;
        }
      }
    }
  });
  return gltf;
}

export function loadGhostModelOnce(): Promise<GLTF> {
  if (!cachedGhostModelPromise) {
    const p = customGhostModelLoader
      ? customGhostModelLoader()
      : new GLTFLoader()
          .loadAsync(GHOST_MODEL_URL)
          .then((gltf) => clampGhostGltfTextures(gltf, getQualityPreset().glbMaxTextureSize));

    cachedGhostModelPromise = p.catch((error) => {
      cachedGhostModelPromise = null;
      throw error;
    });
  }
  return cachedGhostModelPromise;
}
