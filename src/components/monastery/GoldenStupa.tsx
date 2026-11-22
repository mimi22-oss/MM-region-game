import { memo } from 'react';
import { getMonasteryBuildingAssetCache } from '../../game/monasteryAssets';
import {
  getPagodaAnimalGeometry,
  getPagodaAssets,
  getPagodaShrineAssets,
} from '../../game/pagodaAssets';
import {
  PAGODA_APRON,
  PAGODA_WEEKDAYS,
  getPagodaShrines,
  type PagodaPlacement,
  type PagodaShrinePlacement,
} from '../../game/pagodaLayout';

export { PAGODA_WEEKDAYS as MYANMAR_PLANETARY_DAYS };
export type PlanetaryDaySpec = (typeof PAGODA_WEEKDAYS)[number];

/**
 * Reusable Planetary Day-of-Week Shrine (`နေ့နံ ၈ ခု / ဂြိုဟ်တိုင် နှင့် ရေသပ္ပာယ်ဖလား`)
 */
export const PlanetaryDayShrine = memo(function PlanetaryDayShrine({
  shrine,
}: {
  shrine: PagodaShrinePlacement;
}) {
  const stupaAssets = getPagodaAssets();
  const shrineAssets = getPagodaShrineAssets();
  const animalGeo = getPagodaAnimalGeometry(shrine.figure);
  const c = getMonasteryBuildingAssetCache();
  const plaqueMat = c.getPlanetaryPlaqueMat(shrine.label, `${shrine.animal} · နေ့နံထောင့်`);

  return (
    <group
      position={[shrine.x, 0, shrine.z]}
      rotation={[0, shrine.yaw, 0]}
      scale={[shrine.scale, shrine.scale, shrine.scale]}
      name={`pagoda-weekday-shrine-${shrine.id}`}
    >
      <mesh geometry={shrineAssets.pedestal} material={stupaAssets.stone} castShadow receiveShadow />
      <mesh geometry={shrineAssets.trim} material={stupaAssets.gold} castShadow />
      <mesh geometry={shrineAssets.niche} material={shrineAssets.insetMat} />
      <mesh geometry={shrineAssets.statue} material={stupaAssets.gilding} castShadow />
      <mesh geometry={shrineAssets.basin} material={stupaAssets.stone} receiveShadow />
      <mesh geometry={shrineAssets.water} material={shrineAssets.waterMat} />
      <mesh position={[0, 1.78, -0.38]} geometry={animalGeo} material={stupaAssets.gilding} castShadow />
      <mesh position={[0, 1.46, -0.32]} geometry={shrineAssets.plaque} material={plaqueMat} />
    </group>
  );
});

export interface GoldenStupaProps {
  readonly placement?: PagodaPlacement;
  readonly northYaw?: number;
  readonly x?: number;
  readonly z?: number;
  readonly radius?: number;
  readonly yaw?: number;
  readonly weekdayShrines?: boolean;
}

/**
 * Reusable Realistic Myanmar Golden Pagoda / Stupa (`စေတီတော်`)
 * backed by `getPagodaAssets()` & `getPagodaShrineAssets()` Singleton caches.
 */
export const GoldenStupa = memo(function GoldenStupa({
  placement,
  northYaw = 0,
  x = 0,
  z = 0,
  radius = 3,
  yaw = 0,
  weekdayShrines = false,
}: GoldenStupaProps) {
  const p: PagodaPlacement = placement ?? {
    id: 'golden-stupa',
    x,
    z,
    radius,
    yaw,
    weekdayShrines,
  };
  const a = getPagodaAssets();
  const r = p.radius;
  const apronRadius = r * (p.weekdayShrines ? PAGODA_APRON.shrineRadius : PAGODA_APRON.radius);
  const apronThickness = r * PAGODA_APRON.thickness;
  const shrines = getPagodaShrines(p, northYaw);

  return (
    <group name={`monastery-pagoda-${p.id}`}>
      {/* Walkable Pagoda Terrace Apron */}
      <mesh
        position={[p.x, PAGODA_APRON.baseY, p.z]}
        scale={[apronRadius, apronThickness, apronRadius]}
        geometry={a.apron}
        material={a.terrace}
        receiveShadow
        userData={{ walkable: true }}
      />

      {/* Scaled Pagoda Stupa Core (`ပစ္စယာ၊ ဖောင်းရစ်၊ ခေါင်းလောင်းမှောက်၊ ကြာမှောက်ကြာလန်၊ ထီးတော်၊ စိန်ဖူးတော်`) */}
      <group position={[p.x, 0, p.z]} rotation={[0, p.yaw ?? 0, 0]} scale={[r, r, r]}>
        <mesh geometry={a.plinth} material={a.stone} castShadow receiveShadow />
        <mesh geometry={a.structure} material={a.gold} castShadow receiveShadow />
        <mesh geometry={a.decoration} material={a.gilding} castShadow />
        <mesh geometry={a.finial} material={a.gem} />
      </group>

      {/* 8 Traditional Planetary Day-of-Week Shrines (`နေ့နံ ၈ ခု`) */}
      {shrines.map((shrine) => (
        <PlanetaryDayShrine key={shrine.id} shrine={shrine} />
      ))}
    </group>
  );
});
