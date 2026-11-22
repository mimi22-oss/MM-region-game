import { memo, useMemo } from 'react';
import type { MeshStandardMaterial } from 'three';
import {
  MONASTERY_COLORS,
  getMonasteryBuildingAssetCache,
  type MonasteryBuildingAssetCache,
} from '../../game/monasteryAssets';
import {
  AlmsShelfRack,
  AlmsStorageCounter,
  MeditationMat,
  RoundDiningTable,
  ScriptureShelf,
} from './MonasteryProps';
import {
  computeMonasteryBuildingLayout,
  type MonasteryBuildingLayout,
  type MonasteryBuildingSpec,
  type MonasteryRectBox,
  type MonasteryStairLayout,
} from '../../game/monasteryLayout';

/**
 * ============================================================================
 * Reusable Myanmar Theravada Monastery Components (Zero-Duplication Library)
 * ============================================================================
 *
 * Every building & architectural element strictly consumes shared geometries
 * and materials from `getMonasteryBuildingAssetCache()` (Singleton Memory
 * Reference Cache). Any village or ward across the map can import and mount:
 * - `<DhammaHallBuilding />`       (`ဓမ္မာရုံ`, walk-in 2F + interior stairs)
 * - `<MonksKyaungBuilding />`      (`ဘုန်းကြီးကျောင်းဆောင်`, walk-in 2F + interior stairs)
 * - `<CeremonialMandapBuilding />` (`သိမ်မဏ္ဍပ် · ဇရပ်`, walk-in 2F + interior stairs)
 * - `<RefectoryAlmsBuilding />`    (`ဆွမ်းစားဆောင် နှင့် ဆွမ်းပစ္စည်းသိုလှောင်ခန်း`, walk-in 2F + interior stairs)
 * - `<BuddhistFlagPole />`         (`သာသနာ့အလံ`)
 * - `<MonasteryBuilding spec={...} />`
 */

function BoxPart({
  c,
  x = 0,
  y = 0,
  z = 0,
  w,
  h,
  d,
  mat,
  walkable = false,
  castShadow = false,
  receiveShadow = true,
}: {
  c: MonasteryBuildingAssetCache;
  x?: number;
  y?: number;
  z?: number;
  w: number;
  h: number;
  d: number;
  mat: MeshStandardMaterial;
  walkable?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh
      position={[x, y, z]}
      scale={[w, h, d]}
      geometry={c.unitBoxGeo}
      material={mat}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      userData={walkable ? { walkable: true } : undefined}
    />
  );
}

/**
 * 4-sided Burmese hipped roof tier (`ဘုံအဆင့် ခေါင်မိုး`) with golden fascia
 * and upturned golden corner finials (`စိန်တောင်`).
 */
export const BurmeseRoofTier = memo(function BurmeseRoofTier({
  y,
  width,
  depth,
  height,
  topRatio = 0.62,
  roofColor,
  cornerFinials = true,
}: {
  y: number;
  width: number;
  depth: number;
  height: number;
  topRatio?: number;
  roofColor: string;
  cornerFinials?: boolean;
}) {
  const c = getMonasteryBuildingAssetCache();
  const roofMat = c.getRoofMat(roofColor);
  const frustumGeo = c.getRoofFrustumGeo(topRatio);

  return (
    <group position={[0, y, 0]}>
      <group position={[0, height / 2, 0]} scale={[width, height, depth]}>
        <mesh rotation={[0, Math.PI / 4, 0]} geometry={frustumGeo} material={roofMat} castShadow receiveShadow />
      </group>
      <BoxPart c={c} y={0.04} w={width + 0.18} h={0.12} d={depth + 0.18} mat={c.goldRichMat} />
      <BoxPart c={c} y={height + 0.03} w={width * topRatio + 0.14} h={0.1} d={depth * topRatio + 0.14} mat={c.goldBrightMat} />
      {cornerFinials &&
        [-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <group key={`${sx}-${sz}`} position={[sx * (width / 2 + 0.04), 0.16, sz * (depth / 2 + 0.04)]}>
              <mesh
                rotation={[sz * 0.28, 0, -sx * 0.28]}
                scale={[0.3, 0.58, 0.3]}
                geometry={c.unitCone4Geo}
                material={c.goldBrightMat}
              />
            </group>
          )),
        )}
    </group>
  );
});

/** Traditional Multi-Tiered Burmese Pyatthat Spire (`ပြာသာဒ်ဘုံအဆင့်ဆင့် နှင့် ထီးတော်`). */
export const PyatthatSpire = memo(function PyatthatSpire({
  x = 0,
  y,
  z = 0,
  baseSize = 4.2,
  tiers = 5,
  roofColor = MONASTERY_COLORS.crimsonRoof,
}: {
  x?: number;
  y: number;
  z?: number;
  baseSize?: number;
  tiers?: number;
  roofColor?: string;
}) {
  const c = getMonasteryBuildingAssetCache();
  const tierSpecs = useMemo(() => {
    const out: Array<{ y: number; neckH: number; size: number; roofH: number }> = [];
    let curY = 0;
    for (let i = 0; i < tiers; i++) {
      const shrink = Math.pow(0.74, i);
      const size = baseSize * shrink;
      const neckH = 0.4 * Math.pow(0.86, i);
      const roofH = 0.52 * Math.pow(0.85, i);
      out.push({ y: curY, neckH, size, roofH });
      curY += neckH + roofH * 0.85;
    }
    return { items: out, totalH: curY };
  }, [baseSize, tiers]);

  const topY = tierSpecs.totalH;

  return (
    <group position={[x, y, z]} name="burmese-pyatthat-spire">
      {tierSpecs.items.map((t, i) => (
        <group key={i} position={[0, t.y, 0]}>
          <BoxPart c={c} y={t.neckH / 2} w={t.size * 0.62} h={t.neckH} d={t.size * 0.62} mat={c.crimsonDarkMat} />
          <BoxPart c={c} y={t.neckH - 0.04} w={t.size * 0.7} h={0.08} d={t.size * 0.7} mat={c.goldRichMat} />
          <BurmeseRoofTier
            y={t.neckH}
            width={t.size}
            depth={t.size}
            height={t.roofH}
            topRatio={0.48}
            roofColor={roofColor}
            cornerFinials={i < 3}
          />
        </group>
      ))}
      <mesh position={[0, topY + 0.35, 0]} scale={[0.56, 0.7, 0.56]} geometry={c.unitCylGeo} material={c.goldBrightMat} castShadow />
      <mesh position={[0, topY + 1.15, 0]} scale={[0.48, 1.05, 0.48]} geometry={c.unitCone12Geo} material={c.goldBrightMat} castShadow />
      {[0.82, 1.04, 1.24].map((ry, idx) => {
        const d = 0.58 - idx * 0.12;
        return <mesh key={idx} position={[0, topY + ry, 0]} scale={[d, 0.06, d]} geometry={c.unitCylGeo} material={c.goldBrightMat} />;
      })}
      <mesh position={[0, topY + 1.76, 0]} scale={[0.2, 0.2, 0.2]} geometry={c.unitSphereGeo} material={c.goldGlowMat} />
    </group>
  );
});

/** Traditional arched Myanmar monastery window (`ပြတင်းမုခ်ခုံး`). */
export const MonasteryWindow = memo(function MonasteryWindow({
  x,
  y,
  z,
  rotY = 0,
  width = 1.6,
  height = 2.0,
}: {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  width?: number;
  height?: number;
}) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <BoxPart c={c} w={width + 0.22} h={height + 0.2} d={0.14} mat={c.teakDarkMat} />
      <BoxPart c={c} z={0.04} w={width} h={height} d={0.08} mat={c.windowGlassMat} />
      <BoxPart c={c} z={0.08} w={0.1} h={height} d={0.06} mat={c.teakWarmMat} />
      <BoxPart c={c} y={height * 0.22} z={0.08} w={width} h={0.08} d={0.06} mat={c.goldRichMat} />
      <BoxPart c={c} y={height / 2 + 0.14} z={0.06} w={width + 0.34} h={0.14} d={0.16} mat={c.goldRichMat} />
      <mesh
        position={[0, height / 2 + 0.4, 0.06]}
        scale={[width * 0.66, 0.42, width * 0.36]}
        geometry={c.unitCone4Geo}
        material={c.goldBrightMat}
      />
      <BoxPart c={c} y={-height / 2 - 0.1} z={0.08} w={width + 0.3} h={0.1} d={0.2} mat={c.ivoryPlinthMat} />
    </group>
  );
});

/**
 * Renders a segmented perimeter wall with clean open walk-in doorway gaps (1F)
 * and a continuous upper transom / 2nd-floor wall band.
 */
function SegmentedWallX({
  c,
  z,
  minX,
  maxX,
  baseY,
  height,
  wallT,
  doorHeight = 2.75,
  openings,
  mat,
}: {
  c: MonasteryBuildingAssetCache;
  z: number;
  minX: number;
  maxX: number;
  baseY: number;
  height: number;
  wallT: number;
  doorHeight?: number;
  openings: readonly [number, number][];
  mat: MeshStandardMaterial;
}) {
  const sorted = [...openings].sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let cursor = minX;
  for (const [oMin, oMax] of sorted) {
    if (oMin - cursor > 0.08) segments.push([cursor, oMin]);
    cursor = Math.max(cursor, oMax);
  }
  if (maxX - cursor > 0.08) segments.push([cursor, maxX]);
  const transomH = Math.max(0.2, height - doorHeight);

  return (
    <group>
      {segments.map(([a, b], idx) => (
        <BoxPart key={`seg-${idx}`} c={c} x={(a + b) / 2} y={baseY + height / 2} z={z} w={b - a} h={height} d={wallT} mat={mat} castShadow />
      ))}
      {sorted.map(([oMin, oMax], idx) => (
        <group key={`door-${idx}`}>
          <BoxPart
            c={c}
            x={(oMin + oMax) / 2}
            y={baseY + doorHeight + transomH / 2}
            z={z}
            w={oMax - oMin + 0.08}
            h={transomH}
            d={wallT}
            mat={mat}
          />
          {/* Carved Burmese teak & gold open doorway jambs + lintel */}
          <BoxPart c={c} x={oMin + 0.08} y={baseY + doorHeight / 2} z={z} w={0.16} h={doorHeight} d={wallT + 0.1} mat={c.teakDarkMat} />
          <BoxPart c={c} x={oMax - 0.08} y={baseY + doorHeight / 2} z={z} w={0.16} h={doorHeight} d={wallT + 0.1} mat={c.teakDarkMat} />
          <BoxPart c={c} x={(oMin + oMax) / 2} y={baseY + doorHeight + 0.08} z={z} w={oMax - oMin + 0.24} h={0.18} d={wallT + 0.16} mat={c.goldRichMat} />
        </group>
      ))}
    </group>
  );
}

function SegmentedWallZ({
  c,
  x,
  minZ,
  maxZ,
  baseY,
  height,
  wallT,
  doorHeight = 2.75,
  openings,
  mat,
}: {
  c: MonasteryBuildingAssetCache;
  x: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  height: number;
  wallT: number;
  doorHeight?: number;
  openings: readonly [number, number][];
  mat: MeshStandardMaterial;
}) {
  const sorted = [...openings].sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let cursor = minZ;
  for (const [oMin, oMax] of sorted) {
    if (oMin - cursor > 0.08) segments.push([cursor, oMin]);
    cursor = Math.max(cursor, oMax);
  }
  if (maxZ - cursor > 0.08) segments.push([cursor, maxZ]);
  const transomH = Math.max(0.2, height - doorHeight);

  return (
    <group>
      {segments.map(([a, b], idx) => (
        <BoxPart key={`seg-${idx}`} c={c} x={x} y={baseY + height / 2} z={(a + b) / 2} w={wallT} h={height} d={b - a} mat={mat} castShadow />
      ))}
      {sorted.map(([oMin, oMax], idx) => (
        <group key={`door-${idx}`}>
          <BoxPart
            c={c}
            x={x}
            y={baseY + doorHeight + transomH / 2}
            z={(oMin + oMax) / 2}
            w={wallT}
            h={transomH}
            d={oMax - oMin + 0.08}
            mat={mat}
          />
          <BoxPart c={c} x={x} y={baseY + doorHeight / 2} z={oMin + 0.08} w={wallT + 0.1} h={doorHeight} d={0.16} mat={c.teakDarkMat} />
          <BoxPart c={c} x={x} y={baseY + doorHeight / 2} z={oMax - 0.08} w={wallT + 0.1} h={doorHeight} d={0.16} mat={c.teakDarkMat} />
          <BoxPart c={c} x={x} y={baseY + doorHeight + 0.08} z={(oMin + oMax) / 2} w={wallT + 0.16} h={0.18} d={oMax - oMin + 0.24} mat={c.goldRichMat} />
        </group>
      ))}
    </group>
  );
}

/**
 * Reusable Walkable 2nd-Floor Slab framing the exact stairwell hole
 * (`userData.walkable = true`) so walking UP and walking DOWN the interior
 * stairs both work smoothly with `GroundSurface`.
 */
export const WalkableUpperFloor = memo(function WalkableUpperFloor({
  slabs,
  floor2Y,
  mat,
}: {
  slabs: readonly MonasteryRectBox[];
  floor2Y: number;
  mat?: MeshStandardMaterial;
}) {
  const c = getMonasteryBuildingAssetCache();
  const floorMat = mat ?? c.upperFloorWoodMat;
  return (
    <group name="monastery-walkable-2f-slab">
      {slabs.map((s, idx) => (
        <BoxPart
          key={idx}
          c={c}
          x={(s.minX + s.maxX) / 2}
          y={floor2Y - 0.08}
          z={(s.minZ + s.maxZ) / 2}
          w={s.maxX - s.minX}
          h={0.16}
          d={s.maxZ - s.minZ}
          mat={floorMat}
          walkable
          receiveShadow
        />
      ))}
    </group>
  );
});

/**
 * Reusable Walkable Interior Burmese Teak Staircase (`အတွင်းလှေကား`) with
 * 16 smooth walkable treads (`userData.walkable = true`), golden-trimmed teak
 * handrails, and 2nd-floor stairwell safety balustrades on the 3 non-entry sides.
 */
export const InteriorStaircase = memo(function InteriorStaircase({
  stair,
}: {
  stair: MonasteryStairLayout;
}) {
  const c = getMonasteryBuildingAssetCache();
  const widthX = stair.maxX - stair.minX;
  const depthZ = stair.maxZ - stair.minZ;
  const riseTotal = stair.endY - stair.startY;
  const stepH = stair.stepRise + 0.08;
  const cx = (stair.minX + stair.maxX) / 2;
  const cz = (stair.minZ + stair.maxZ) / 2;

  const isAlongZ = stair.direction === '+z' || stair.direction === '-z';
  const runLen = isAlongZ ? depthZ : widthX;
  const slopeLen = Math.hypot(runLen, riseTotal);
  const slopeAngle = Math.atan2(riseTotal, runLen);

  return (
    <group name="monastery-interior-staircase">
      {/* 16 Walkable Teak Steps (`userData.walkable = true`) */}
      {Array.from({ length: stair.steps }, (_, si) => {
        const topY = stair.startY + (si + 1) * stair.stepRise;
        const frac = (si + 0.5) / stair.steps;
        const sx =
          stair.direction === '+x'
            ? stair.minX + frac * widthX
            : stair.direction === '-x'
              ? stair.maxX - frac * widthX
              : cx;
        const sz =
          stair.direction === '+z'
            ? stair.minZ + frac * depthZ
            : stair.direction === '-z'
              ? stair.maxZ - frac * depthZ
              : cz;
        const sw = isAlongZ ? widthX : stair.stepTread + 0.06;
        const sd = isAlongZ ? stair.stepTread + 0.06 : depthZ;

        return (
          <group key={si}>
            <BoxPart
              c={c}
              x={sx}
              y={topY - stepH / 2}
              z={sz}
              w={sw}
              h={stepH}
              d={sd}
              mat={c.stairWoodMat}
              walkable
              castShadow
              receiveShadow
            />
            {/* Subtle golden step-nosing highlight so stairs are easy to spot indoors */}
            <BoxPart
              c={c}
              x={isAlongZ ? sx : stair.direction === '+x' ? sx - stair.stepTread * 0.42 : sx + stair.stepTread * 0.42}
              y={topY - 0.015}
              z={isAlongZ ? (stair.direction === '+z' ? sz - stair.stepTread * 0.42 : sz + stair.stepTread * 0.42) : sz}
              w={isAlongZ ? widthX - 0.08 : 0.05}
              h={0.03}
              d={isAlongZ ? 0.05 : depthZ - 0.08}
              mat={c.goldRichMat}
            />
          </group>
        );
      })}

      {/* Sloped Side Handrails & Newel Posts */}
      {isAlongZ ? (
        <>
          {[stair.minX + 0.06, stair.maxX - 0.06].map((rx, idx) => (
            <group key={`rail-z-${idx}`}>
              <mesh
                position={[rx, stair.startY + riseTotal / 2 + 0.85, cz]}
                rotation={[stair.direction === '+z' ? -slopeAngle : slopeAngle, 0, 0]}
                scale={[0.1, 0.1, slopeLen + 0.25]}
                geometry={c.unitBoxGeo}
                material={c.teakWarmMat}
              />
              <BoxPart c={c} x={rx} y={stair.startY + 0.48} z={stair.minZ + 0.08} w={0.12} h={0.96} d={0.12} mat={c.teakDarkMat} />
              <BoxPart c={c} x={rx} y={stair.endY + 0.48} z={stair.maxZ - 0.08} w={0.12} h={0.96} d={0.12} mat={c.teakDarkMat} />
              <BoxPart c={c} x={rx} y={stair.endY + 0.98} z={stair.maxZ - 0.08} w={0.16} h={0.1} d={0.16} mat={c.goldBrightMat} />
            </group>
          ))}
          {/* 2nd-floor stairwell safety balustrades on the 3 non-exit edges */}
          <BoxPart c={c} x={stair.minX - 0.04} y={stair.endY + 0.48} z={cz} w={0.09} h={0.96} d={depthZ} mat={c.teakMidMat} />
          <BoxPart c={c} x={stair.maxX + 0.04} y={stair.endY + 0.48} z={cz} w={0.09} h={0.96} d={depthZ} mat={c.teakMidMat} />
          <BoxPart
            c={c}
            x={cx}
            y={stair.endY + 0.48}
            z={stair.direction === '+z' ? stair.minZ - 0.04 : stair.maxZ + 0.04}
            w={widthX + 0.14}
            h={0.96}
            d={0.09}
            mat={c.teakMidMat}
          />
          <BoxPart c={c} x={stair.minX - 0.04} y={stair.endY + 0.96} z={cz} w={0.12} h={0.07} d={depthZ + 0.12} mat={c.goldRichMat} />
          <BoxPart c={c} x={stair.maxX + 0.04} y={stair.endY + 0.96} z={cz} w={0.12} h={0.07} d={depthZ + 0.12} mat={c.goldRichMat} />
        </>
      ) : (
        <>
          {[stair.minZ + 0.06, stair.maxZ - 0.06].map((rz, idx) => (
            <group key={`rail-x-${idx}`}>
              <mesh
                position={[cx, stair.startY + riseTotal / 2 + 0.85, rz]}
                rotation={[0, 0, stair.direction === '+x' ? slopeAngle : -slopeAngle]}
                scale={[slopeLen + 0.25, 0.1, 0.1]}
                geometry={c.unitBoxGeo}
                material={c.teakWarmMat}
              />
              <BoxPart c={c} x={stair.minX + 0.08} y={stair.startY + 0.48} z={rz} w={0.12} h={0.96} d={0.12} mat={c.teakDarkMat} />
              <BoxPart c={c} x={stair.maxX - 0.08} y={stair.endY + 0.48} z={rz} w={0.12} h={0.96} d={0.12} mat={c.teakDarkMat} />
              <BoxPart c={c} x={stair.maxX - 0.08} y={stair.endY + 0.98} z={rz} w={0.16} h={0.1} d={0.16} mat={c.goldBrightMat} />
            </group>
          ))}
          {/* 2nd-floor stairwell safety balustrades on the 3 non-exit edges */}
          <BoxPart c={c} x={cx} y={stair.endY + 0.48} z={stair.minZ - 0.04} w={widthX} h={0.96} d={0.09} mat={c.teakMidMat} />
          <BoxPart c={c} x={cx} y={stair.endY + 0.48} z={stair.maxZ + 0.04} w={widthX} h={0.96} d={0.09} mat={c.teakMidMat} />
          <BoxPart
            c={c}
            x={stair.direction === '+x' ? stair.minX - 0.04 : stair.maxX + 0.04}
            y={stair.endY + 0.48}
            z={cz}
            w={0.09}
            h={0.96}
            d={depthZ + 0.14}
            mat={c.teakMidMat}
          />
          <BoxPart c={c} x={cx} y={stair.endY + 0.96} z={stair.minZ - 0.04} w={widthX + 0.12} h={0.07} d={0.12} mat={c.goldRichMat} />
          <BoxPart c={c} x={cx} y={stair.endY + 0.96} z={stair.maxZ + 0.04} w={widthX + 0.12} h={0.07} d={0.12} mat={c.goldRichMat} />
        </>
      )}
    </group>
  );
});

/** Reusable Walkable Exterior Entry Stairs rising smoothly from ground (`0`) to `floor1Y`. */
function ExteriorSteps({
  c,
  x = 0,
  z = 0,
  rotY = 0,
  width,
  floor1Y,
  steps = 4,
}: {
  c: MonasteryBuildingAssetCache;
  x?: number;
  z?: number;
  rotY?: number;
  width: number;
  floor1Y: number;
  steps?: number;
}) {
  const stepRise = floor1Y / steps;
  const tread = 0.4;
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {Array.from({ length: steps }, (_, i) => {
        const topY = (i + 1) * stepRise;
        const sz = -(steps - i) * tread + tread * 0.5;
        return (
          <BoxPart
            key={i}
            c={c}
            y={topY / 2}
            z={sz}
            w={width - i * 0.12}
            h={topY}
            d={tread + 0.08}
            mat={c.ivoryPlinthMat}
            walkable
            receiveShadow
          />
        );
      })}
    </group>
  );
}

/** Reusable Golden Buddha Shrine Altar (`ဘုရားစင် / ပလ္လင်တော် နှင့် ရွှေဆင်းတုတော်`). */
export const BuddhaShrineAltar = memo(function BuddhaShrineAltar({
  x = 0,
  y,
  z = 0,
  scale = 1,
}: {
  x?: number;
  y: number;
  z?: number;
  scale?: number;
}) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, y, z]} scale={[scale, scale, scale]} name="buddha-shrine-altar">
      <BoxPart c={c} y={0.32} w={5.0} h={0.64} d={2.4} mat={c.crimsonDarkMat} />
      <BoxPart c={c} y={0.78} w={4.2} h={0.28} d={2.0} mat={c.goldRichMat} />
      <BoxPart c={c} y={1.08} w={3.4} h={0.32} d={1.6} mat={c.goldBrightMat} />
      {/* Seated Golden Buddha Silhouette (`ရွှေဆင်းတုတော်`) */}
      <mesh position={[0, 1.44, -0.05]} scale={[1.95, 0.42, 1.45]} geometry={c.unitCylGeo} material={c.goldBrightMat} castShadow />
      <mesh position={[0, 2.08, -0.05]} scale={[1.1, 0.96, 0.9]} geometry={c.unitCylGeo} material={c.goldBrightMat} castShadow />
      <mesh position={[0, 2.78, -0.05]} scale={[0.7, 0.72, 0.7]} geometry={c.unitSphereGeo} material={c.goldBrightMat} castShadow />
      <mesh position={[0, 3.22, -0.05]} scale={[0.26, 0.34, 0.26]} geometry={c.unitCone12Geo} material={c.goldBrightMat} />
      {/* Radiant Halo Arch (`တံကဲ`) */}
      <BoxPart c={c} y={2.1} z={0.76} w={3.8} h={2.7} d={0.2} mat={c.crimsonRoofMat} />
      <BoxPart c={c} y={2.1} z={0.64} w={3.3} h={2.3} d={0.1} mat={c.goldRichMat} />
      <mesh position={[0, 2.68, 0.58]} rotation={[Math.PI / 2, 0, 0]} scale={[1.55, 0.08, 1.55]} geometry={c.unitCylGeo} material={c.goldHaloMat} />
    </group>
  );
});

/**
 * ============================================================================
 * 1. ဓမ္မာရုံ (Reusable 2-Storey Walk-In Theravada Dhamma Hall)
 * ============================================================================
 */
export const DhammaHallBuilding = memo(function DhammaHallBuilding({
  spec,
}: {
  spec: MonasteryBuildingSpec;
}) {
  const c = getMonasteryBuildingAssetCache();
  const layout = useMemo(() => computeMonasteryBuildingLayout(spec), [spec]);
  const signMat = useMemo(
    () =>
      c.getSignboardMat(
        `dhamma-${spec.id}`,
        spec.name,
        spec.subtitle,
        MONASTERY_COLORS.crimsonRoof,
        MONASTERY_COLORS.crimsonDark,
      ),
    [c, spec.id, spec.name, spec.subtitle],
  );

  const { wallW, wallD, wallT, floor1Y, wallH1, floor2Y, wallH2, roofBaseY, stair, upperFloorSlabs } = layout;
  const hw = wallW / 2;
  const hd = wallD / 2;
  const pillarXs = [-11.2, -7.4, -3.6, 3.6, 7.4, 11.2];
  const frontWinXs = [-8.4, -5.2, 5.2, 8.4];

  return (
    <group position={[spec.x, 0, spec.z]} rotation={[0, spec.rotation, 0]} name={spec.id}>
      {/* Raised Plinth & Walkable 1st Floor Slab */}
      <BoxPart c={c} y={0.18} w={spec.width + 1.2} h={0.36} d={spec.depth + 1.2} mat={c.warmStoneMat} />
      <BoxPart c={c} y={0.54} w={spec.width + 0.4} h={0.36} d={spec.depth + 0.4} mat={c.ivoryPlinthMat} />
      <BoxPart c={c} y={floor1Y - 0.06} w={spec.width} h={0.12} d={spec.depth} mat={c.tileFloorMat} walkable receiveShadow />
      <BoxPart c={c} y={floor1Y - 0.02} w={wallW - 0.4} h={0.04} d={wallD - 0.4} mat={c.teakFloorMat} walkable receiveShadow />

      {/* Walkable Exterior Entry Stairs on Front (-Z), West (-X) & East (+X) */}
      <ExteriorSteps c={c} z={-hd - 0.15} width={4.8} floor1Y={floor1Y} steps={4} />
      <ExteriorSteps c={c} x={-hw - 0.15} rotY={Math.PI / 2} width={3.4} floor1Y={floor1Y} steps={4} />
      <ExteriorSteps c={c} x={hw + 0.15} rotY={-Math.PI / 2} width={3.4} floor1Y={floor1Y} steps={4} />

      {/* Twin Traditional White & Gold Naga Balustrades flanking the front stairs */}
      {[-1, 1].map((sx) => (
        <group key={`naga-${sx}`} position={[sx * 2.55, 0, -hd - 0.95]}>
          <BoxPart c={c} y={0.55} w={0.32} h={1.1} d={1.75} mat={c.creamWallMat} />
          <BoxPart c={c} y={1.14} w={0.4} h={0.12} d={1.85} mat={c.goldBrightMat} />
          <mesh position={[0, 1.38, -0.8]} scale={[0.42, 0.54, 0.42]} geometry={c.unitCone4Geo} material={c.goldBrightMat} />
        </group>
      ))}

      {/* 1st Floor Walk-In Perimeter Walls (Front 4m entrance, West & East 3.2m entrances) */}
      <SegmentedWallX c={c} z={-hd} minX={-hw} maxX={hw} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[[-2.0, 2.0]]} mat={c.creamWallMat} />
      <SegmentedWallX c={c} z={hd} minX={-hw} maxX={hw} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={-hw} minZ={-hd} maxZ={hd} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[[-1.6, 1.6]]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={hw} minZ={-hd} maxZ={hd} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[[-1.6, 1.6]]} mat={c.creamWallMat} />

      {/* 2nd Floor Walkable Slab (with exact stairwell cutout!) & 2nd Floor Walls */}
      <WalkableUpperFloor slabs={upperFloorSlabs} floor2Y={floor2Y} />
      <SegmentedWallX c={c} z={-hd} minX={-hw} maxX={hw} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallX c={c} z={hd} minX={-hw} maxX={hw} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={-hw} minZ={-hd} maxZ={hd} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={hw} minZ={-hd} maxZ={hd} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />

      {/* Exterior Gilded Cornice Bands */}
      <BoxPart c={c} y={floor2Y} w={wallW + 0.36} h={0.22} d={wallD + 0.36} mat={c.crimsonDarkMat} />
      <BoxPart c={c} y={floor2Y + 0.14} w={wallW + 0.44} h={0.08} d={wallD + 0.44} mat={c.goldRichMat} />
      <BoxPart c={c} y={roofBaseY - 0.14} w={wallW + 0.36} h={0.26} d={wallD + 0.36} mat={c.crimsonDarkMat} />
      <BoxPart c={c} y={roofBaseY + 0.02} w={wallW + 0.48} h={0.12} d={wallD + 0.48} mat={c.goldBrightMat} />

      {/* Walkable Interior Teak Staircase (1F -> 2F) */}
      <InteriorStaircase stair={stair} />

      {/* 1F Grand Golden Buddha Shrine Altar & Woven Meditation Mats */}
      <BuddhaShrineAltar y={floor1Y} z={hd - 1.65} scale={0.96} />
      <MeditationMat x={-4.5} y={floor1Y} z={1.2} w={3.6} d={6.0} />
      <MeditationMat x={3.8} y={floor1Y} z={2.6} w={3.4} d={4.6} />

      {/* 2F Upper Tipitaka Scripture & Meditation Shrine (`အပေါ်ထပ် ပိဋကတ်တိုက် နှင့် တရားထိုင်ဆောင်`) */}
      <BuddhaShrineAltar y={floor2Y} z={hd - 1.65} scale={0.78} />
      <ScriptureShelf x={-hw + 0.5} y={floor2Y} z={-4.4} length={3.2} />
      <ScriptureShelf x={-hw + 0.5} y={floor2Y} z={4.4} length={3.2} />
      <MeditationMat x={-4.8} y={floor2Y} z={0.4} w={4.4} d={7.2} />
      <MeditationMat x={2.6} y={floor2Y} z={2.6} w={4.0} d={4.2} />

      {/* Exterior Crimson-and-Gold Gallery Columns along Front (-Z) & Rear (+Z) */}
      {[-1, 1].map((sideZ) =>
        pillarXs.map((px, i) => (
          <group key={`col-${sideZ}-${i}`} position={[px, floor1Y, sideZ * (hd + 0.55)]}>
            <BoxPart c={c} y={0.18} w={0.56} h={0.36} d={0.56} mat={c.ivoryPlinthMat} />
            <mesh position={[0, (wallH1 + wallH2) / 2, 0]} scale={[0.42, wallH1 + wallH2 - 0.3, 0.42]} geometry={c.unitCylGeo} material={c.crimsonPillarMat} castShadow />
            <mesh position={[0, wallH1 + wallH2 - 0.24, 0]} scale={[0.62, 0.36, 0.62]} geometry={c.unitCylGeo} material={c.goldBrightMat} />
          </group>
        )),
      )}

      {/* Projecting Front Portico (`မုခ်ဦးဆောင်`) & Burmese Signboard */}
      <group position={[0, 0, -hd]}>
        {[-2.25, 2.25].map((px, i) => (
          <group key={`pcol-${i}`} position={[px, floor1Y, -1.18]}>
            <BoxPart c={c} y={0.18} w={0.54} h={0.36} d={0.54} mat={c.ivoryPlinthMat} />
            <mesh position={[0, 2.05, 0]} scale={[0.4, 3.8, 0.4]} geometry={c.unitCylGeo} material={c.crimsonPillarMat} castShadow />
            <mesh position={[0, 3.9, 0]} scale={[0.58, 0.32, 0.58]} geometry={c.unitCylGeo} material={c.goldBrightMat} />
          </group>
        ))}
        <BoxPart c={c} y={floor1Y + 4.1} z={-0.65} w={5.2} h={0.32} d={1.4} mat={c.goldRichMat} />
        <BoxPart c={c} y={floor1Y + 4.46} z={-0.78} w={5.4} h={0.44} d={1.5} mat={c.crimsonRoofMat} />
        <BoxPart c={c} y={floor1Y + 4.72} z={-0.88} w={5.6} h={0.12} d={1.6} mat={c.goldBrightMat} />
        <mesh position={[0, floor1Y + 5.2, -1.36]} rotation={[0, Math.PI / 4, 0]} scale={[1.8, 0.9, 1.8]} geometry={c.unitCone4Geo} material={c.goldBrightMat} />
        {signMat && (
          <mesh position={[0, floor1Y + 4.28, -1.56]} rotation={[0, Math.PI, 0]} scale={[4.4, 1.1, 1]} geometry={c.unitPlaneGeo} material={signMat} />
        )}
      </group>

      {/* Arched Monastery Windows on 1F & 2F */}
      {[floor1Y + 1.85, floor2Y + 1.65].map((wy, lvl) => (
        <group key={`win-lvl-${lvl}`}>
          {frontWinXs.map((wx) => (
            <MonasteryWindow key={`fw-${lvl}-${wx}`} x={wx} y={wy} z={-hd - 0.18} rotY={Math.PI} width={1.5} height={1.8} />
          ))}
          {[-8.4, -4.2, 4.2, 8.4].map((wx) => (
            <MonasteryWindow key={`bw-${lvl}-${wx}`} x={wx} y={wy} z={hd + 0.18} rotY={0} width={1.5} height={1.8} />
          ))}
          {[-4.8, 4.8].map((wz) => (
            <group key={`sw-${lvl}-${wz}`}>
              <MonasteryWindow x={-hw - 0.18} y={wy} z={wz} rotY={-Math.PI / 2} width={1.5} height={1.8} />
              <MonasteryWindow x={hw + 0.18} y={wy} z={wz} rotY={Math.PI / 2} width={1.5} height={1.8} />
            </group>
          ))}
        </group>
      ))}

      {/* Triple-Tiered Overlapping Burmese Crimson Roof (`ဘုံ ၃ ဆင့် ခေါင်မိုး`) + 5-Tier Pyatthat */}
      <BurmeseRoofTier y={roofBaseY} width={spec.width + 1.8} depth={spec.depth + 1.4} height={2.1} topRatio={0.76} roofColor={MONASTERY_COLORS.crimsonRoof} />
      <BoxPart c={c} y={roofBaseY + 2.48} w={spec.width * 0.72} h={0.8} d={spec.depth * 0.68} mat={c.creamWallMat} />
      <BurmeseRoofTier y={roofBaseY + 2.86} width={spec.width * 0.82} depth={spec.depth * 0.78} height={1.8} topRatio={0.64} roofColor={MONASTERY_COLORS.crimsonRoof} />
      <BoxPart c={c} y={roofBaseY + 4.92} w={spec.width * 0.48} h={0.5} d={spec.depth * 0.46} mat={c.crimsonDarkMat} />
      <BurmeseRoofTier y={roofBaseY + 5.16} width={spec.width * 0.56} depth={spec.depth * 0.54} height={1.3} topRatio={0.48} roofColor={MONASTERY_COLORS.crimsonRoof} />
      <PyatthatSpire y={roofBaseY + 6.46} baseSize={4.6} tiers={5} roofColor={MONASTERY_COLORS.crimsonRoof} />
    </group>
  );
});

/**
 * ============================================================================
 * 2. ဘုန်းကြီးကျောင်းဆောင် (Reusable 2-Storey Walk-In Teak Monks' Kyaung)
 * ============================================================================
 */
export const MonksKyaungBuilding = memo(function MonksKyaungBuilding({
  spec,
}: {
  spec: MonasteryBuildingSpec;
}) {
  const c = getMonasteryBuildingAssetCache();
  const layout = useMemo(() => computeMonasteryBuildingLayout(spec), [spec]);
  const signMat = useMemo(
    () =>
      c.getSignboardMat(
        `quarters-${spec.id}`,
        spec.name,
        spec.subtitle,
        MONASTERY_COLORS.teakDark,
        '#351b0e',
      ),
    [c, spec.id, spec.name, spec.subtitle],
  );

  const { wallW, wallD, wallT, floor1Y, wallH1, floor2Y, wallH2, roofBaseY, stair, upperFloorSlabs } = layout;
  const hw = wallW / 2;
  const hd = wallD / 2;
  const postXs = [-11.8, -8.85, -5.9, -2.95, 0, 2.95, 5.9, 8.85, 11.8];

  return (
    <group position={[spec.x, 0, spec.z]} rotation={[0, spec.rotation, 0]} name={spec.id}>
      {/* Ground Masonry Platform & Walkable 1st Floor */}
      <BoxPart c={c} y={0.18} w={spec.width + 0.8} h={0.36} d={spec.depth + 0.8} mat={c.warmStoneMat} />
      <BoxPart c={c} y={floor1Y - 0.14} w={spec.width} h={0.28} d={spec.depth} mat={c.ivoryPlinthMat} walkable receiveShadow />
      <BoxPart c={c} y={floor1Y - 0.02} w={wallW - 0.2} h={0.04} d={wallD - 0.2} mat={c.teakFloorMat} walkable receiveShadow />

      {/* Walkable Exterior Entry Stairs on Front (-Z) & West (-X, toward Refectory) */}
      <ExteriorSteps c={c} z={-spec.depth / 2} width={4.4} floor1Y={floor1Y} steps={3} />
      <ExteriorSteps c={c} x={-spec.width / 2} rotY={Math.PI / 2} width={3.4} floor1Y={floor1Y} steps={3} />

      {/* 1st Floor Walk-In Walls (Front 4m entrance, West 3.2m entrance) */}
      <SegmentedWallX c={c} z={-hd} minX={-hw} maxX={hw} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[[-2.0, 2.0]]} mat={c.creamWallMat} />
      <SegmentedWallX c={c} z={hd} minX={-hw} maxX={hw} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={-hw} minZ={-hd} maxZ={hd} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[[-1.6, 1.6]]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={hw} minZ={-hd} maxZ={hd} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[]} mat={c.creamWallMat} />

      {/* Ground Floor Dark Teak Veranda Colonnade Posts (`ကျွန်းသစ်တိုင်တန်း`) */}
      {[-1, 1].map((sideZ) =>
        postXs.map((px, i) => (
          <group key={`gpost-${sideZ}-${i}`} position={[px, floor1Y, sideZ * (spec.depth / 2 - 0.45)]}>
            <BoxPart c={c} y={0.14} w={0.44} h={0.28} d={0.44} mat={c.warmStoneMat} />
            <mesh position={[0, wallH1 / 2, 0]} scale={[0.36, wallH1, 0.36]} geometry={c.unitCyl8Geo} material={c.teakDarkMat} castShadow />
          </group>
        )),
      )}

      {/* 2nd Floor Walkable Slab (with exact stairwell cutout!) & Projecting Veranda Ring */}
      <WalkableUpperFloor slabs={upperFloorSlabs} floor2Y={floor2Y} />
      {/* Decorative overhanging veranda apron & carved balustrade */}
      <BoxPart c={c} y={floor2Y - 0.14} z={-spec.depth / 2 + 0.65} w={spec.width + 0.3} h={0.22} d={1.3} mat={c.teakDarkMat} />
      <BoxPart c={c} y={floor2Y - 0.14} z={spec.depth / 2 - 0.65} w={spec.width + 0.3} h={0.22} d={1.3} mat={c.teakDarkMat} />
      {[-1, 1].map((sideZ) => (
        <group key={`railZ-${sideZ}`} position={[0, floor2Y + 0.56, sideZ * (spec.depth / 2 - 0.25)]}>
          <BoxPart c={c} y={0.34} w={spec.width} h={0.12} d={0.16} mat={c.teakWarmMat} />
          <BoxPart c={c} y={-0.06} w={spec.width} h={0.42} d={0.1} mat={c.teakMidMat} />
          <BoxPart c={c} y={0.18} w={spec.width + 0.06} h={0.07} d={0.14} mat={c.goldRichMat} />
        </group>
      ))}
      {[-1, 1].map((sideX) => (
        <group key={`railX-${sideX}`} position={[sideX * (spec.width / 2 - 0.25), floor2Y + 0.56, 0]}>
          <BoxPart c={c} y={0.34} w={0.16} h={0.12} d={spec.depth - 0.4} mat={c.teakWarmMat} />
          <BoxPart c={c} y={-0.06} w={0.1} h={0.42} d={spec.depth - 0.4} mat={c.teakMidMat} />
        </group>
      ))}
      {[-1, 1].map((sideZ) =>
        postXs.map((px, i) => (
          <group key={`upost-${sideZ}-${i}`} position={[px, floor2Y, sideZ * (spec.depth / 2 - 0.35)]}>
            <mesh position={[0, wallH2 / 2, 0]} scale={[0.3, wallH2, 0.3]} geometry={c.unitCyl8Geo} material={c.teakDarkMat} castShadow />
            <BoxPart c={c} y={wallH2 - 0.2} w={0.34} h={0.2} d={0.34} mat={c.goldRichMat} />
          </group>
        )),
      )}

      {/* 2nd Floor Rich Dark Burmese Teak Living Quarters Walls */}
      <SegmentedWallX c={c} z={-hd} minX={-hw} maxX={hw} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.teakMidMat} />
      <SegmentedWallX c={c} z={hd} minX={-hw} maxX={hw} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.teakMidMat} />
      <SegmentedWallZ c={c} x={-hw} minZ={-hd} maxZ={hd} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.teakMidMat} />
      <SegmentedWallZ c={c} x={hw} minZ={-hd} maxZ={hd} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.teakMidMat} />

      {/* Walkable Interior Teak Staircase (1F -> 2F) */}
      <InteriorStaircase stair={stair} />

      {/* Interior Furniture: Abbot's Dais & Scripture Shelves (1F & 2F) */}
      {[floor1Y, floor2Y].map((fy, idx) => (
        <group key={`kyaung-int-${idx}`}>
          <BoxPart c={c} x={-hw + 3.05} y={fy + 0.35} z={hd - 1.25} w={4.0} h={0.7} d={1.6} mat={c.teakDarkMat} />
          <BoxPart c={c} x={-hw + 3.05} y={fy + 0.74} z={hd - 1.25} w={3.6} h={0.12} d={1.3} mat={c.saffronCushionMat} />
          <BoxPart c={c} x={-2.5} y={fy + 0.03} z={-0.6} w={6.5} h={0.04} d={4.0} mat={c.wovenMatMat} />
        </group>
      ))}

      {/* Windows on 1F & 2F */}
      {[-8.4, -4.4, 4.4, 8.4].map((wx) => (
        <group key={`kw1-${wx}`}>
          <MonasteryWindow x={wx} y={floor1Y + 1.65} z={-hd - 0.16} rotY={Math.PI} width={1.4} height={1.65} />
          <MonasteryWindow x={wx} y={floor1Y + 1.65} z={hd + 0.16} rotY={0} width={1.4} height={1.65} />
        </group>
      ))}
      {[-9.2, -5.5, -1.8, 1.8, 5.5, 9.2].map((wx) => (
        <group key={`kw2-${wx}`}>
          <MonasteryWindow x={wx} y={floor2Y + 1.6} z={-hd - 0.16} rotY={Math.PI} width={1.35} height={1.75} />
          <MonasteryWindow x={wx} y={floor2Y + 1.6} z={hd + 0.16} rotY={0} width={1.35} height={1.75} />
        </group>
      ))}

      {/* Signboard on Front Veranda Fascia */}
      {signMat && (
        <mesh position={[0, floor2Y + 0.56, -spec.depth / 2 - 0.14]} rotation={[0, Math.PI, 0]} scale={[4.6, 1.05, 1]} geometry={c.unitPlaneGeo} material={signMat} />
      )}

      {/* Double-Tiered Cascading Teak-Burgundy Roof + 3-Tier Pyatthat */}
      <BurmeseRoofTier y={roofBaseY} width={spec.width + 1.8} depth={spec.depth + 1.6} height={1.9} topRatio={0.74} roofColor={MONASTERY_COLORS.kyaungRoof} />
      <BoxPart c={c} y={roofBaseY + 2.2} w={spec.width * 0.68} h={0.62} d={spec.depth * 0.62} mat={c.teakDarkMat} />
      <BurmeseRoofTier y={roofBaseY + 2.5} width={spec.width * 0.78} depth={spec.depth * 0.72} height={1.6} topRatio={0.56} roofColor={MONASTERY_COLORS.kyaungRoofLight} />
      <PyatthatSpire y={roofBaseY + 4.1} baseSize={4.2} tiers={3} roofColor={MONASTERY_COLORS.kyaungRoofLight} />
    </group>
  );
});

/**
 * ============================================================================
 * 3. သိမ်မဏ္ဍပ် · ဇရပ် (Reusable 2-Storey Open-Pillared Ceremonial Pavilion)
 * ============================================================================
 */
export const CeremonialMandapBuilding = memo(function CeremonialMandapBuilding({
  spec,
}: {
  spec: MonasteryBuildingSpec;
}) {
  const c = getMonasteryBuildingAssetCache();
  const layout = useMemo(() => computeMonasteryBuildingLayout(spec), [spec]);
  const signMat = useMemo(
    () =>
      c.getSignboardMat(
        `mandap-${spec.id}`,
        spec.name,
        spec.subtitle,
        MONASTERY_COLORS.jadeRoof,
        MONASTERY_COLORS.jadeDark,
      ),
    [c, spec.id, spec.name, spec.subtitle],
  );

  const { wallW, wallD, floor1Y, wallH1, floor2Y, wallH2, roofBaseY, stair, upperFloorSlabs } = layout;
  const hw = wallW / 2;
  const hd = wallD / 2;
  const colH = wallH1 + wallH2;

  const colPositions: [number, number][] = [
    [-hw, -hd], [-hw * 0.35, -hd], [hw * 0.35, -hd], [hw, -hd],
    [-hw, hd], [-hw * 0.35, hd], [hw * 0.35, hd], [hw, hd],
    [-hw, -hd * 0.33], [-hw, hd * 0.33],
    [hw, -hd * 0.33], [hw, hd * 0.33],
  ];

  return (
    <group position={[spec.x, 0, spec.z]} rotation={[0, spec.rotation, 0]} name={spec.id}>
      {/* Raised Platform & Walkable 1st Floor */}
      <BoxPart c={c} y={0.18} w={spec.width + 1.2} h={0.36} d={spec.depth + 1.2} mat={c.warmStoneMat} />
      <BoxPart c={c} y={0.52} w={spec.width + 0.3} h={0.34} d={spec.depth + 0.3} mat={c.ivoryPlinthMat} />
      <BoxPart c={c} y={floor1Y - 0.08} w={spec.width - 0.1} h={0.16} d={spec.depth - 0.1} mat={c.tileFloorMat} walkable receiveShadow />

      {/* Walkable Entrance Steps on Front (-Z) & East (+X, facing Dhamma Hall) */}
      <ExteriorSteps c={c} z={-spec.depth / 2} width={5.0} floor1Y={floor1Y} steps={4} />
      <ExteriorSteps c={c} x={spec.width / 2} rotY={-Math.PI / 2} width={5.0} floor1Y={floor1Y} steps={4} />

      {/* 1F Open-Air Low Carved Cream & Gold Parapet (Front & East entrances 5.2m wide open!) */}
      <BoxPart c={c} y={floor1Y + 0.55} z={hd} w={wallW} h={1.1} d={0.28} mat={c.creamWallMat} />
      <BoxPart c={c} y={floor1Y + 1.14} z={hd} w={wallW + 0.16} h={0.12} d={0.36} mat={c.goldRichMat} />
      <BoxPart c={c} x={-hw} y={floor1Y + 0.55} w={0.28} h={1.1} d={wallD} mat={c.creamWallMat} />
      <BoxPart c={c} x={-hw} y={floor1Y + 1.14} w={0.36} h={0.12} d={wallD + 0.16} mat={c.goldRichMat} />
      {[-1, 1].map((s) => (
        <group key={`fp-${s}`}>
          <BoxPart c={c} x={s * ((hw + 2.6) / 2)} y={floor1Y + 0.55} z={-hd} w={hw - 2.6} h={1.1} d={0.28} mat={c.creamWallMat} />
          <BoxPart c={c} x={s * ((hw + 2.6) / 2)} y={floor1Y + 1.14} z={-hd} w={hw - 2.5} h={0.12} d={0.36} mat={c.goldRichMat} />
          <BoxPart c={c} x={hw} y={floor1Y + 0.55} z={s * ((hd + 2.6) / 2)} w={0.28} h={1.1} d={hd - 2.6} mat={c.creamWallMat} />
          <BoxPart c={c} x={hw} y={floor1Y + 1.14} z={s * ((hd + 2.6) / 2)} w={0.36} h={0.12} d={hd - 2.5} mat={c.goldRichMat} />
        </group>
      ))}

      {/* 2nd Floor Walkable Open Gallery Slab (with exact stairwell cutout!) & Full-Perimeter Balustrade */}
      <WalkableUpperFloor slabs={upperFloorSlabs} floor2Y={floor2Y} />
      <BoxPart c={c} y={floor2Y + 0.5} z={-hd} w={wallW} h={1.0} d={0.2} mat={c.creamWallMat} />
      <BoxPart c={c} y={floor2Y + 1.04} z={-hd} w={wallW + 0.14} h={0.1} d={0.28} mat={c.goldBrightMat} />
      <BoxPart c={c} y={floor2Y + 0.5} z={hd} w={wallW} h={1.0} d={0.2} mat={c.creamWallMat} />
      <BoxPart c={c} y={floor2Y + 1.04} z={hd} w={wallW + 0.14} h={0.1} d={0.28} mat={c.goldBrightMat} />
      <BoxPart c={c} x={-hw} y={floor2Y + 0.5} w={0.2} h={1.0} d={wallD} mat={c.creamWallMat} />
      <BoxPart c={c} x={-hw} y={floor2Y + 1.04} w={0.28} h={0.1} d={wallD + 0.14} mat={c.goldBrightMat} />
      <BoxPart c={c} x={hw} y={floor2Y + 0.5} w={0.2} h={1.0} d={wallD} mat={c.creamWallMat} />
      <BoxPart c={c} x={hw} y={floor2Y + 1.04} w={0.28} h={0.1} d={wallD + 0.14} mat={c.goldBrightMat} />

      {/* 12 Tall Crimson-and-Gold Cylindrical Columns spanning 1F + 2F */}
      {colPositions.map(([cx, cz], idx) => (
        <group key={idx} position={[cx, floor1Y, cz]}>
          <BoxPart c={c} y={0.2} w={0.66} h={0.4} d={0.66} mat={c.ivoryPlinthMat} />
          <mesh position={[0, colH / 2, 0]} scale={[0.52, colH - 0.2, 0.52]} geometry={c.unitCylGeo} material={c.crimsonPillarMat} castShadow />
          <mesh position={[0, wallH1, 0]} scale={[0.62, 0.18, 0.62]} geometry={c.unitCylGeo} material={c.goldBrightMat} />
          <mesh position={[0, colH - 0.25, 0]} scale={[0.76, 0.42, 0.76]} geometry={c.unitCylGeo} material={c.goldBrightMat} />
        </group>
      ))}

      {/* Overhead Jade & Gold Ring Beams */}
      <BoxPart c={c} y={roofBaseY - 0.2} z={-hd} w={wallW + 0.5} h={0.42} d={0.44} mat={c.jadeDarkMat} />
      <BoxPart c={c} y={roofBaseY - 0.2} z={hd} w={wallW + 0.5} h={0.42} d={0.44} mat={c.jadeDarkMat} />
      <BoxPart c={c} x={-hw} y={roofBaseY - 0.2} w={0.44} h={0.42} d={wallD + 0.5} mat={c.jadeDarkMat} />
      <BoxPart c={c} x={hw} y={roofBaseY - 0.2} w={0.44} h={0.42} d={wallD + 0.5} mat={c.jadeDarkMat} />
      <BoxPart c={c} y={roofBaseY - 0.44} z={-hd} w={wallW + 0.6} h={0.14} d={0.5} mat={c.goldBrightMat} />
      <BoxPart c={c} y={roofBaseY - 0.44} z={hd} w={wallW + 0.6} h={0.14} d={0.5} mat={c.goldBrightMat} />

      {/* Walkable Interior Teak Staircase (1F -> 2F Open Gallery) */}
      <InteriorStaircase stair={stair} />

      {/* Inner Golden Buddha Shrine Pedestal (1F) & Upper Shrine Table (2F) */}
      <BuddhaShrineAltar y={floor1Y} z={hd - 2.5} scale={0.94} />
      <BuddhaShrineAltar y={floor2Y} z={hd - 2.5} scale={0.72} />

      {/* Signboard on Front Eave */}
      {signMat && (
        <mesh position={[0, roofBaseY - 0.16, -hd - 0.28]} rotation={[0, Math.PI, 0]} scale={[4.2, 1.05, 1]} geometry={c.unitPlaneGeo} material={signMat} />
      )}

      {/* Triple-Tiered Emerald-Jade Roof + 5-Tier Pyatthat */}
      <BurmeseRoofTier y={roofBaseY} width={spec.width + 1.8} depth={spec.depth + 1.8} height={2.05} topRatio={0.72} roofColor={MONASTERY_COLORS.jadeRoof} />
      <BoxPart c={c} y={roofBaseY + 2.38} w={spec.width * 0.64} h={0.66} d={spec.depth * 0.64} mat={c.creamWallMat} />
      <BurmeseRoofTier y={roofBaseY + 2.68} width={spec.width * 0.78} depth={spec.depth * 0.78} height={1.7} topRatio={0.6} roofColor={MONASTERY_COLORS.jadeRoof} />
      <BoxPart c={c} y={roofBaseY + 4.62} w={spec.width * 0.44} h={0.48} d={spec.depth * 0.44} mat={c.jadeDarkMat} />
      <BurmeseRoofTier y={roofBaseY + 4.84} width={spec.width * 0.54} depth={spec.depth * 0.54} height={1.26} topRatio={0.46} roofColor={MONASTERY_COLORS.jadeRoof} />
      <PyatthatSpire y={roofBaseY + 6.1} baseSize={4.4} tiers={5} roofColor={MONASTERY_COLORS.jadeRoof} />
    </group>
  );
});

/**
 * ============================================================================
 * 4. ဆွမ်းစားဆောင် နှင့် ဆွမ်းပစ္စည်းများထားရာနေရာ
 *    (Reusable 2-Storey Walk-In Refectory Dining Hall & Alms Supplies Storage)
 * ============================================================================
 *
 * - East Wing (`1F`): Monks' Dining Hall (`ဆွမ်းစားဆောင်`) with low Myanmar
 *   round dining tables (`စားပွဲဝိုင်း`), woven mats, saffron cushions, lacquer
 *   alms bowls (`သပိတ်`) & offering vessels (`ဆွမ်းအုပ်`).
 * - West Wing (`1F`): Connected Alms Supplies & Kitchen Storage Room
 *   (`ဆွမ်းပစ္စည်းများထားရာနေရာ`) with open 3.0m archway + dedicated front
 *   service door, tall wooden storage racks stacked with black-lacquer alms
 *   bowls (`သပိတ်စင်`), red-gold offering bowls (`ဆွမ်းအုပ်`), tiered tiffins
 *   (`ဆွမ်းချိုင့်`), rice sacks (`ဆန်အိတ်`), glazed jars (`စဉ့်အိုး`), and
 *   large brass rice cauldrons (`ထမင်းအိုးကြီး`).
 * - Interior Teak Staircase: Rises cleanly from 1F Dining Hall up to the
 *   walkable 2nd-floor dry-goods & ceremonial alms-utensil loft (`အပေါ်ထပ်`)!
 */
export const RefectoryAlmsBuilding = memo(function RefectoryAlmsBuilding({
  spec,
}: {
  spec: MonasteryBuildingSpec;
}) {
  const c = getMonasteryBuildingAssetCache();
  const layout = useMemo(() => computeMonasteryBuildingLayout(spec), [spec]);
  const mainSignMat = useMemo(
    () =>
      c.getSignboardMat(
        `refectory-main-${spec.id}`,
        'ဆွမ်းစားဆောင် နှင့် ဆွမ်းပစ္စည်းခန်း',
        spec.subtitle,
        MONASTERY_COLORS.refectoryRoof,
        MONASTERY_COLORS.refectoryDark,
      ),
    [c, spec.id, spec.subtitle],
  );
  const storageSignMat = useMemo(
    () =>
      c.getSignboardMat(
        `refectory-store-${spec.id}`,
        'ဆွမ်းပစ္စည်းများထားရာနေရာ',
        'သပိတ် · ဆွမ်းအုပ် · ဆွမ်းချိုင့် · ဆန်အိတ်',
        MONASTERY_COLORS.teakDark,
        '#30180d',
      ),
    [c, spec.id],
  );

  const { wallW, wallD, wallT, floor1Y, wallH1, floor2Y, wallH2, roofBaseY, stair, upperFloorSlabs } = layout;
  const hw = wallW / 2; // 10.3
  const hd = wallD / 2; // 5.3
  const partitionX = -3.0;

  const diningTables: [number, number][] = [
    [0.15, 2.25],
    [0.15, -2.35],
    [4.75, -2.35],
  ];

  return (
    <group position={[spec.x, 0, spec.z]} rotation={[0, spec.rotation, 0]} name={spec.id}>
      {/* Raised Plinth & Walkable 1st Floor */}
      <BoxPart c={c} y={0.18} w={spec.width + 0.8} h={0.36} d={spec.depth + 0.8} mat={c.warmStoneMat} />
      <BoxPart c={c} y={floor1Y - 0.14} w={spec.width} h={0.28} d={spec.depth} mat={c.ivoryPlinthMat} walkable receiveShadow />
      {/* Dining Hall warm teak-tile floor (East) & Storage cool stone-tile floor (West) */}
      <BoxPart c={c} x={3.6} y={floor1Y - 0.02} w={13.1} h={0.04} d={wallD - 0.2} mat={c.tileFloorMat} walkable receiveShadow />
      <BoxPart c={c} x={-6.6} y={floor1Y - 0.02} w={7.1} h={0.04} d={wallD - 0.2} mat={c.ivoryPlinthMat} walkable receiveShadow />

      {/* Walkable Exterior Entry Steps: Dining Front, Storage Service Front, & East Door (toward Quarters) */}
      <ExteriorSteps c={c} x={2.4} z={-spec.depth / 2} width={3.8} floor1Y={floor1Y} steps={3} />
      <ExteriorSteps c={c} x={-6.4} z={-spec.depth / 2} width={2.8} floor1Y={floor1Y} steps={3} />
      <ExteriorSteps c={c} x={spec.width / 2} rotY={-Math.PI / 2} width={3.4} floor1Y={floor1Y} steps={3} />

      {/* 1st Floor Walk-In Perimeter Walls + Interior Partition Wall with 3.0m Archway */}
      <SegmentedWallX c={c} z={-hd} minX={-hw} maxX={hw} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[[-7.6, -5.2], [0.6, 4.2]]} mat={c.creamWallMat} />
      <SegmentedWallX c={c} z={hd} minX={-hw} maxX={hw} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={-hw} minZ={-hd} maxZ={hd} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={hw} minZ={-hd} maxZ={hd} baseY={floor1Y} height={wallH1} wallT={wallT} openings={[[-1.6, 1.6]]} mat={c.creamWallMat} />
      {/* Interior dividing wall between ဆွမ်းစားဆောင် (East) & ဆွမ်းပစ္စည်းခန်း (West) */}
      <SegmentedWallZ c={c} x={partitionX} minZ={-hd} maxZ={hd} baseY={floor1Y} height={wallH1} wallT={0.26} openings={[[-1.4, 1.6]]} mat={c.ivoryPlinthMat} />

      {/* 2nd Floor Walkable Slab (with exact stairwell cutout!) & 2nd Floor Walls */}
      <WalkableUpperFloor slabs={upperFloorSlabs} floor2Y={floor2Y} />
      <SegmentedWallX c={c} z={-hd} minX={-hw} maxX={hw} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallX c={c} z={hd} minX={-hw} maxX={hw} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={-hw} minZ={-hd} maxZ={hd} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      <SegmentedWallZ c={c} x={hw} minZ={-hd} maxZ={hd} baseY={floor2Y} height={wallH2} wallT={wallT} openings={[]} mat={c.creamWallMat} />
      {/* 2F dividing wall with open archway */}
      <SegmentedWallZ c={c} x={partitionX} minZ={-hd} maxZ={hd} baseY={floor2Y} height={wallH2} wallT={0.24} openings={[[-1.4, 1.6]]} mat={c.ivoryPlinthMat} />

      {/* Decorative Dado & Gilded Cornices */}
      <BoxPart c={c} y={floor2Y} w={wallW + 0.34} h={0.22} d={wallD + 0.34} mat={c.refectoryDarkMat} />
      <BoxPart c={c} y={floor2Y + 0.14} w={wallW + 0.42} h={0.08} d={wallD + 0.42} mat={c.goldRichMat} />
      <BoxPart c={c} y={roofBaseY - 0.14} w={wallW + 0.34} h={0.24} d={wallD + 0.34} mat={c.refectoryDarkMat} />
      <BoxPart c={c} y={roofBaseY + 0.02} w={wallW + 0.44} h={0.12} d={wallD + 0.44} mat={c.goldBrightMat} />

      {/* Walkable Interior Teak Staircase (1F -> 2F) */}
      <InteriorStaircase stair={stair} />

      {/* === EAST WING (1F): ဆွမ်းစားဆောင် — round dining tables === */}
      {diningTables.map(([tx, tz], idx) => (
        <RoundDiningTable key={`dtable-${idx}`} x={tx} y={floor1Y} z={tz} />
      ))}

      {/* === WEST WING (1F): ဆွမ်းပစ္စည်းများထားရာနေရာ === */}
      <AlmsShelfRack x={-hw + 0.88} y={floor1Y} />
      <AlmsStorageCounter x={-5.9} y={floor1Y} z={hd - 0.92} />

      {/* === 2ND FLOOR: Dry alms-utensil loft === */}
      <AlmsShelfRack x={-hw + 0.88} y={floor2Y} length={7.8} full={false} />
      <MeditationMat x={1.2} y={floor2Y} z={-0.6} w={6.6} d={4.6} />

      {/* Arched Windows on 1F & 2F */}
      {[floor1Y + 1.65, floor2Y + 1.55].map((wy, lvl) => (
        <group key={`rf-win-${lvl}`}>
          {[-8.8, -1.2, 6.4, 8.8].map((wx) => (
            <MonasteryWindow key={`rfw-${lvl}-${wx}`} x={wx} y={wy} z={-hd - 0.16} rotY={Math.PI} width={1.35} height={1.65} />
          ))}
          {[-7.5, -2.5, 2.5, 7.5].map((wx) => (
            <MonasteryWindow key={`rbw-${lvl}-${wx}`} x={wx} y={wy} z={hd + 0.16} rotY={0} width={1.35} height={1.65} />
          ))}
        </group>
      ))}

      {/* Signboards on Exterior Front Fascia (Dining Hall + Alms Supplies Storage) */}
      {mainSignMat && (
        <mesh position={[2.4, floor2Y + 0.15, -hd - 0.24]} rotation={[0, Math.PI, 0]} scale={[4.8, 1.05, 1]} geometry={c.unitPlaneGeo} material={mainSignMat} />
      )}
      {storageSignMat && (
        <mesh position={[-6.4, floor1Y + 3.12, -hd - 0.22]} rotation={[0, Math.PI, 0]} scale={[3.4, 0.78, 1]} geometry={c.unitPlaneGeo} material={storageSignMat} />
      )}

      {/* Double-Tiered Warm Terracotta-Crimson Burmese Roof + 3-Tier Pyatthat */}
      <BurmeseRoofTier y={roofBaseY} width={spec.width + 1.6} depth={spec.depth + 1.4} height={1.75} topRatio={0.74} roofColor={MONASTERY_COLORS.refectoryRoof} />
      <BoxPart c={c} y={roofBaseY + 2.04} w={spec.width * 0.66} h={0.56} d={spec.depth * 0.62} mat={c.refectoryDarkMat} />
      <BurmeseRoofTier y={roofBaseY + 2.3} width={spec.width * 0.76} depth={spec.depth * 0.72} height={1.45} topRatio={0.56} roofColor={MONASTERY_COLORS.refectoryRoof} />
      <PyatthatSpire y={roofBaseY + 3.75} baseSize={3.6} tiers={3} roofColor={MONASTERY_COLORS.refectoryRoof} />
    </group>
  );
});

/** Reusable Authentic 6-Color Theravada Buddhist Flag (`သာသနာ့အလံ`). */
export const BuddhistFlagPole = memo(function BuddhistFlagPole({ x, z }: { x: number; z: number }) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, 0, z]} name="theravada-buddhist-flagpole">
      <BoxPart c={c} y={0.22} w={0.9} h={0.44} d={0.9} mat={c.ivoryPlinthMat} />
      <BoxPart c={c} y={0.48} w={0.64} h={0.1} d={0.64} mat={c.goldRichMat} />
      <mesh position={[0, 4.9, 0]} scale={[0.14, 9.0, 0.14]} geometry={c.unitCylGeo} material={c.flagPoleMat} castShadow />
      <mesh position={[0, 9.52, 0]} scale={[0.28, 0.28, 0.28]} geometry={c.unitSphereGeo} material={c.goldBrightMat} />
      {c.buddhistFlagMats.map((mat, idx) => (
        <BoxPart key={`v-${idx}`} c={c} x={0.22 + idx * 0.34} y={8.56} w={0.34} h={1.4} d={0.04} mat={mat} />
      ))}
      {c.buddhistFlagMats.map((mat, idx) => (
        <BoxPart key={`fly-${idx}`} c={c} x={1.92} y={9.12 - idx * 0.28} w={0.34} h={0.28} d={0.04} mat={mat} />
      ))}
    </group>
  );
});

/** Unified Reusable Dispatcher for any Myanmar Theravada Monastery Building Spec. */
export const MonasteryBuilding = memo(function MonasteryBuilding({
  spec,
}: {
  spec: MonasteryBuildingSpec;
}) {
  switch (spec.kind) {
    case 'dhamma':
      return <DhammaHallBuilding spec={spec} />;
    case 'quarters':
      return <MonksKyaungBuilding spec={spec} />;
    case 'mandap':
      return <CeremonialMandapBuilding spec={spec} />;
    case 'refectory':
      return <RefectoryAlmsBuilding spec={spec} />;
  }
});

export {
  GoldenStupa,
  MYANMAR_PLANETARY_DAYS,
  PlanetaryDayShrine,
  type GoldenStupaProps,
  type PlanetaryDaySpec,
} from './GoldenStupa';
