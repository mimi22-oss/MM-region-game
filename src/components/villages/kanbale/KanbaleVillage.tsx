import { memo, useMemo } from 'react';
import { BufferGeometry, Vector3 } from 'three';
import {
  kanbaleBoundaryWorldPoints,
  kanbaleBoundaryBounds,
} from '../../../data/villages/kanbale/kanbaleMeta';
import { KanbaleDrain } from './KanbaleDrain';
import { diagnosticConfig } from '../../../game/diagnosticMode';

/**
 * Kanbale Village regional shell (boundary loop + waterway drain + base ground plinth).
 * Detailed buildings (669), roads (45), custom landmarks (Farmhouse/School), and trees (170)
 * stream on demand through `KanbaleChunkTiles` from versioned JSON spatial chunks.
 */
export const KanbaleVillage = memo(function KanbaleVillage() {
  const boundaryLineGeom = useMemo(() => {
    const geom = new BufferGeometry();
    const pts = kanbaleBoundaryWorldPoints.map(
      (p) => new Vector3(p[0], 0.25, p[1]),
    );
    geom.setFromPoints(pts);
    return geom;
  }, []);

  const groundCenterX = (kanbaleBoundaryBounds.minX + kanbaleBoundaryBounds.maxX) / 2;
  const groundCenterZ = (kanbaleBoundaryBounds.minZ + kanbaleBoundaryBounds.maxZ) / 2;
  const groundWidth = kanbaleBoundaryBounds.maxX - kanbaleBoundaryBounds.minX + 160;
  const groundDepth = kanbaleBoundaryBounds.maxZ - kanbaleBoundaryBounds.minZ + 160;

  return (
    <group name="village-kanbale">
      <mesh
        position={[groundCenterX, -0.06, groundCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        userData={{ walkable: true }}
      >
        <planeGeometry args={[groundWidth, groundDepth]} />
        <meshStandardMaterial color="#889c62" roughness={0.9} />
      </mesh>

      {!diagnosticConfig.disableOSM && (
        <lineLoop geometry={boundaryLineGeom}>
          <lineBasicMaterial color="#eab308" linewidth={2} />
        </lineLoop>
      )}

      <KanbaleDrain />
    </group>
  );
});
