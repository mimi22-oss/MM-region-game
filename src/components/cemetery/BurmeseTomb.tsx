import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { DEFAULT_TOMB_EPITAPH, getCemeteryTombAssetCache } from '../../game/cemeteryTombAssets';
export { BURMESE_TOMB_PALETTES, getCemeteryTombAssetCache, disposeCemeteryTombAssetCache, type CemeteryTombAssetCache, type TombPalette } from '../../game/cemeteryTombAssets';

export type CemeteryTombKind = 'burmese' | 'christian';

export interface BurmeseTombProps {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly rotation?: number;
  readonly scale?: number;
  readonly bodyColor?: string;
  readonly epitaphTitle?: string;
  readonly epitaphSubtitle?: string;
}

/**
 * Standalone Reusable Burmese Buddhist Masonry Tomb Component (`ဗမာပုံစံ အုတ်ဂူ`).
 * Can be placed individually anywhere or inside a cemetery compound.
 */
export const BurmeseTomb = memo(function BurmeseTomb({
  x = 0,
  y = 0,
  z = 0,
  rotation = 0,
  scale = 1,
  bodyColor = '#f8fafc',
  epitaphTitle = DEFAULT_TOMB_EPITAPH[0],
  epitaphSubtitle = DEFAULT_TOMB_EPITAPH[1],
}: BurmeseTombProps) {
  const c = getCemeteryTombAssetCache();
  const bodyMat = c.getBodyMat(bodyColor);
  const epitaphMat = useMemo(
    () => c.getEpitaphMat(epitaphTitle, epitaphSubtitle),
    [c, epitaphTitle, epitaphSubtitle],
  );

  return (
    <group
      position={[x, y, z]}
      rotation={[0, rotation, 0]}
      scale={[scale, scale, scale]}
      name="burmese-masonry-tomb"
      dispose={null}
    >
      {/* Pre-merged realistic Burmese masonry tomb body + stepped headstone */}
      <mesh geometry={c.burmeseTombBodyGeo} material={bodyMat} castShadow receiveShadow />
      {/* Contrasting marble epitaph block + lotus finial + offering flowers */}
      <mesh geometry={c.burmeseTombAccentGeo} material={c.tombAccentInstancedMat} />
      <mesh geometry={c.inscriptionGeo} material={epitaphMat} />
    </group>
  );
});

export interface CemeteryTombProps extends BurmeseTombProps {
  /** Tomb architectural tradition (`'burmese'` default; ready for `'christian'` tombs next) */
  readonly kind?: CemeteryTombKind;
}

/**
 * Forward-Compatible Multi-Tradition Cemetery Tomb Dispatcher (`<CemeteryTomb />`).
 */
export const CemeteryTomb = memo(function CemeteryTomb({
  kind = 'burmese',
  ...props
}: CemeteryTombProps) {
  // Currently renders Burmese Buddhist masonry tomb; `'christian'` variant plugs in here cleanly next
  void kind;
  return <BurmeseTomb {...props} />;
});

export interface InstancedTombRecord {
  readonly x: number;
  readonly z: number;
  readonly rotation: number;
  readonly tilt: number;
  readonly scaleY: number;
  readonly bodyColor: string;
  readonly accentColor: string;
}

/**
 * Shared geometry and one inscription material per spatial batch.
 */
export const BurmeseTombInstancedBatch = memo(function BurmeseTombInstancedBatch({
  tombs,
}: {
  tombs: readonly InstancedTombRecord[];
}) {
  const c = getCemeteryTombAssetCache();
  const bodyRef = useRef<InstancedMesh>(null);
  const accentRef = useRef<InstancedMesh>(null);
  const inscriptionRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!bodyRef.current || !accentRef.current || !inscriptionRef.current || tombs.length === 0) return;

    const dummy = new Object3D();
    const color = new Color();
    const count = tombs.length;

    for (let i = 0; i < count; i++) {
      const g = tombs[i];
      dummy.position.set(g.x, 0, g.z);
      dummy.rotation.set(0, g.rotation + g.tilt * 0.25, 0);
      dummy.scale.set(1, g.scaleY, 1);
      dummy.updateMatrix();

      bodyRef.current.setMatrixAt(i, dummy.matrix);
      color.set(g.bodyColor);
      bodyRef.current.setColorAt(i, color);

      accentRef.current.setMatrixAt(i, dummy.matrix);
      inscriptionRef.current.setMatrixAt(i, dummy.matrix);
    }

    bodyRef.current.instanceMatrix.needsUpdate = true;
    if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
    bodyRef.current.computeBoundingSphere();

    accentRef.current.instanceMatrix.needsUpdate = true;
    accentRef.current.computeBoundingSphere();
    inscriptionRef.current.instanceMatrix.needsUpdate = true;
    inscriptionRef.current.computeBoundingSphere();
  }, [tombs]);

  if (tombs.length === 0) return null;

  return (
    <group name="burmese-tomb-instanced-batch">
      <instancedMesh
        ref={bodyRef}
        args={[c.burmeseTombBodyGeo, c.tombBodyInstancedMat, tombs.length]}
        receiveShadow
      />
      <instancedMesh
        ref={accentRef}
        args={[c.burmeseTombAccentGeo, c.tombAccentInstancedMat, tombs.length]}
      />
      <instancedMesh
        ref={inscriptionRef}
        args={[c.inscriptionGeo, c.getEpitaphMat(...DEFAULT_TOMB_EPITAPH), tombs.length]}
      />
    </group>
  );
});
