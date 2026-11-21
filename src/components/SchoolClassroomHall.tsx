import { memo, useMemo } from 'react';
import { getSchoolBuildingAssetCache } from '../game/schoolBuildingAssets';
import { computeClassroomLayout, type SchoolHallSpec } from '../game/schoolClassrooms';

/**
 * ============================================================================
 * Walk-In Multi-Classroom School Hall (`<SchoolClassroomHall>`)
 * ============================================================================
 *
 * Uses ONLY Singleton `getSchoolBuildingAssetCache()` geometries & materials:
 * - Raised walkable concrete plinth + open front corridor/veranda with colonnade pillars
 * - Distinct solid interior partition walls separating EVERY classroom
 * - Wide walk-in open doorways + swung-open wooden doors + per-room grade plaques
 * - Large louvered windows on corridor & rear walls so classrooms are visible inside & out
 * - Authentic Myanmar classroom interior in EVERY separated room:
 *   green chalkboard (`ကျောက်သင်ပုန်း`), teacher podium/desk, and student desk/bench rows
 * - Pitched gable roof overhanging the open corridor
 */
export const SchoolClassroomHall = memo(function SchoolClassroomHall({
  spec,
  selected = false,
  onClick,
}: {
  spec: SchoolHallSpec;
  selected?: boolean;
  onClick?: (e: { stopPropagation: () => void }) => void;
}) {
  const c = getSchoolBuildingAssetCache();
  const layout = useMemo(() => computeClassroomLayout(spec), [spec]);

  const wallMat = c.getWallMat(selected ? '#fef08a' : spec.wallColor);
  const roofMat = c.getRoofMat(selected ? '#38bdf8' : spec.roofColor);

  const {
    hallLength,
    hallDepth,
    canonicalRotation,
    floorY,
    wallHeight,
    verandaDepth,
    zBack,
    zFrontWall,
    zVerandaEdge,
    wallThickness,
    classrooms,
  } = layout;

  const isTwoStorey = spec.storeys === 2;
  const totalWallH = isTwoStorey ? wallHeight * 2 + 0.25 : wallHeight;
  const roofBaseY = floorY + totalWallH;
  const roofPitch = Math.max(1.8, Math.min(2.6, hallDepth * 0.24));
  const roofSlopeLen = Math.hypot(hallDepth / 2, roofPitch) + 0.9;
  const roofAngle = Math.atan2(roofPitch, hallDepth / 2);
  const roomDepth = zFrontWall - zBack;
  const doorH = 2.35;

  // Corridor pillars spaced cleanly along the veranda edge
  const pillarCount = Math.max(3, Math.round(hallLength / 4.8) + 1);
  const pillarXs = useMemo(
    () =>
      Array.from({ length: pillarCount }, (_, idx) =>
        -hallLength / 2 + 0.4 + (idx / Math.max(1, pillarCount - 1)) * (hallLength - 0.8),
      ),
    [hallLength, pillarCount],
  );

  return (
    <group
      name={`school-hall-${spec.id}`}
      position={[spec.x, 0, spec.z]}
      rotation={[0, canonicalRotation, 0]}
      onClick={onClick}
    >
      {/* 1. Raised Walkable Concrete Plinth & Corridor Floor */}
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY / 2, 0]}
        scale={[hallLength + 0.8, floorY, hallDepth + 0.6]}
        geometry={c.unitBoxGeo}
        material={c.plinthMat}
        receiveShadow
      />
      {/* Classroom Interior Floor Slab */}
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY + 0.01, (zBack + zFrontWall) / 2]}
        scale={[hallLength - 0.1, 0.02, roomDepth]}
        geometry={c.unitBoxGeo}
        material={c.floorMat}
        receiveShadow
      />
      {/* Open Veranda / Corridor Walkway */}
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY + 0.015, (zFrontWall + zVerandaEdge) / 2]}
        scale={[hallLength, 0.025, verandaDepth]}
        geometry={c.unitBoxGeo}
        material={c.corridorFloorMat}
        receiveShadow
      />
      {/* Front Entry Step along Corridor */}
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY * 0.45, zVerandaEdge + 0.45]}
        scale={[hallLength - 1.2, floorY * 0.9, 0.55]}
        geometry={c.unitBoxGeo}
        material={c.plinthMat}
        receiveShadow
      />

      {/* 2. Rear Exterior Wall (continuous) + Left & Right Exterior End Walls */}
      <mesh
        position={[0, floorY + wallHeight / 2, zBack]}
        scale={[hallLength, wallHeight, wallThickness]}
        geometry={c.unitBoxGeo}
        material={wallMat}
        castShadow
        receiveShadow
      />
      {([-1, 1] as const).map(side => (
        <mesh
          key={`end-wall-${side}`}
          position={[
            side * (hallLength / 2 - wallThickness / 2),
            floorY + wallHeight / 2,
            (zBack + zFrontWall) / 2,
          ]}
          scale={[wallThickness, wallHeight, roomDepth + wallThickness]}
          geometry={c.unitBoxGeo}
          material={wallMat}
          castShadow
          receiveShadow
        />
      ))}

      {/* 3. Open Corridor Colonnade Pillars + Top Fascia Beam */}
      {pillarXs.map((px, idx) => (
        <mesh
          key={`pillar-${idx}`}
          position={[px, floorY + wallHeight / 2, zVerandaEdge - 0.25]}
          scale={[0.26, wallHeight, 0.26]}
          geometry={c.unitBoxGeo}
          material={c.pillarMat}
          castShadow
        />
      ))}
      <mesh
        position={[0, floorY + wallHeight - 0.15, zVerandaEdge - 0.25]}
        scale={[hallLength, 0.3, 0.3]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />

      {/* 4. Separated Individual Classrooms (Partition Walls, Open Doors, Plaques, Blackboards & Desks!) */}
      {classrooms.map((room, idx) => {
        const doorMinX = room.doorX - room.doorWidth / 2;
        const doorMaxX = room.doorX + room.doorWidth / 2;
        const leftPierW = Math.max(0, doorMinX - room.xMin);
        const rightPierW = Math.max(0, room.xMax - doorMaxX);
        const transomH = Math.max(0.3, wallHeight - doorH);
        const plaqueMat = c.getRoomPlaqueMat(room.label);

        // Compute neat 2-column × 2-or-3-row student desk layout inside each separated classroom
        const deskRows = roomDepth >= 7.2 ? 3 : 2;
        const deskCols = room.roomWidth >= 6.0 ? 2 : 1;
        const deskW = deskCols === 2 ? Math.min(2.1, room.roomWidth * 0.34) : Math.min(2.4, room.roomWidth * 0.56);

        return (
          <group key={`room-${idx}`}>
            {/* Solid Interior Partition Wall separating this classroom from the next */}
            {idx < classrooms.length - 1 && (
              <mesh
                position={[
                  room.xMax,
                  floorY + wallHeight / 2,
                  (zBack + zFrontWall) / 2,
                ]}
                scale={[wallThickness, wallHeight, roomDepth]}
                geometry={c.unitBoxGeo}
                material={c.partitionWallMat}
                castShadow
                receiveShadow
              />
            )}

            {/* Front Corridor Wall — Left Pier */}
            {leftPierW > 0.08 && (
              <mesh
                position={[room.xMin + leftPierW / 2, floorY + wallHeight / 2, zFrontWall]}
                scale={[leftPierW, wallHeight, wallThickness]}
                geometry={c.unitBoxGeo}
                material={wallMat}
                castShadow
                receiveShadow
              />
            )}

            {/* Front Corridor Wall — Right Pier (with framed classroom window) */}
            {rightPierW > 0.08 && (
              <>
                <mesh
                  position={[doorMaxX + rightPierW / 2, floorY + wallHeight / 2, zFrontWall]}
                  scale={[rightPierW, wallHeight, wallThickness]}
                  geometry={c.unitBoxGeo}
                  material={wallMat}
                  castShadow
                  receiveShadow
                />
                {room.windowWidth >= 0.9 && (
                  <group position={[room.windowX, floorY + 1.85, zFrontWall]}>
                    <mesh
                      scale={[room.windowWidth, 1.35, wallThickness + 0.08]}
                      geometry={c.unitBoxGeo}
                      material={c.windowGlassMat}
                    />
                    <mesh
                      scale={[room.windowWidth + 0.12, 0.08, wallThickness + 0.12]}
                      geometry={c.unitBoxGeo}
                      material={c.windowFrameMat}
                    />
                  </group>
                )}
              </>
            )}

            {/* Transom Wall Above Open Classroom Doorway */}
            <mesh
              position={[room.doorX, floorY + doorH + transomH / 2, zFrontWall]}
              scale={[room.doorWidth + 0.08, transomH, wallThickness]}
              geometry={c.unitBoxGeo}
              material={wallMat}
            />

            {/* Open Wooden Door Frame + Open Door Leaf swung neatly inside */}
            <mesh
              position={[doorMinX + 0.05, floorY + doorH / 2, zFrontWall]}
              scale={[0.1, doorH, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.doorFrameMat}
            />
            <mesh
              position={[doorMaxX - 0.05, floorY + doorH / 2, zFrontWall]}
              scale={[0.1, doorH, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.doorFrameMat}
            />
            <mesh
              position={[room.doorX, floorY + doorH - 0.05, zFrontWall]}
              scale={[room.doorWidth, 0.1, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.doorFrameMat}
            />
            {/* Swung-Open Wooden Door Leaf resting inside doorway so students & player walk straight through */}
            <mesh
              position={[doorMinX + 0.14, floorY + doorH / 2 - 0.03, zFrontWall - 0.56]}
              scale={[0.08, doorH - 0.12, Math.min(1.05, room.doorWidth * 0.65)]}
              geometry={c.unitBoxGeo}
              material={c.doorLeafMat}
            />

            {/* Classroom Grade / Room Divider Signboard Plaque above every doorway */}
            <mesh
              position={[room.doorX, floorY + doorH + 0.34, zFrontWall + wallThickness / 2 + 0.04]}
              scale={[1.45, 0.48, 0.05]}
              geometry={c.unitBoxGeo}
              material={plaqueMat}
            />

            {/* Rear Exterior Window per Classroom */}
            <mesh
              position={[room.cx, floorY + 1.85, zBack]}
              scale={[Math.min(2.8, room.roomWidth * 0.45), 1.35, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.windowGlassMat}
            />

            {/* INTERIOR: Classic Myanmar Green Blackboard (`ကျောက်သင်ပုန်း`) on Rear Wall */}
            <group position={[room.cx, floorY + 1.75, zBack + wallThickness / 2 + 0.05]}>
              <mesh
                scale={[Math.min(3.4, room.roomWidth * 0.54), 1.35, 0.06]}
                geometry={c.unitBoxGeo}
                material={c.chalkboardFrameMat}
              />
              <mesh
                position={[0, 0, 0.025]}
                scale={[Math.min(3.2, room.roomWidth * 0.5), 1.18, 0.04]}
                geometry={c.unitBoxGeo}
                material={c.chalkboardMat}
              />
              <mesh
                position={[0, -0.68, 0.08]}
                scale={[Math.min(3.0, room.roomWidth * 0.46), 0.07, 0.14]}
                geometry={c.unitBoxGeo}
                material={c.chalkTrayMat}
              />
            </group>

            {/* INTERIOR: Teacher's Desk & Podium facing the classroom */}
            <group position={[room.cx - Math.min(0.9, room.roomWidth * 0.15), floorY, zBack + 1.35]}>
              <mesh
                position={[0, 0.74, 0]}
                scale={[1.35, 0.08, 0.72]}
                geometry={c.unitBoxGeo}
                material={c.teacherDeskMat}
              />
              <mesh
                position={[0, 0.37, 0]}
                scale={[1.22, 0.7, 0.62]}
                geometry={c.unitBoxGeo}
                material={c.deskFrameMat}
              />
            </group>

            {/* INTERIOR: Student Wooden Desks & Benches arranged in clean rows with walking aisle */}
            {Array.from({ length: deskRows }, (_, rIdx) => {
              const deskZ = zBack + 2.5 + rIdx * Math.min(1.45, (roomDepth - 3.2) / Math.max(1, deskRows));
              if (deskZ > zFrontWall - 0.8) return null;
              return Array.from({ length: deskCols }, (__, cIdx) => {
                const deskX =
                  deskCols === 2
                    ? room.cx + (cIdx === 0 ? -room.roomWidth * 0.24 : room.roomWidth * 0.24)
                    : room.cx;
                return (
                  <group key={`desk-${rIdx}-${cIdx}`} position={[deskX, floorY, deskZ]}>
                    {/* Desk Top */}
                    <mesh
                      position={[0, 0.72, 0]}
                      scale={[deskW, 0.06, 0.46]}
                      geometry={c.unitBoxGeo}
                      material={c.deskTopMat}
                    />
                    {/* Desk Side Legs */}
                    <mesh
                      position={[-deskW * 0.42, 0.36, 0]}
                      scale={[0.07, 0.7, 0.4]}
                      geometry={c.unitBoxGeo}
                      material={c.deskFrameMat}
                    />
                    <mesh
                      position={[deskW * 0.42, 0.36, 0]}
                      scale={[0.07, 0.7, 0.4]}
                      geometry={c.unitBoxGeo}
                      material={c.deskFrameMat}
                    />
                    {/* Attached Student Bench behind desk */}
                    <mesh
                      position={[0, 0.44, 0.42]}
                      scale={[deskW, 0.06, 0.28]}
                      geometry={c.unitBoxGeo}
                      material={c.deskTopMat}
                    />
                    <mesh
                      position={[-deskW * 0.42, 0.22, 0.42]}
                      scale={[0.06, 0.42, 0.24]}
                      geometry={c.unitBoxGeo}
                      material={c.deskFrameMat}
                    />
                    <mesh
                      position={[deskW * 0.42, 0.22, 0.42]}
                      scale={[0.06, 0.42, 0.24]}
                      geometry={c.unitBoxGeo}
                      material={c.deskFrameMat}
                    />
                  </group>
                );
              });
            })}
          </group>
        );
      })}

      {/* 5. Ground-Floor Ceiling Slab (also forms 2nd-storey floor for 2-storey halls!) */}
      <mesh
        position={[0, floorY + wallHeight + 0.09, 0]}
        scale={[hallLength + 0.2, 0.18, hallDepth + 0.2]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />

      {/* Optional Upper Storey for 2-Storey High School / University Halls */}
      {isTwoStorey && (
        <group position={[0, floorY + wallHeight + 0.18, 0]}>
          <mesh
            position={[0, wallHeight / 2, (zBack + zFrontWall) / 2]}
            scale={[hallLength, wallHeight, roomDepth]}
            geometry={c.unitBoxGeo}
            material={wallMat}
            castShadow
          />
          {/* Upper Veranda Rail & Pillars */}
          <mesh
            position={[0, 0.55, zVerandaEdge - 0.15]}
            scale={[hallLength, 1.05, 0.14]}
            geometry={c.unitBoxGeo}
            material={c.pillarMat}
          />
          {pillarXs.map((px, idx) => (
            <mesh
              key={`upper-pillar-${idx}`}
              position={[px, wallHeight / 2, zVerandaEdge - 0.25]}
              scale={[0.24, wallHeight, 0.24]}
              geometry={c.unitBoxGeo}
              material={c.pillarMat}
            />
          ))}
          {classrooms.map((room, idx) => (
            <mesh
              key={`upper-win-${idx}`}
              position={[room.cx, 1.9, zFrontWall + 0.06]}
              scale={[Math.min(3.0, room.roomWidth * 0.5), 1.4, 0.12]}
              geometry={c.unitBoxGeo}
              material={c.windowGlassMat}
            />
          ))}
        </group>
      )}

      {/* 6. Pitched Gable Roof overhanging Veranda & Classrooms */}
      {([-1, 1] as const).map(side => (
        <mesh
          key={`roof-${side}`}
          position={[0, roofBaseY + roofPitch / 2, side * (hallDepth / 4)]}
          rotation={[side * roofAngle, 0, 0]}
          scale={[hallLength + 1.4, 0.24, roofSlopeLen]}
          geometry={c.unitBoxGeo}
          material={roofMat}
          castShadow
        />
      ))}
      {/* Roof Ridge Cap */}
      <mesh
        position={[0, roofBaseY + roofPitch + 0.08, 0]}
        scale={[hallLength + 1.45, 0.18, 0.36]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />
    </group>
  );
});
