import { memo, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { angle } from '../data/ward';
import type { TerrainPeak } from '../game/mountainTerrain';
import { MONASTERY_COLORS, getMonasteryBuildingAssetCache } from '../game/monasteryAssets';
import {
  TAUNGPHILA_MOUNTAIN_WORLD,
  buildTaungphilaRoadSegments,
  type ForestMonasterySpec,
  type MountainLakeSpec,
  type MountainZayatSpec,
} from '../game/taungphilaWorld';
import { WeipulaRoad } from './WeipulaRoad';
import { GoldenStupa } from './monastery/GoldenStupa';
import {
  BuddhistFlagPole,
  BurmeseRoofTier,
  PyatthatSpire,
} from './monastery/MonasteryBuildings';

const lakeWaterMat = new MeshStandardMaterial({
  color: '#2b7a8c',
  roughness: 0.16,
  metalness: 0.32,
});
lakeWaterMat.userData.shared = true;

const lakeShoreMat = new MeshStandardMaterial({
  color: '#6b6557',
  roughness: 0.92,
});
lakeShoreMat.userData.shared = true;

const lotusLeafMat = new MeshStandardMaterial({
  color: '#3f7d41',
  roughness: 0.72,
});
lotusLeafMat.userData.shared = true;

const retainingStoneMat = new MeshStandardMaterial({
  color: '#5a544a',
  roughness: 0.94,
});
retainingStoneMat.userData.shared = true;

/**
 * Reusable Natural Mountain Lake (`တောင်ပေါ် သဘာဝ ရေကန်`)
 * Embeds a solid stone hillside basin beneath the water so lakes sit naturally
 * on mountain saddles & foothills without ever floating.
 */
export const MountainLake = memo(function MountainLake({
  lake,
}: {
  lake: MountainLakeSpec;
}) {
  const c = getMonasteryBuildingAssetCache();
  const rx = lake.radiusX;
  const rz = lake.radiusZ;

  return (
    <group
      position={[lake.x, lake.y, lake.z]}
      rotation={[0, lake.rotation, 0]}
      name={lake.id}
    >
      {/* Stone Retaining Basin Embedded into Hillside */}
      <mesh
        position={[0, -5.8, 0]}
        scale={[rx * 2.15, 11.6, rz * 2.15]}
        geometry={c.unitCylGeo}
        material={lakeShoreMat}
        receiveShadow
      />
      {/* Natural Rock Rim / Embankment */}
      <mesh
        position={[0, 0.14, 0]}
        scale={[rx * 2.08, 0.36, rz * 2.08]}
        geometry={c.unitCylGeo}
        material={c.warmStoneMat}
        receiveShadow
        userData={{ walkable: true }}
      />
      {/* Shimmering Alpine Lake Water Surface */}
      <mesh
        position={[0, 0.34, 0]}
        scale={[rx * 1.88, 0.08, rz * 1.88]}
        geometry={c.unitCylGeo}
        material={lakeWaterMat}
        receiveShadow
      />
      {/* Floating Lotus Pads & Shoreline Boulders */}
      {[
        [-0.35, -0.25],
        [0.32, 0.2],
        [-0.18, 0.4],
        [0.44, -0.32],
      ].map(([fx, fz], idx) => (
        <mesh
          key={idx}
          position={[fx * rx, 0.4, fz * rz]}
          scale={[1.1, 0.05, 1.1]}
          geometry={c.unitCyl8Geo}
          material={lotusLeafMat}
        />
      ))}
    </group>
  );
});

/**
 * Reusable Scenic Mountain Zayat (`တောင်ပေါ် နားနေဇရပ်`)
 * Traditional Burmese hillside rest pavilion with stone retaining pier, walkable
 * deck, teak pillars, tiered Burmese roof, wooden rest benches, and water pot stand.
 */
export const MountainZayat = memo(function MountainZayat({
  zayat,
}: {
  zayat: MountainZayatSpec;
}) {
  const c = getMonasteryBuildingAssetCache();

  return (
    <group
      position={[zayat.x, zayat.y, zayat.z]}
      rotation={[0, zayat.rotation, 0]}
      name={zayat.id}
    >
      {/* Deep Stone Retaining Pier into Mountainside */}
      <mesh
        position={[0, -6.5, 0]}
        scale={[8.2, 13.0, 6.8]}
        geometry={c.unitBoxGeo}
        material={retainingStoneMat}
      />
      {/* Walkable Raised Zayat Platform */}
      <mesh
        position={[0, 0.24, 0]}
        scale={[8.6, 0.48, 7.2]}
        geometry={c.unitBoxGeo}
        material={c.ivoryPlinthMat}
        receiveShadow
        userData={{ walkable: true }}
      />
      {/* 6 Teak Pillars */}
      {[-3.4, 0, 3.4].map((px) =>
        [-2.7, 2.7].map((pz) => (
          <mesh
            key={`${px}-${pz}`}
            position={[px, 2.05, pz]}
            scale={[0.3, 3.2, 0.3]}
            geometry={c.unitCyl8Geo}
            material={c.teakDarkMat}
            castShadow
          />
        )),
      )}
      {/* Teak Benches (`နားနေခုံရှည်`) & Water Pot Stand (`ရေအိုးစင်`) */}
      {[-2.35, 2.35].map((bz) => (
        <mesh
          key={`bench-${bz}`}
          position={[0, 0.78, bz]}
          scale={[5.8, 0.14, 0.56]}
          geometry={c.unitBoxGeo}
          material={c.teakMidMat}
        />
      ))}
      <group position={[-3.3, 0.48, 0]}>
        <mesh position={[0, 0.36, 0]} scale={[0.7, 0.72, 1.3]} geometry={c.unitBoxGeo} material={c.teakDarkMat} />
        <mesh position={[0, 0.92, -0.3]} scale={[0.42, 0.46, 0.42]} geometry={c.unitSphereGeo} material={c.ceramicJarMat} />
        <mesh position={[0, 0.92, 0.3]} scale={[0.42, 0.46, 0.42]} geometry={c.unitSphereGeo} material={c.ceramicJarMat} />
      </group>
      {/* Double-Tiered Burmese Zayat Roof + Golden Finial */}
      <BurmeseRoofTier y={3.65} width={9.6} depth={8.2} height={1.35} topRatio={0.62} roofColor={zayat.roofColor} />
      <BurmeseRoofTier y={5.0} width={5.8} depth={5.0} height={1.0} topRatio={0.35} roofColor={zayat.roofColor} />
      <mesh position={[0, 6.45, 0]} scale={[0.36, 0.9, 0.36]} geometry={c.unitCone12Geo} material={c.goldBrightMat} />
    </group>
  );
});

/**
 * Reusable Secluded Forest Monastery Compound (`တောရဘုန်းကြီးကျောင်း`)
 * Mountain meditation terrace with traditional Burmese teak forest hall, Pyatthat
 * spire, small monk's meditation kuti hut (`ကုဋီ`), and 6-color Buddhist flag.
 */
export const ForestMonasteryCompound = memo(function ForestMonasteryCompound({
  monastery,
}: {
  monastery: ForestMonasterySpec;
}) {
  const c = getMonasteryBuildingAssetCache();
  const s = monastery.scale;

  return (
    <group
      position={[monastery.x, monastery.y, monastery.z]}
      rotation={[0, monastery.rotation, 0]}
      scale={[s, s, s]}
      name={monastery.id}
    >
      {/* Deep Hillside Retaining Stone Terrace */}
      <mesh
        position={[0, -8.5, 0]}
        scale={[22.0, 17.0, 18.0]}
        geometry={c.unitBoxGeo}
        material={retainingStoneMat}
      />
      {/* Walkable Forest Monastery Courtyard Terrace */}
      <mesh
        position={[0, 0.25, 0]}
        scale={[22.4, 0.5, 18.4]}
        geometry={c.unitBoxGeo}
        material={c.courtyardPaveMat}
        receiveShadow
        userData={{ walkable: true }}
      />

      {/* Main Teak Forest Monastery Hall (`တောရကျောင်းဆောင်`) */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0.25, 0]} scale={[10.4, 0.5, 7.6]} geometry={c.unitBoxGeo} material={c.ivoryPlinthMat} receiveShadow />
        <mesh position={[0, 2.25, 0]} scale={[9.2, 3.5, 6.4]} geometry={c.unitBoxGeo} material={c.teakMidMat} castShadow receiveShadow />
        {/* Veranda Teak Posts */}
        {[-4.6, -2.3, 0, 2.3, 4.6].map((px) =>
          [-3.4, 3.4].map((pz) => (
            <mesh
              key={`fm-col-${px}-${pz}`}
              position={[px, 2.25, pz]}
              scale={[0.26, 3.5, 0.26]}
              geometry={c.unitCyl8Geo}
              material={c.teakDarkMat}
              castShadow
            />
          )),
        )}
        {/* Golden Doorway & Trim */}
        <mesh position={[0, 1.85, -3.26]} scale={[2.2, 2.6, 0.16]} geometry={c.unitBoxGeo} material={c.teakDarkMat} />
        <mesh position={[0, 3.24, -3.3]} scale={[2.7, 0.22, 0.22]} geometry={c.unitBoxGeo} material={c.goldRichMat} />
        {/* Double-Tiered Burmese Crimson-Teak Roof + 3-Tier Pyatthat */}
        <BurmeseRoofTier y={4.0} width={11.6} depth={8.8} height={1.45} topRatio={0.68} roofColor={MONASTERY_COLORS.kyaungRoof} />
        <BurmeseRoofTier y={5.45} width={7.8} depth={6.0} height={1.15} topRatio={0.5} roofColor={MONASTERY_COLORS.crimsonRoof} />
        <PyatthatSpire y={6.6} baseSize={2.8} tiers={3} roofColor={MONASTERY_COLORS.crimsonRoof} />
      </group>

      {/* Secluded Meditation Kuti Hut (`တောရ ကုဋီ`) beside Main Hall */}
      <group position={[7.4, 0.5, 3.2]}>
        <mesh position={[0, 1.3, 0]} scale={[3.4, 2.6, 3.2]} geometry={c.unitBoxGeo} material={c.teakWarmMat} castShadow />
        <BurmeseRoofTier y={2.6} width={4.3} depth={4.0} height={0.9} topRatio={0.35} roofColor={MONASTERY_COLORS.kyaungRoof} cornerFinials={false} />
      </group>

      {/* 6-Color Buddhist Flag at Forest Monastery Entrance */}
      <group position={[-7.6, 0.5, -5.8]} scale={[0.72, 0.72, 0.72]}>
        <BuddhistFlagPole x={0} z={0} />
      </group>
    </group>
  );
});

/**
 * Taungphila Mountain Motorcycle Switchback Road & Random Mountain World Features
 * (Lakes, Rest Zayats, Forest Monasteries, and Golden Pagodas).
 * Mounted inside `<Mountains />` so every walkable road & deck registers cleanly
 * in `GroundSurface` under `'mountains'`.
 */
export const TaungphilaMountainFeatures = memo(function TaungphilaMountainFeatures({
  peaks,
}: {
  peaks: readonly TerrainPeak[];
}) {
  const roadSegments = useMemo(() => buildTaungphilaRoadSegments(peaks), [peaks]);
  const world = TAUNGPHILA_MOUNTAIN_WORLD;
  const c = getMonasteryBuildingAssetCache();

  return (
    <group name="taungphila-mountain-world">
      {/* 1. Motorcycle-Rideable Switchback Mountain Road (`တောင်ဖီလာတောင် ဆိုင်ကယ်တောင်တက်လမ်း`) */}
      <WeipulaRoad segments={roadSegments} peaks={peaks} />

      {/* 2. Random Natural Mountain Lakes (`တောင်ပေါ် ရေကန်များ`) */}
      {world.lakes.map((lake) => (
        <MountainLake key={lake.id} lake={lake} />
      ))}

      {/* 3. Random Scenic Mountain Zayats (`တောင်ပေါ် ဇရပ်များ`) */}
      {world.zayats.map((zayat) => (
        <MountainZayat key={zayat.id} zayat={zayat} />
      ))}

      {/* 4. Random Forest Monasteries (`တောရဘုန်းကြီးကျောင်းများ`) */}
      {world.monasteries.map((monastery) => (
        <ForestMonasteryCompound key={monastery.id} monastery={monastery} />
      ))}

      {/* 5. Random Mountaintop & Hillside Golden Pagodas (`တောင်ပေါ် ဘုရားစေတီများ`) */}
      {world.pagodas.map((pagoda) => (
        <group key={pagoda.id} position={[0, pagoda.y, 0]}>
          {/* Solid Hillside Retaining Stone Foundation beneath each Mountaintop Pagoda */}
          <mesh
            position={[pagoda.x, -6.2, pagoda.z]}
            scale={[pagoda.radius * 3.1, 12.6, pagoda.radius * 3.1]}
            geometry={c.unitCyl8Geo}
            material={retainingStoneMat}
          />
          <GoldenStupa
            placement={{
              id: pagoda.id,
              x: pagoda.x,
              z: pagoda.z,
              yaw: pagoda.yaw,
              radius: pagoda.radius,
              weekdayShrines: pagoda.weekdayShrines,
            }}
            northYaw={angle}
          />
        </group>
      ))}
    </group>
  );
});
