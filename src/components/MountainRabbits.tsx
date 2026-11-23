import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import {
  RABBIT_COAT_COLORS,
  getMountainRabbitAssetCache,
} from '../game/mountainRabbitAssets';
import {
  MountainRabbitFixedPool,
  buildMountainRabbitSpawns,
  type MountainRabbitSpawn,
} from '../game/mountainRabbitPool';
import type { TerrainPeak } from '../game/mountainTerrain';

/**
 * Reusable Single Mountain Rabbit 3D Component (for 3D Live Editor / Asset Library)
 * consuming the exact same Singleton `getMountainRabbitAssetCache()` geometries.
 */
export const MountainRabbitModel = memo(function MountainRabbitModel({
  coatColor = RABBIT_COAT_COLORS[0],
  scale = 1,
}: {
  coatColor?: string;
  scale?: number;
}) {
  const c = getMountainRabbitAssetCache();
  const furMat = useMemo(
    () => new MeshStandardMaterial({ color: coatColor, roughness: 0.9, vertexColors: true }),
    [coatColor],
  );
  useEffect(() => () => furMat.dispose(), [furMat]);

  return (
    <group scale={[scale, scale, scale]} name="mountain-rabbit-model" dispose={null}>
      <mesh position={[0, 0.24, -0.02]} scale={[0.92, 0.88, 1.32]} geometry={c.bodyGeo} material={furMat} castShadow />
      <mesh position={[0, 0.4, 0.24]} scale={[1, 0.94, 1.08]} geometry={c.headGeo} material={furMat} castShadow />
      <mesh position={[-0.068, 0.56, 0.21]} rotation={[-0.14, 0, 0.16]} geometry={c.earOuterGeo} material={furMat} castShadow />
      <mesh position={[0.068, 0.56, 0.21]} rotation={[-0.14, 0, -0.16]} geometry={c.earOuterGeo} material={furMat} castShadow />
      <mesh position={[-0.066, 0.56, 0.23]} rotation={[-0.14, 0, 0.16]} geometry={c.earInnerGeo} material={c.pinkInnerMat} />
      <mesh position={[0.066, 0.56, 0.23]} rotation={[-0.14, 0, -0.16]} geometry={c.earInnerGeo} material={c.pinkInnerMat} />
      <mesh position={[0, 0.23, -0.429]} scale={[1.05, 1.05, 1.05]} geometry={c.tailGeo} material={c.tailWhiteMat} />
      <mesh position={[-0.12, 0.066, 0.157]} scale={[1, 0.72, 1.45]} geometry={c.pawGeo} material={furMat} />
      <mesh position={[0.12, 0.066, 0.157]} scale={[1, 0.72, 1.45]} geometry={c.pawGeo} material={furMat} />
      <mesh position={[-0.127, 0.431, 0.306]} geometry={c.eyeGeo} material={c.eyeDarkMat} />
      <mesh position={[0.127, 0.431, 0.306]} geometry={c.eyeGeo} material={c.eyeDarkMat} />
      <mesh position={[0, 0.38, 0.447]} geometry={c.noseGeo} material={c.pinkInnerMat} />
    </group>
  );
});

/**
 * Pooled Wild Mountain Rabbits (`တောင်ပေါ် ယုန်ကလေးများ`)
 * Renders 300 regionally scattered hopping rabbits across Taungphila, the
 * Western Highland Plateaus/Camps, Western Spine, and Maha Weipula foothills
 * using strict Singleton Memory Reference Cache + Fixed Object Pool.
 */
export const MountainRabbits = memo(function MountainRabbits({
  peaks,
  spawns,
}: {
  peaks: readonly TerrainPeak[];
  spawns?: readonly MountainRabbitSpawn[];
}) {
  const pool = useMemo(() => {
    const list = spawns ?? buildMountainRabbitSpawns(peaks);
    return new MountainRabbitFixedPool(list);
  }, [peaks, spawns]);

  useEffect(() => () => pool.disposePool(), [pool]);

  useFrame(({ camera }, delta) => {
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    pool.step(delta, focus.x, focus.z, peaks);
  });

  return (
    <group name="mountain-rabbits-pooled">
      {pool.meshes().map((mesh, idx) => (
        <primitive key={`mtn-rabbit-mesh-${idx}`} object={mesh} />
      ))}
    </group>
  );
});
