import { memo, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { HighlandPlateauFixedPool } from '../game/highlandPlateauPool';
import type { HighlandPlateauCatalog } from '../game/highlandPlateauWorld';

/**
 * ============================================================================
 * Highland Plateau World Renderer (Singleton Cache + Fixed Object Pool)
 * ============================================================================
 * Renders 100+ highland mountain villages, radial base camps (tents, campfires,
 * firewood stacks, water jars), clear highland ponds, sandy earthen trails,
 * quarry boulders, and thousands of lush bushes using ONE shared
 * `HighlandPlateauFixedPool` that recycles bounded GPU slots around the camera.
 */
export const HighlandPlateauWorld = memo(function HighlandPlateauWorld({
  catalog,
}: {
  catalog: HighlandPlateauCatalog;
}) {
  const pool = useMemo(() => new HighlandPlateauFixedPool(catalog), [catalog]);

  useEffect(() => () => pool.disposePool(), [pool]);

  useFrame(({ camera }) => {
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    pool.syncToFocus(focus.x, focus.z);
  });

  return (
    <group name="highland-plateau-villages-and-camps-pooled">
      {pool.meshes().map((mesh, idx) => (
        <primitive key={`hp-pool-${idx}`} object={mesh} />
      ))}
    </group>
  );
});
