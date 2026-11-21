import { memo } from 'react';
import { getSchoolBuildingAssetCache } from '../game/schoolBuildingAssets';
import type {
  SchoolCampusCompoundSpec,
  SchoolCampusRestPavilion,
} from '../data/wards/myothar/center/myotharSchoolCampus';

/**
 * Shared Singleton Myanmar National Flagpole (`ကျောင်းအလံတိုင်`) on 3-Tiered Stepped Ceremony Podium.
 * Reused across Myothar, Thar Si, Kanbale, and Htauk Kyant schools with ZERO duplicated GPU geometries/materials!
 */
export const SchoolFlagpole = memo(function SchoolFlagpole({
  name = 'school-flagpole',
  x = 0,
  z = 0,
  rotation = 0,
}: {
  name?: string;
  x?: number;
  z?: number;
  rotation?: number;
}) {
  const c = getSchoolBuildingAssetCache();
  const redMat = c.getRoofMat('#dc2626');
  const yellowMat = c.getRoofMat('#facc15');
  const greenFlagMat = c.getRoofMat('#16a34a');
  const steelMat = c.getWallMat('#e2e8f0');
  const whiteMat = c.pillarMat;

  return (
    <group name={name} position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.18, 0]} scale={[3.2, 0.36, 3.2]} geometry={c.unitBoxGeo} material={redMat} castShadow receiveShadow />
      <mesh position={[0, 0.48, 0]} scale={[2.4, 0.26, 2.4]} geometry={c.unitBoxGeo} material={whiteMat} castShadow receiveShadow />
      <mesh position={[0, 0.72, 0]} scale={[1.6, 0.22, 1.6]} geometry={c.unitBoxGeo} material={redMat} castShadow receiveShadow />
      <mesh position={[0, 6.45, 0]} scale={[0.16, 11.4, 0.16]} geometry={c.unitCylGeo} material={steelMat} castShadow />
      <mesh position={[0, 12.25, 0]} scale={[0.38, 0.38, 0.38]} geometry={c.unitBoxGeo} material={c.signboardGoldMat} />
      <group position={[1.4, 10.9, 0]}>
        <mesh position={[0, 0.5, 0]} scale={[2.6, 0.5, 0.04]} geometry={c.unitBoxGeo} material={yellowMat} />
        <mesh position={[0, 0, 0]} scale={[2.6, 0.5, 0.04]} geometry={c.unitBoxGeo} material={greenFlagMat} />
        <mesh position={[0, -0.5, 0]} scale={[2.6, 0.5, 0.04]} geometry={c.unitBoxGeo} material={redMat} />
        <mesh position={[0, 0, 0.035]} scale={[0.62, 0.62, 0.02]} geometry={c.unitBoxGeo} material={whiteMat} />
        <mesh position={[0, 0, -0.035]} scale={[0.62, 0.62, 0.02]} geometry={c.unitBoxGeo} material={whiteMat} />
      </group>
    </group>
  );
});

/**
 * Reusable Walk-In Shaded Myanmar School Resting Pavilion (`နားနေဆောင်`)
 * using ONLY Singleton `getSchoolBuildingAssetCache()` geometries & materials.
 */
function RestPavilion({ p }: { p: SchoolCampusRestPavilion }) {
  const c = getSchoolBuildingAssetCache();
  const roofMat = c.getRoofMat('#2f6a4f');
  const floorY = 0.24;
  const colH = 2.9;
  const pitch = 1.45;
  const slopeLen = Math.hypot(p.depth / 2, pitch) + 0.55;
  const slopeAng = Math.atan2(pitch, p.depth / 2);

  const px = p.width / 2 - 0.35;
  const pz = p.depth / 2 - 0.35;
  const pillarCoords: readonly [number, number][] = [
    [-px, -pz],
    [0, -pz],
    [px, -pz],
    [-px, pz],
    [0, pz],
    [px, pz],
  ];

  return (
    <group name={p.id} position={[p.x, 0, p.z]} rotation={[0, p.rotation, 0]}>
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY / 2, 0]}
        scale={[p.width, floorY, p.depth]}
        geometry={c.unitBoxGeo}
        material={c.plinthMat}
        receiveShadow
      />
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY + 0.01, 0]}
        scale={[p.width - 0.25, 0.02, p.depth - 0.25]}
        geometry={c.unitBoxGeo}
        material={c.corridorFloorMat}
        receiveShadow
      />

      {pillarCoords.map(([cx, cz], idx) => (
        <mesh
          key={`col-${idx}`}
          position={[cx, floorY + colH / 2, cz]}
          scale={[0.22, colH, 0.22]}
          geometry={c.unitBoxGeo}
          material={c.pillarMat}
          castShadow
        />
      ))}
      <mesh
        position={[0, floorY + colH, -pz]}
        scale={[p.width + 0.1, 0.22, 0.24]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />
      <mesh
        position={[0, floorY + colH, pz]}
        scale={[p.width + 0.1, 0.22, 0.24]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />

      {/* Built-in Wooden Resting Benches flanking wide walk-through central aisle */}
      {([-1, 1] as const).map(side => (
        <group key={`bench-${side}`} position={[side * (p.width / 2 - 0.85), floorY, 0]}>
          <mesh position={[0, 0.44, 0]} scale={[0.52, 0.07, p.depth - 1.4]} geometry={c.unitBoxGeo} material={c.deskTopMat} />
          <mesh position={[0, 0.22, -(p.depth / 2 - 1.0)]} scale={[0.42, 0.44, 0.12]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
          <mesh position={[0, 0.22, p.depth / 2 - 1.0]} scale={[0.42, 0.44, 0.12]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
        </group>
      ))}

      {([-1, 1] as const).map(side => (
        <mesh
          key={`roof-${side}`}
          position={[0, floorY + colH + 0.1 + pitch / 2, side * (p.depth / 4)]}
          rotation={[side * slopeAng, 0, 0]}
          scale={[p.width + 1.0, 0.18, slopeLen]}
          geometry={c.unitBoxGeo}
          material={roofMat}
          castShadow
        />
      ))}
      <mesh
        position={[0, floorY + colH + pitch + 0.15, 0]}
        scale={[p.width + 1.05, 0.14, 0.26]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />
    </group>
  );
}

/**
 * Reusable Full Myanmar Village/Ward School Campus View:
 * - Walkable grassy campus yard + entrance walkway
 * - Paved Assembly Parade Plaza + Stepped Red/White Myanmar National Flagpole (`အလံတိုင်`)
 * - Entrance Archway with Burmese Signboard
 * - Open-air Walk-In Shaded Resting Pavilions (`နားနေဆောင်`)
 * - Classroom halls rendered centrally via Fixed Object Pool (`PooledSchoolHalls`)
 * Reuses 100% Singleton `getSchoolBuildingAssetCache()` GPU geometries & materials (ZERO duplication!).
 */
export const SchoolCampusView = memo(function SchoolCampusView({
  spec,
}: {
  spec: SchoolCampusCompoundSpec;
}) {
  const c = getSchoolBuildingAssetCache();
  const fp = spec.flagpole;
  const plaza = spec.assemblyPlaza;
  const gate = spec.entranceGate;

  const grassMat = c.getWallMat('#4c7c40');
  const redMat = c.getRoofMat('#dc2626');
  const whiteMat = c.pillarMat;
  const signMat = c.getRoomPlaqueMat(spec.name);

  const isHorizontalGate = spec.gateSide === 'east' || spec.gateSide === 'west';
  const gateCurbZ = spec.gateSide === 'north' ? -spec.depth / 2 + 0.3 : spec.depth / 2 - 0.3;
  const gateCurbX = spec.gateSide === 'east' ? spec.width / 2 - 0.3 : -spec.width / 2 + 0.3;
  const gateCenterLocalX = gate.u - spec.u;
  const gateCenterLocalZ = gate.v - spec.v;
  const halfGateOpen = gate.gateWidth / 2 + 0.7;
  const leftCurbSpan = Math.max(2, gateCenterLocalX - halfGateOpen - (-spec.width / 2 + 0.5));
  const rightCurbSpan = Math.max(2, spec.width / 2 - 0.5 - (gateCenterLocalX + halfGateOpen));
  const topCurbSpan = Math.max(2, gateCenterLocalZ - halfGateOpen - (-spec.depth / 2 + 0.5));
  const bottomCurbSpan = Math.max(2, spec.depth / 2 - 0.5 - (gateCenterLocalZ + halfGateOpen));
  const gateHalfSpan = gate.gateWidth / 2 + 0.1;

  return (
    <group name={spec.id}>
      {/* 1. Walkable School Compound Grounds & Entrance Walkway */}
      <group position={[spec.x, 0, spec.z]} rotation={[0, spec.rotation, 0]}>
        <mesh
          userData={{ walkable: true }}
          position={[0, 0.025, 0]}
          scale={[spec.width, 0.05, spec.depth]}
          geometry={c.unitBoxGeo}
          material={grassMat}
          receiveShadow
        />
        <mesh
          userData={{ walkable: true }}
          position={[spec.walkway.localX, 0.05, spec.walkway.localZ]}
          scale={[spec.walkway.width, 0.04, spec.walkway.depth]}
          geometry={c.unitBoxGeo}
          material={c.corridorFloorMat}
          receiveShadow
        />
        {/* Decorative Front Boundary Curbs flanking the open entrance gate (supports North, South, East, West!) */}
        {isHorizontalGate ? (
          <>
            <mesh
              position={[gateCurbX, 0.45, -spec.depth / 2 + 0.5 + topCurbSpan / 2]}
              scale={[0.3, 0.9, topCurbSpan]}
              geometry={c.unitBoxGeo}
              material={whiteMat}
            />
            <mesh
              position={[gateCurbX, 0.45, gateCenterLocalZ + halfGateOpen + bottomCurbSpan / 2]}
              scale={[0.3, 0.9, bottomCurbSpan]}
              geometry={c.unitBoxGeo}
              material={whiteMat}
            />
          </>
        ) : (
          <>
            <mesh
              position={[-spec.width / 2 + 0.5 + leftCurbSpan / 2, 0.45, gateCurbZ]}
              scale={[leftCurbSpan, 0.9, 0.3]}
              geometry={c.unitBoxGeo}
              material={whiteMat}
            />
            <mesh
              position={[gateCenterLocalX + halfGateOpen + rightCurbSpan / 2, 0.45, gateCurbZ]}
              scale={[rightCurbSpan, 0.9, 0.3]}
              geometry={c.unitBoxGeo}
              material={whiteMat}
            />
          </>
        )}
      </group>

      {/* 2. Paved Assembly Parade Ground with White March Lines */}
      <group position={[plaza.x, 0, plaza.z]} rotation={[0, plaza.rotation, 0]}>
        <mesh
          userData={{ walkable: true }}
          position={[0, 0.055, 0]}
          scale={[plaza.width, 0.06, plaza.depth]}
          geometry={c.unitBoxGeo}
          material={c.plinthMat}
          receiveShadow
        />
        {[-7.5, -3.75, 0, 3.75, 7.5].map(offset => (
          <mesh
            key={`march-line-${offset}`}
            position={
              isHorizontalGate
                ? [spec.gateSide === 'east' ? 2.8 : -2.8, 0.09, offset]
                : [offset, 0.09, spec.gateSide === 'north' ? 3.0 : -3.0]
            }
            scale={
              isHorizontalGate
                ? [Math.min(10, plaza.width * 0.48), 0.015, 0.16]
                : [0.16, 0.015, Math.min(11, plaza.depth * 0.5)]
            }
            geometry={c.unitBoxGeo}
            material={whiteMat}
          />
        ))}
      </group>

      {/* 3. Shared Singleton Myanmar National Flagpole (`ကျောင်းအလံတိုင်`) */}
      <SchoolFlagpole name={`${spec.id}-flagpole`} x={fp.x} z={fp.z} rotation={fp.rotation} />

      {/* 4. School Entrance Archway & Signboard */}
      <group name={`${spec.id}-gate`} position={[gate.x, 0, gate.z]} rotation={[0, gate.rotation, 0]}>
        <mesh position={[-gateHalfSpan, 2.3, 0]} scale={[0.85, 4.6, 0.85]} geometry={c.unitBoxGeo} material={whiteMat} castShadow />
        <mesh position={[gateHalfSpan, 2.3, 0]} scale={[0.85, 4.6, 0.85]} geometry={c.unitBoxGeo} material={whiteMat} castShadow />
        <mesh position={[-gateHalfSpan, 4.7, 0]} scale={[1.1, 0.26, 1.1]} geometry={c.unitBoxGeo} material={redMat} />
        <mesh position={[gateHalfSpan, 4.7, 0]} scale={[1.1, 0.26, 1.1]} geometry={c.unitBoxGeo} material={redMat} />
        <mesh position={[0, 4.45, 0]} scale={[gate.gateWidth + 1.2, 0.42, 0.55]} geometry={c.unitBoxGeo} material={c.signboardBgMat} castShadow />
        <mesh position={[0, 4.45, -0.3]} scale={[Math.min(8.8, gate.gateWidth - 0.8), 1.05, 0.12]} geometry={c.unitBoxGeo} material={signMat} />
        <mesh position={[0, 4.45, 0.3]} scale={[Math.min(8.8, gate.gateWidth - 0.8), 1.05, 0.12]} geometry={c.unitBoxGeo} material={signMat} />
      </group>

      {/* 5. Walk-In Shaded Resting Pavilions (`နားနေဆောင်`) */}
      {spec.restPavilions.map(p => (
        <RestPavilion key={p.id} p={p} />
      ))}

      {/* Classroom Halls are rendered centrally via Fixed Object Pool (`<PooledSchoolHalls>`) with zero duplication! */}
    </group>
  );
});
