import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import { DEER_COAT_COLORS, getMountainDeerAssetCache } from '../game/mountainDeerAssets';
import {
  MountainDeerFixedPool,
  buildMountainDeerSpawns,
  type MountainDeerSpawn,
} from '../game/mountainDeerPool';
import type { TerrainPeak } from '../game/mountainTerrain';

/**
 * Reusable Single Mountain Deer 3D Component (for 3D Live Editor / Asset Library)
 * consuming the exact same Singleton `getMountainDeerAssetCache()` geometries.
 */
export const MountainDeerModel = memo(function MountainDeerModel({
  coatColor = DEER_COAT_COLORS[0],
  hasAntlers = true,
  scale = 1,
}: {
  coatColor?: string;
  hasAntlers?: boolean;
  scale?: number;
}) {
  const c = getMountainDeerAssetCache();
  const coatMat = useMemo(
    () => new MeshStandardMaterial({ color: coatColor, roughness: 0.88, vertexColors: true }),
    [coatColor],
  );
  useEffect(() => () => coatMat.dispose(), [coatMat]);

  return (
    <group scale={[scale, scale, scale]} name="mountain-deer-model" dispose={null}>
      <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.96, 1, 0.94]} geometry={c.bodyGeo} material={coatMat} castShadow />
      {[-0.18, 0.18].flatMap((lx) =>
        [0.42, -0.44].map((lz) => (
          <mesh key={`${lx}-${lz}`} position={[lx, 0.46, lz]} geometry={lz > 0 ? c.legGeo : c.hindLegGeo} material={coatMat} castShadow />
        )),
      )}
      <mesh position={[0, 1.01, -0.697]} rotation={[-0.85, 0, 0]} geometry={c.tailGeo} material={c.creamBellyMat} />
      <mesh position={[0, 1.39, 0.57]} rotation={[0.34, 0, 0]} geometry={c.neckGeo} material={coatMat} castShadow />
      <group position={[0, 1.65, .74]}>
        <mesh scale={[.92, .94, 1.18]} geometry={c.headGeo} material={coatMat} castShadow />
        <mesh position={[0, -.045, .174]} rotation={[Math.PI / 2 + .12, 0, 0]} geometry={c.muzzleGeo} material={coatMat} />
        {[-1, 1].map(side => (
          <group key={side}>
            <mesh position={[side * .137, .114, -.041]} rotation={[-.22, 0, side * -.69]} geometry={c.earGeo} material={coatMat} />
            <mesh position={[side * .126, .034, .098]} geometry={c.eyeGeo} material={c.darkHoofEyeMat} />
            {hasAntlers && <mesh position={[side * .076, .115, -.03]} rotation={[-.17, 0, side * -.37]} geometry={c.antlerMainGeo} material={c.antlerMat} castShadow />}
          </group>
        ))}
      </group>
    </group>
  );
});

/**
 * Pooled Wild Mountain Deer Herds (`တောင်ပေါ် သမင်အုပ်များ`)
 * Renders 180 grazing & roaming highland deer across Taungphila, the Western
 * Highland Plateaus/Camps, Western Spine, and Maha Weipula foothills via
 * strict Singleton Memory Reference Cache + Fixed Object Pool.
 */
export const MountainDeer = memo(function MountainDeer({
  peaks,
  spawns,
}: {
  peaks: readonly TerrainPeak[];
  spawns?: readonly MountainDeerSpawn[];
}) {
  const pool = useMemo(() => {
    const list = spawns ?? buildMountainDeerSpawns(peaks);
    return new MountainDeerFixedPool(list);
  }, [peaks, spawns]);

  useEffect(() => () => pool.disposePool(), [pool]);

  useFrame(({ camera }, delta) => {
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    pool.step(delta, focus.x, focus.z, peaks);
  });

  return (
    <group name="mountain-deer-herds-pooled">
      {pool.meshes().map((mesh, idx) => (
        <primitive key={`mtn-deer-mesh-${idx}`} object={mesh} />
      ))}
    </group>
  );
});
