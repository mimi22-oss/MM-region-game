import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { toWorld } from '../data/ward';
import type { TerrainPeak } from '../game/mountainTerrain';
import { getMountainTigerAssetCache, TIGER_ANKLE, TIGER_HEAD, TIGER_LEGS, TIGER_TAIL } from '../game/mountainTigerAssets';
import {
  MountainTigerFixedPool,
  buildMountainTigerSpawns,
  type MountainTigerSpawn,
} from '../game/mountainTigerPool';

/**
 * Reusable Single Mountain Tiger 3D Component (for `/map?tool=editor` & Asset Library)
 * consuming the exact same Singleton `getMountainTigerAssetCache()`.
 */
export const MountainTigerModel = memo(function MountainTigerModel({
  scale = 1,
}: {
  scale?: number;
}) {
  const c = getMountainTigerAssetCache();
  return (
    <group scale={scale} name="mountain-tiger-model" dispose={null}>
      <mesh geometry={c.bodyGeo} material={c.coatMat} castShadow />
      <mesh position={[...TIGER_HEAD]} geometry={c.headGeo} material={c.detailMat} castShadow />
      {TIGER_LEGS.map(({ x, y, z, hind }) => (
        <group key={String(x)} position={[x, y, z]}>
          <mesh geometry={hind ? c.hindLegGeo : c.legGeo} material={c.coatMat} castShadow />
          <mesh position={[...TIGER_ANKLE]} geometry={c.pawGeo} material={c.detailMat} castShadow />
        </group>
      ))}
      <mesh position={[...TIGER_TAIL]} geometry={c.tailGeo} material={c.detailMat} castShadow />
    </group>
  );
});

/**
 * Pooled Wild Mountain Tigers (`တောင်ပေါ် ကျားကြီးများ`)
 * Places paired (2 tigers) and solitary (1 tiger) territories strictly far away
 * from all mountain rabbits and deer herds via Singleton Cache + Fixed Object Pool.
 */
export const MountainTigers = memo(function MountainTigers({
  peaks,
  spawns,
}: {
  peaks: readonly TerrainPeak[];
  spawns?: readonly MountainTigerSpawn[];
}) {
  const pool = useMemo(() => {
    const list = spawns ?? buildMountainTigerSpawns(peaks);
    return new MountainTigerFixedPool(list);
  }, [peaks, spawns]);

  useEffect(() => {
    const initial = toWorld(-2680, 6200);
    pool.syncToFocus(initial.x, initial.z, true);
    return () => {
      pool.disposePool();
    };
  }, [pool]);

  useFrame(({ camera }, delta) => {
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    pool.step(delta, focus.x, focus.z, peaks);
  });

  return (
    <group name="mountain-tigers-pooled">
      {pool.meshes().map((mesh, idx) => (
        <primitive key={`mtn-tiger-mesh-${idx}`} object={mesh} />
      ))}
    </group>
  );
});
