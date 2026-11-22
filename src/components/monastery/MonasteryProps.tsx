import { memo } from 'react';
import type { MeshStandardMaterial } from 'three';
import { getMonasteryBuildingAssetCache } from '../../game/monasteryAssets';

/**
 * ============================================================================
 * Reusable Myanmar Monastery Props (one component per item, zero duplication)
 * ============================================================================
 * Every prop reads shared geometries/materials from the Singleton
 * `getMonasteryBuildingAssetCache()`; nothing here allocates GPU resources.
 *
 * Atoms:      WovenMat, MeditationMat, AlmsBowl, OfferingBowl, TiffinCarrier,
 *             RiceSack, CeramicJar, RiceCauldron, ScriptureBook
 * Composites: RoundDiningTable, AlmsShelfRack, AlmsStorageCounter, ScriptureShelf
 * (BuddhaShrineAltar lives in MonasteryBuildings.tsx and is re-exported from index.ts)
 */

type P3 = { x?: number; y?: number; z?: number };

function Box({
  x = 0, y = 0, z = 0, w, h, d, mat,
}: P3 & { w: number; h: number; d: number; mat: MeshStandardMaterial }) {
  const c = getMonasteryBuildingAssetCache();
  return <mesh position={[x, y, z]} scale={[w, h, d]} geometry={c.unitBoxGeo} material={mat} receiveShadow />;
}

/** ဖျာ — woven bamboo mat */
export const WovenMat = memo(function WovenMat({ x = 0, y = 0, z = 0, w = 2.5, d = 2.3 }: P3 & { w?: number; d?: number }) {
  const c = getMonasteryBuildingAssetCache();
  return <Box x={x} y={y + 0.02} z={z} w={w} h={0.03} d={d} mat={c.wovenMatMat} />;
});

/** တရားထိုင်ဖျာ — meditation mat with saffron sitting cushion */
export const MeditationMat = memo(function MeditationMat({
  x = 0, y = 0, z = 0, w = 3.6, d = 4.6, cushion = true,
}: P3 & { w?: number; d?: number; cushion?: boolean }) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group name="meditation-mat">
      <WovenMat x={x} y={y + 0.01} z={z} w={w} d={d} />
      {cushion && <Box x={x} y={y + 0.1} z={z - d * 0.2} w={0.7} h={0.12} d={0.7} mat={c.saffronCushionMat} />}
    </group>
  );
});

/** သပိတ် — black-lacquer alms bowl with gold rim */
export const AlmsBowl = memo(function AlmsBowl({ x = 0, y = 0, z = 0, scale = 1 }: P3 & { scale?: number }) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, y, z]} scale={[scale, scale, scale]} name="alms-bowl">
      <mesh scale={[0.38, 0.34, 0.38]} geometry={c.unitSphereGeo} material={c.lacquerBlackMat} />
      <mesh position={[0, 0.18, 0]} scale={[0.34, 0.04, 0.34]} geometry={c.unitCylGeo} material={c.goldRichMat} />
    </group>
  );
});

/** ဆွမ်းအုပ် — red lacquer offering bowl with gold finial lid */
export const OfferingBowl = memo(function OfferingBowl({ x = 0, y = 0, z = 0, scale = 1 }: P3 & { scale?: number }) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, y, z]} scale={[scale, scale, scale]} name="offering-bowl">
      <mesh position={[0, 0.12, 0]} scale={[0.34, 0.24, 0.34]} geometry={c.unitCylGeo} material={c.lacquerRedMat} />
      <mesh position={[0, 0.38, 0]} scale={[0.28, 0.28, 0.28]} geometry={c.unitCone12Geo} material={c.goldBrightMat} />
    </group>
  );
});

/** ဆွမ်းချိုင့် — tiered tiffin carrier */
export const TiffinCarrier = memo(function TiffinCarrier({
  x = 0, y = 0, z = 0, brass = false,
}: P3 & { brass?: boolean }) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <mesh
      position={[x, y + 0.22, z]}
      scale={[0.26, 0.44, 0.26]}
      geometry={c.unitCyl8Geo}
      material={brass ? c.brassPotMat : c.ivoryPlinthMat}
      name="tiffin-carrier"
    />
  );
});

/** ဆန်အိတ် — woven rice sack */
export const RiceSack = memo(function RiceSack({ x = 0, y = 0, z = 0 }: P3) {
  const c = getMonasteryBuildingAssetCache();
  return <Box x={x} y={y + 0.22} z={z} w={0.68} h={0.44} d={0.48} mat={c.riceSackMat} />;
});

/** စဉ့်အိုး — glazed grain/water jar */
export const CeramicJar = memo(function CeramicJar({ x = 0, y = 0, z = 0 }: P3) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <mesh position={[x, y + 0.32, z]} scale={[0.54, 0.64, 0.54]} geometry={c.unitSphereGeo} material={c.ceramicJarMat} name="ceramic-jar" />
  );
});

/** ထမင်းအိုးကြီး — large brass rice cauldron */
export const RiceCauldron = memo(function RiceCauldron({ x = 0, y = 0, z = 0 }: P3) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, y, z]} name="rice-cauldron">
      <mesh position={[0, 0.3, 0]} scale={[0.74, 0.58, 0.74]} geometry={c.unitSphereGeo} material={c.brassPotMat} castShadow />
      <mesh position={[0, 0.58, 0]} scale={[0.56, 0.1, 0.56]} geometry={c.unitCylGeo} material={c.goldBrightMat} />
    </group>
  );
});

/** ကျမ်းစာ — Tipitaka scripture book (palm-leaf style, standing) */
export const ScriptureBook = memo(function ScriptureBook({
  x = 0, y = 0, z = 0, tone = 0,
}: P3 & { tone?: 0 | 1 | 2 }) {
  const c = getMonasteryBuildingAssetCache();
  const mat = tone === 0 ? c.crimsonDarkMat : tone === 1 ? c.teakMidMat : c.creamWallMat;
  return (
    <group position={[x, y, z]} name="scripture-book">
      <Box y={0.18} w={0.16} h={0.36} d={0.3} mat={mat} />
      <Box y={0.18} z={0.0} w={0.17} h={0.04} d={0.31} mat={c.goldRichMat} />
    </group>
  );
});

/** ကျမ်းစာစင် — scripture shelf stacked with books */
export const ScriptureShelf = memo(function ScriptureShelf({
  x = 0, y = 0, z = 0, length = 3, levels = 3,
}: P3 & { length?: number; levels?: number }) {
  const c = getMonasteryBuildingAssetCache();
  const count = Math.max(2, Math.floor(length / 0.2));
  return (
    <group position={[x, y, z]} name="scripture-shelf">
      <Box y={(levels * 0.55) / 2} w={0.5} h={levels * 0.55} d={length} mat={c.teakDarkMat} />
      {Array.from({ length: levels }, (_, li) => (
        <group key={li} position={[0.05, 0.1 + li * 0.55, 0]}>
          <Box y={0.0} w={0.6} h={0.06} d={length + 0.1} mat={c.teakWarmMat} />
          {Array.from({ length: count }, (_, bi) => (
            <ScriptureBook
              key={bi}
              x={0.12}
              y={0.03}
              z={-length / 2 + 0.15 + (bi / (count - 1)) * (length - 0.3)}
              tone={((bi + li) % 3) as 0 | 1 | 2}
            />
          ))}
        </group>
      ))}
    </group>
  );
});

/** စားပွဲဝိုင်း — low round dining table with mat, dishes, offering bowl, cushions */
export const RoundDiningTable = memo(function RoundDiningTable({ x = 0, y = 0, z = 0 }: P3) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, y, z]} name="round-dining-table">
      <WovenMat w={2.5} d={2.3} />
      <mesh position={[0, 0.24, 0]} scale={[0.38, 0.46, 0.38]} geometry={c.unitCyl8Geo} material={c.teakDarkMat} />
      <mesh position={[0, 0.48, 0]} scale={[1.55, 0.08, 1.55]} geometry={c.unitCylGeo} material={c.teakMidMat} castShadow />
      <OfferingBowl y={0.5} />
      {[-0.42, 0.42].map((bx, bi) => (
        <mesh key={bi} position={[bx, 0.56, bi ? 0.22 : -0.22]} scale={[0.24, 0.1, 0.24]} geometry={c.unitCylGeo} material={c.lacquerBlackMat} />
      ))}
      {[-0.95, 0.95].map((cx, ci) => (
        <Box key={ci} x={cx} y={0.08} w={0.44} h={0.1} d={0.48} mat={c.saffronCushionMat} />
      ))}
    </group>
  );
});

/** သပိတ်စင် / ဆွမ်းအုပ်စင် — teak rack of alms bowls, offering bowls & tiffins */
export const AlmsShelfRack = memo(function AlmsShelfRack({
  x = 0, y = 0, z = 0, length = 8.6, full = true,
}: P3 & { length?: number; full?: boolean }) {
  const c = getMonasteryBuildingAssetCache();
  const zs = Array.from({ length: 8 }, (_, i) => -length / 2 + 0.9 + (i / 7) * (length - 1.8));
  return (
    <group position={[x, y, z]} name="alms-shelf-rack">
      <Box y={full ? 1.15 : 0.95} w={0.95} h={full ? 2.3 : 1.9} d={length} mat={c.teakDarkMat} />
      {(full ? [0.55, 1.15, 1.75, 2.25] : [0.5, 1.1, 1.7]).map((sy, si) => (
        <Box key={si} x={0.1} y={sy} w={1.12} h={0.08} d={length + 0.2} mat={c.teakWarmMat} />
      ))}
      {zs.map((bz, bi) => (
        <group key={bi}>
          <AlmsBowl x={0.24} y={1.19} z={bz} />
          {full && <OfferingBowl x={0.24} y={1.8} z={bz} />}
          {full && <TiffinCarrier x={0.24} y={0.6} z={bz} brass={bi % 2 === 1} />}
        </group>
      ))}
    </group>
  );
});

/** ဆွမ်းပစ္စည်းကောင်တာ — counter with cauldrons, jars and rice sacks */
export const AlmsStorageCounter = memo(function AlmsStorageCounter({ x = 0, y = 0, z = 0 }: P3) {
  const c = getMonasteryBuildingAssetCache();
  return (
    <group position={[x, y, z]} name="alms-storage-counter">
      <Box y={0.44} w={4.8} h={0.88} d={1.15} mat={c.teakMidMat} />
      <Box y={0.9} w={4.9} h={0.08} d={1.24} mat={c.ivoryPlinthMat} />
      {[-1.6, -0.55].map((px) => (
        <RiceCauldron key={px} x={px} y={0.94} />
      ))}
      {[0.55, 1.3, 2.0].map((jx) => (
        <CeramicJar key={jx} x={jx} y={0.94} />
      ))}
      {[-1.7, -0.9, -0.1, 0.7].map((rx) => (
        <RiceSack key={rx} x={rx} z={-0.62} />
      ))}
    </group>
  );
});
