import { angle, ward } from '../data/ward';
import { getTreeAssetCache } from '../game/treeResourcePool';

type TreeData = { id: string; x: number; z: number; radius: number };
type TreeProps = { t: TreeData; i?: number; variant?: 'large' | 'canopy' | 'farm' };

const CANOPY_BRANCH_ROT = Math.atan2(9, 4);

/**
 * Zero-Duplication Tree component:
 * Binds strictly to the Singleton Memory Reference Cache (`getTreeAssetCache()`) so
 * every village, ward, and preview tree shares ONE single GPU geometry & material
 * reference per part instead of duplicating geometries/materials per tree instance.
 */
export function Tree({ t, i = 0, variant = 'large' }: TreeProps) {
  const cache = getTreeAssetCache();
  const rScale = Math.max(0.25, t.radius);

  if (variant === 'farm') {
    return (
      <group key={t.id} position={[t.x, 0, t.z]}>
        <mesh
          position={[0, 5.75, 0]}
          scale={[rScale, 1, rScale]}
          geometry={cache.farmTrunkGeo}
          material={cache.barkFarmMat}
          castShadow
        />
        <mesh
          position={[0, 14, 0]}
          geometry={cache.farmCanopyGeo}
          material={cache.foliageFarmMat}
          castShadow
        />
      </group>
    );
  }

  if (variant === 'canopy') {
    const dir = i < 32 ? 1 : -1;
    return (
      <group key={t.id} position={[t.x, 0, t.z]} scale={[1, 17.6 / 14.095, 1]}>
        <mesh
          position={[0, 4, 0]}
          scale={[rScale, 1, rScale]}
          geometry={cache.canopyTrunkGeo}
          material={cache.barkCanopyMat}
          castShadow
        />
        <group rotation={[0, angle, 0]}>
          <mesh
            position={[dir * 4.5, 8, 0]}
            rotation={[0, 0, -dir * CANOPY_BRANCH_ROT]}
            geometry={cache.canopyBranchGeo}
            material={cache.barkCanopyMat}
            castShadow
          />
        </group>
        <mesh
          position={[dir * 9 * Math.cos(angle), 10, -dir * 9 * Math.sin(angle)]}
          scale={[1, 0.65, 1]}
          geometry={cache.canopyCrownPrimaryGeo}
          material={i % 2 ? cache.foliageCanopyOddMat : cache.foliageCanopyEvenMat}
          castShadow
        />
        <mesh
          position={[dir * 4 * Math.cos(angle), 9.3, -dir * 4 * Math.sin(angle)]}
          scale={[1, 0.7, 1]}
          geometry={cache.canopyCrownSecondaryGeo}
          material={cache.foliageCanopySecondaryMat}
          castShadow
        />
      </group>
    );
  }

  return (
    <group key={t.id} position={[t.x, 0, t.z]} scale={[1, 17.6 / 18.2, 1]}>
      <mesh
        position={[0, 5.5, 0]}
        scale={[rScale, 1, rScale]}
        geometry={cache.largeTrunkGeo}
        material={cache.barkLargeMat}
        castShadow
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 1.8, 10, 0]}
          rotation={[0, 0, -side * 0.8]}
          geometry={cache.largeBranchGeo}
          material={cache.barkLargeMat}
          castShadow
        />
      ))}
      <mesh
        position={[0, 13, 0]}
        scale={[1, 0.8, 1]}
        geometry={cache.largeCrownMainGeo}
        material={i % 2 ? cache.foliageLargeOddMat : cache.foliageLargeEvenMat}
        castShadow
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 3.5, 11.6, 1]}
          geometry={cache.largeCrownSideGeo}
          material={cache.foliageLargeSideMat}
          castShadow
        />
      ))}
    </group>
  );
}

export function Trees() {
  return (
    <>
      {ward.largeTrees.map((t, i) => (
        <Tree key={t.id} t={t} i={i} />
      ))}
      {ward.trees.map((t, i) => (
        <Tree key={t.id} t={t} i={i} variant="canopy" />
      ))}
    </>
  );
}

export function FarmTrees() {
  return (
    <>
      {ward.farmTrees.map((t) => (
        <Tree key={t.id} t={t} variant="farm" />
      ))}
    </>
  );
}
