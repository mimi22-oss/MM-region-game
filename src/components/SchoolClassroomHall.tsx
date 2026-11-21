import { memo, useMemo } from 'react';
import { getSchoolBuildingAssetCache, type SchoolBuildingAssetCache } from '../game/schoolBuildingAssets';
import {
  STUDENT_DESK,
  computeClassroomDeskSpecs,
  computeClassroomLayout,
  type ClassroomHallLayout,
  type SchoolHallSpec,
  type SeparatedClassroomSlot,
} from '../game/schoolClassrooms';
import type { MeshStandardMaterial } from 'three';

/**
 * Renders one complete walk-in separated classroom storey (Ground Floor OR 2nd Floor)
 * using ONLY Singleton `getSchoolBuildingAssetCache()` geometries & materials.
 */
function ClassroomStoreyLevel({
  c,
  layout,
  rooms,
  baseY,
  wallMat,
  pillarXs,
  isUpperStorey,
}: {
  c: SchoolBuildingAssetCache;
  layout: ClassroomHallLayout;
  rooms: readonly SeparatedClassroomSlot[];
  baseY: number;
  wallMat: MeshStandardMaterial;
  pillarXs: readonly number[];
  isUpperStorey: boolean;
}) {
  const {
    hallLength,
    hallDepth,
    wallHeight,
    verandaDepth,
    zBack,
    zFrontWall,
    zVerandaEdge,
    wallThickness,
    stairStartX,
    stairRunLength,
  } = layout;
  const roomDepth = zFrontWall - zBack;
  const doorH = 2.35;

  // On 2nd floor, leave a clean 1.8m opening in the veranda railing right at the top landing of the exterior stairs!
  const stairTopX = stairStartX + stairRunLength;
  const railOpeningMin = stairTopX - 0.2;
  const railOpeningMax = Math.min(hallLength / 2 - 0.1, stairTopX + 1.85);
  const leftRailW = Math.max(0, railOpeningMin - (-hallLength / 2));
  const rightRailW = Math.max(0, hallLength / 2 - railOpeningMax);

  return (
    <group position={[0, baseY, 0]}>
      {/* Walkable Classroom Interior Floor Slab & Open Veranda Walkway */}
      <mesh
        userData={{ walkable: true }}
        position={[0, 0.01, (zBack + zFrontWall) / 2]}
        scale={[hallLength - 0.1, 0.02, roomDepth]}
        geometry={c.unitBoxGeo}
        material={c.floorMat}
        receiveShadow
      />
      <mesh
        userData={{ walkable: true }}
        position={[0, 0.015, (zFrontWall + zVerandaEdge) / 2]}
        scale={[hallLength, 0.025, verandaDepth]}
        geometry={c.unitBoxGeo}
        material={c.corridorFloorMat}
        receiveShadow
      />

      {/* Rear Exterior Wall + Left & Right Exterior End Walls */}
      <mesh
        position={[0, wallHeight / 2, zBack]}
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
            wallHeight / 2,
            (zBack + zFrontWall) / 2,
          ]}
          scale={[wallThickness, wallHeight, roomDepth + wallThickness]}
          geometry={c.unitBoxGeo}
          material={wallMat}
          castShadow
          receiveShadow
        />
      ))}

      {/* Open Corridor Colonnade Pillars + Top Fascia Beam */}
      {pillarXs.map((px, idx) => (
        <mesh
          key={`pillar-${idx}`}
          position={[px, wallHeight / 2, zVerandaEdge - 0.25]}
          scale={[0.26, wallHeight, 0.26]}
          geometry={c.unitBoxGeo}
          material={c.pillarMat}
          castShadow
        />
      ))}
      <mesh
        position={[0, wallHeight - 0.15, zVerandaEdge - 0.25]}
        scale={[hallLength, 0.3, 0.3]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />

      {/* 2nd-Storey Veranda Safety Balustrade (with open landing gate for the staircase!) */}
      {isUpperStorey && (
        <>
          {leftRailW > 0.2 && (
            <mesh
              position={[-hallLength / 2 + leftRailW / 2, 0.52, zVerandaEdge - 0.12]}
              scale={[leftRailW, 1.0, 0.14]}
              geometry={c.unitBoxGeo}
              material={c.pillarMat}
            />
          )}
          {rightRailW > 0.2 && (
            <mesh
              position={[railOpeningMax + rightRailW / 2, 0.52, zVerandaEdge - 0.12]}
              scale={[rightRailW, 1.0, 0.14]}
              geometry={c.unitBoxGeo}
              material={c.pillarMat}
            />
          )}
        </>
      )}

      {/* Separated Individual Classrooms (Partition Walls, Open Doors, Plaques, Blackboards & Desks!) */}
      {rooms.map((room, idx) => {
        const doorMinX = room.doorX - room.doorWidth / 2;
        const doorMaxX = room.doorX + room.doorWidth / 2;
        const leftPierW = Math.max(0, doorMinX - room.xMin);
        const rightPierW = Math.max(0, room.xMax - doorMaxX);
        const transomH = Math.max(0.3, wallHeight - doorH);
        const plaqueMat = c.getRoomPlaqueMat(room.label);
        const deskSpecs = computeClassroomDeskSpecs(room, roomDepth, zBack);

        return (
          <group key={`room-${idx}`}>
            {/* Solid Interior Partition Wall separating adjacent classrooms */}
            {idx < rooms.length - 1 && (
              <mesh
                position={[room.xMax, wallHeight / 2, (zBack + zFrontWall) / 2]}
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
                position={[room.xMin + leftPierW / 2, wallHeight / 2, zFrontWall]}
                scale={[leftPierW, wallHeight, wallThickness]}
                geometry={c.unitBoxGeo}
                material={wallMat}
                castShadow
                receiveShadow
              />
            )}

            {/* Front Corridor Wall — Right Pier + Window */}
            {rightPierW > 0.08 && (
              <>
                <mesh
                  position={[doorMaxX + rightPierW / 2, wallHeight / 2, zFrontWall]}
                  scale={[rightPierW, wallHeight, wallThickness]}
                  geometry={c.unitBoxGeo}
                  material={wallMat}
                  castShadow
                  receiveShadow
                />
                {room.windowWidth >= 0.9 && (
                  <group position={[room.windowX, 1.85, zFrontWall]}>
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

            {/* Transom Above Doorway + Open Wooden Door Frame & Swung-Open Leaf */}
            <mesh
              position={[room.doorX, doorH + transomH / 2, zFrontWall]}
              scale={[room.doorWidth + 0.08, transomH, wallThickness]}
              geometry={c.unitBoxGeo}
              material={wallMat}
            />
            <mesh
              position={[doorMinX + 0.05, doorH / 2, zFrontWall]}
              scale={[0.1, doorH, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.doorFrameMat}
            />
            <mesh
              position={[doorMaxX - 0.05, doorH / 2, zFrontWall]}
              scale={[0.1, doorH, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.doorFrameMat}
            />
            <mesh
              position={[room.doorX, doorH - 0.05, zFrontWall]}
              scale={[room.doorWidth, 0.1, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.doorFrameMat}
            />
            <mesh
              position={[doorMinX + 0.14, doorH / 2 - 0.03, zFrontWall - 0.56]}
              scale={[0.08, doorH - 0.12, Math.min(1.05, room.doorWidth * 0.65)]}
              geometry={c.unitBoxGeo}
              material={c.doorLeafMat}
            />

            {/* Room Divider Plaque above doorway */}
            <mesh
              position={[room.doorX, doorH + 0.34, zFrontWall + wallThickness / 2 + 0.04]}
              scale={[1.45, 0.48, 0.05]}
              geometry={c.unitBoxGeo}
              material={plaqueMat}
            />

            {/* Rear Window */}
            <mesh
              position={[room.cx, 1.85, zBack]}
              scale={[Math.min(2.8, room.roomWidth * 0.45), 1.35, wallThickness + 0.08]}
              geometry={c.unitBoxGeo}
              material={c.windowGlassMat}
            />

            {/* Green Blackboard (`ကျောက်သင်ပုန်း`) */}
            <group position={[room.cx, 1.75, zBack + wallThickness / 2 + 0.05]}>
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

            {/* Teacher's Desk with Stacked Books (`စာအုပ်အထပ်များ`) & Wooden Chair behind Desk */}
            <group position={[room.cx - Math.min(0.9, room.roomWidth * 0.15), 0, zBack + 1.35]}>
              {/* Wooden Desk Top & Modesty Frame */}
              <mesh position={[0, 0.74, 0]} scale={[1.38, 0.08, 0.72]} geometry={c.unitBoxGeo} material={c.teacherDeskMat} />
              <mesh position={[0, 0.37, 0.25]} scale={[1.24, 0.68, 0.08]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
              <mesh position={[-0.58, 0.37, 0]} scale={[0.09, 0.7, 0.64]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
              <mesh position={[0.58, 0.37, 0]} scale={[0.09, 0.7, 0.64]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />

              {/* Left Tall Stack of 4 Textbooks */}
              <mesh position={[-0.44, 0.805, 0.06]} rotation={[0, 0.06, 0]} scale={[0.28, 0.045, 0.22]} geometry={c.unitBoxGeo} material={c.bookBlueMat} />
              <mesh position={[-0.43, 0.848, 0.05]} rotation={[0, -0.07, 0]} scale={[0.26, 0.04, 0.2]} geometry={c.unitBoxGeo} material={c.bookRedMat} />
              <mesh position={[-0.45, 0.888, 0.07]} rotation={[0, 0.11, 0]} scale={[0.25, 0.038, 0.19]} geometry={c.unitBoxGeo} material={c.bookGreenMat} />
              <mesh position={[-0.44, 0.925, 0.06]} rotation={[0, -0.04, 0]} scale={[0.23, 0.035, 0.18]} geometry={c.unitBoxGeo} material={c.bookOchreMat} />

              {/* Second Back-Left Stack of 3 Exercise Books */}
              <mesh position={[-0.18, 0.802, -0.17]} rotation={[0, -0.1, 0]} scale={[0.24, 0.038, 0.18]} geometry={c.unitBoxGeo} material={c.bookGreenMat} />
              <mesh position={[-0.17, 0.838, -0.16]} rotation={[0, 0.08, 0]} scale={[0.22, 0.034, 0.17]} geometry={c.unitBoxGeo} material={c.bookPageMat} />
              <mesh position={[-0.18, 0.872, -0.17]} rotation={[0, -0.05, 0]} scale={[0.21, 0.032, 0.16]} geometry={c.unitBoxGeo} material={c.bookRedMat} />

              {/* Right Stack of 3 Textbooks + Open Lesson Notebook in Center */}
              <mesh position={[0.42, 0.804, -0.04]} rotation={[0, 0.09, 0]} scale={[0.27, 0.042, 0.2]} geometry={c.unitBoxGeo} material={c.bookOchreMat} />
              <mesh position={[0.43, 0.844, -0.03]} rotation={[0, -0.08, 0]} scale={[0.25, 0.038, 0.19]} geometry={c.unitBoxGeo} material={c.bookBlueMat} />
              <mesh position={[0.41, 0.88, -0.05]} rotation={[0, 0.04, 0]} scale={[0.23, 0.034, 0.18]} geometry={c.unitBoxGeo} material={c.bookRedMat} />
              <mesh position={[0.04, 0.794, 0.08]} rotation={[0, 0.03, 0]} scale={[0.32, 0.022, 0.22]} geometry={c.unitBoxGeo} material={c.bookPageMat} />

              {/* Teacher's Wooden Chair tucked cleanly behind the desk (seat top = 0.47m) facing students (+Z) */}
              <group position={[0, 0, -0.44]}>
                <mesh position={[0, 0.445, 0]} scale={[0.48, 0.05, 0.46]} geometry={c.unitBoxGeo} material={c.deskTopMat} />
                <mesh position={[-0.2, 0.22, -0.19]} scale={[0.055, 0.44, 0.055]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[0.2, 0.22, -0.19]} scale={[0.055, 0.44, 0.055]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[-0.2, 0.22, 0.19]} scale={[0.055, 0.44, 0.055]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[0.2, 0.22, 0.19]} scale={[0.055, 0.44, 0.055]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                {/* Chair Backrest Posts & Slats */}
                <mesh position={[-0.2, 0.72, -0.2]} scale={[0.055, 0.56, 0.055]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[0.2, 0.72, -0.2]} scale={[0.055, 0.56, 0.055]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[0, 0.88, -0.2]} scale={[0.44, 0.14, 0.05]} geometry={c.unitBoxGeo} material={c.teacherDeskMat} />
                <mesh position={[0, 0.68, -0.2]} scale={[0.42, 0.08, 0.045]} geometry={c.unitBoxGeo} material={c.teacherDeskMat} />
              </group>
            </group>

            {/* Student Wooden Desks & Benches (3 rows × (3 + 2) = 15 seats per classroom, zero overlap!) */}
            {deskSpecs.map((desk, dIdx) => (
              <group key={`desk-${dIdx}`} position={[desk.deskX, 0, desk.deskZ]}>
                <mesh
                  position={[0, STUDENT_DESK.topY - STUDENT_DESK.thickness / 2, 0]}
                  scale={[desk.deskW, STUDENT_DESK.thickness, STUDENT_DESK.depth]}
                  geometry={c.unitBoxGeo}
                  material={c.deskTopMat}
                />
                <mesh position={[-desk.deskW * 0.42, 0.36, 0]} scale={[0.07, 0.7, 0.4]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[desk.deskW * 0.42, 0.36, 0]} scale={[0.07, 0.7, 0.4]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[0, 0.44, STUDENT_DESK.benchOffset]} scale={[desk.deskW, 0.06, 0.28]} geometry={c.unitBoxGeo} material={c.deskTopMat} />
                <mesh position={[-desk.deskW * 0.42, 0.22, STUDENT_DESK.benchOffset]} scale={[0.06, 0.42, 0.24]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
                <mesh position={[desk.deskW * 0.42, 0.22, STUDENT_DESK.benchOffset]} scale={[0.06, 0.42, 0.24]} geometry={c.unitBoxGeo} material={c.deskFrameMat} />
              </group>
            ))}
          </group>
        );
      })}

      {/* Ceiling / Upper Floor Slab */}
      <mesh
        position={[0, wallHeight + 0.09, 0]}
        scale={[hallLength + 0.2, 0.18, hallDepth + 0.2]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />
    </group>
  );
}

/**
 * ============================================================================
 * Walk-In Multi-Classroom School Hall (`<SchoolClassroomHall>`)
 * ============================================================================
 *
 * Supports BOTH 1-storey AND true walkable 2-storey halls with exterior concrete
 * staircase (`လှေကား`), separated classrooms on every storey, and boarding
 * dormitory signboards (`ဆရာ/ဆရာမ အဆောင်` / `ကျောင်းသား/ကျောင်းသူ အဆောင်`).
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
    upperFloorY,
    wallHeight,
    zVerandaEdge,
    classrooms,
    upperClassrooms,
    stairStartX,
    stairRunLength,
    stairCenterZ,
    stairWidth,
  } = layout;

  const isTwoStorey = spec.storeys === 2;
  const totalWallH = isTwoStorey ? wallHeight * 2 + 0.18 : wallHeight;
  const roofBaseY = floorY + totalWallH + 0.18;
  const roofPitch = Math.max(1.8, Math.min(2.6, hallDepth * 0.24));
  const roofSlopeLen = Math.hypot(hallDepth / 2, roofPitch) + 0.9;
  const roofAngle = Math.atan2(roofPitch, hallDepth / 2);

  const pillarCount = Math.max(3, Math.round(hallLength / 4.8) + 1);
  const pillarXs = useMemo(
    () =>
      Array.from({ length: pillarCount }, (_, idx) =>
        -hallLength / 2 + 0.4 + (idx / Math.max(1, pillarCount - 1)) * (hallLength - 0.8),
      ),
    [hallLength, pillarCount],
  );

  // 16 smooth walkable exterior concrete steps rising from ground plinth (`floorY`) to 2nd floor (`upperFloorY`)
  const stairSteps = 16;
  const stairRiseTotal = upperFloorY - floorY;
  const stepTread = stairRunLength / stairSteps;
  const stepRise = stairRiseTotal / stairSteps;
  const stairTopX = stairStartX + stairRunLength;

  const dormPlaqueLabel =
    spec.dormRole === 'teacher-dorm'
      ? 'ဆရာ/ဆရာမ အဆောင်'
      : spec.dormRole === 'student-dorm'
        ? 'ကျောင်းသား/သူ အဆောင်'
        : null;

  return (
    <group
      name={`school-hall-${spec.id}`}
      position={[spec.x, 0, spec.z]}
      rotation={[0, canonicalRotation, 0]}
      onClick={onClick}
    >
      {/* 1. Raised Walkable Concrete Plinth & Front Entry Step */}
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY / 2, 0]}
        scale={[hallLength + 0.8, floorY, hallDepth + 0.6]}
        geometry={c.unitBoxGeo}
        material={c.plinthMat}
        receiveShadow
      />
      <mesh
        userData={{ walkable: true }}
        position={[0, floorY * 0.45, zVerandaEdge + 0.45]}
        scale={[hallLength - 1.2, floorY * 0.9, 0.55]}
        geometry={c.unitBoxGeo}
        material={c.plinthMat}
        receiveShadow
      />

      {/* 2. Ground-Floor Separated Walk-In Classrooms */}
      <ClassroomStoreyLevel
        c={c}
        layout={layout}
        rooms={classrooms}
        baseY={floorY}
        wallMat={wallMat}
        pillarXs={pillarXs}
        isUpperStorey={false}
      />

      {/* 3. True Walkable 2nd-Floor Separated Classrooms + Exterior Concrete Staircase */}
      {isTwoStorey && (
        <>
          <ClassroomStoreyLevel
            c={c}
            layout={layout}
            rooms={upperClassrooms}
            baseY={upperFloorY}
            wallMat={wallMat}
            pillarXs={pillarXs}
            isUpperStorey
          />

          {/* Walkable Exterior Concrete Staircase rising from Ground to 2nd-Floor Veranda */}
          <group name="school-upper-staircase">
            {Array.from({ length: stairSteps }, (_, si) => {
              const topY = floorY + (si + 1) * stepRise;
              const sx = stairStartX + (si + 0.5) * stepTread;
              return (
                <mesh
                  key={`step-${si}`}
                  userData={{ walkable: true }}
                  position={[sx, topY / 2, stairCenterZ]}
                  scale={[stepTread + 0.08, topY, stairWidth]}
                  geometry={c.unitBoxGeo}
                  material={c.plinthMat}
                  castShadow
                  receiveShadow
                />
              );
            })}
            {/* Upper Landing Platform connecting top step cleanly into 2nd-floor veranda opening */}
            <mesh
              userData={{ walkable: true }}
              position={[stairTopX + 0.8, upperFloorY - 0.1, stairCenterZ - 0.25]}
              scale={[1.8, 0.2, stairWidth + 0.6]}
              geometry={c.unitBoxGeo}
              material={c.corridorFloorMat}
              receiveShadow
            />
            {/* Outer Stair Handrail */}
            <mesh
              position={[
                stairStartX + stairRunLength / 2,
                floorY + stairRiseTotal / 2 + 0.9,
                stairCenterZ + stairWidth / 2 - 0.06,
              ]}
              rotation={[0, 0, Math.atan2(stairRiseTotal, stairRunLength)]}
              scale={[Math.hypot(stairRunLength, stairRiseTotal) + 0.4, 0.1, 0.1]}
              geometry={c.unitBoxGeo}
              material={c.doorFrameMat}
            />
          </group>
        </>
      )}

      {/* Optional Dormitory Signboard Plaque on Fascia */}
      {dormPlaqueLabel && (
        <mesh
          position={[0, floorY + wallHeight - 0.15, zVerandaEdge + 0.05]}
          scale={[4.2, 0.68, 0.08]}
          geometry={c.unitBoxGeo}
          material={c.getRoomPlaqueMat(dormPlaqueLabel)}
        />
      )}

      {/* 4. Pitched Gable Roof overhanging Veranda & Classrooms */}
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
      <mesh
        position={[0, roofBaseY + roofPitch + 0.08, 0]}
        scale={[hallLength + 1.45, 0.18, 0.36]}
        geometry={c.unitBoxGeo}
        material={c.wallTrimMat}
      />
    </group>
  );
});
