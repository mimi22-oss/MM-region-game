import { memo, useMemo, useState } from 'react';
import { BufferGeometry, Vector3 } from 'three';
import {
  siTharVillage,
  siTharBuildings,
  siTharRoads,
  siTharBoundaryWorldPoints,
  siTharBoundaryBounds,
  siTharSeparationFields,
  siTharLeftSeparationFields,
  siTharRightSeparationFields,
  type SiTharBuildingData,
} from '../../../data/villages/sithar';
import { SiTharBuilding } from './SiTharBuilding';
import { Tree } from '../../Tree';
import { diagnosticConfig } from '../../../game/diagnosticMode';

export interface SiTharVillageProps {
  onSelectBuilding?: (building: SiTharBuildingData) => void;
}

/**
 * စည်သာရွာ (Si Thar Village) — 3D Scene Component
 *
 * အဓိက Feature များ:
 * ၁။ OpenStreetMap (OSM) Road Paths — AH1 နှင့် ရွာတွင်းလမ်း ၂၅ သွယ်ကို Walkable 3D Ribbons အဖြစ် Render ပြုလုပ်ခြင်း
 * ၂။ 3D Building Models — မြို့သာ Area 5 စတိုင် စောက်ချိုးအမိုးခေါင်၊ ကမ်းဆိုင်းခါးပတ်၊ ပြတင်းပေါက်များနှင့် ခြံစည်းရိုး
 * ၃။ Village Landmarks — စည်သာ နှစ်ခြင်းဘုရားကျောင်း၊ စာကြည့်တိုက်၊ ပင်တေကုတ္တေကျောင်း၊ ရန်ကင်းဓမ္မသုခကျောင်းတိုက်၊ ဘူတာရုံ၊ အုပ်ချုပ်ရေးမှူးရုံး
 * ၄။ ခြားထားသော လယ်ကွင်းများ — ရွာညာဘက် (AH1 အရှေ့ဘက်) ၁၀ ကွက် နှင့် ရွာဘယ်ဘက် (ရွာအနောက်ဘက်) ၁၀ ကွက်
 * ၅။ Village Boundary Line — ရွာနယ်နိမိတ်မျဉ်းကို 3D တွင် ပြသပေးခြင်း
 * ၆။ Building Selection System — အဆောက်အအုံများကို Click နှိပ်၍ အချက်အလက်များ ကြည့်ရှုနိုင်ခြင်း
 * ၇။ အရိပ်ရသစ်ပင်ကြီးများနှင့် စိမ်းလန်းသောမြေပြင်
 */
export const SiTharVillage = memo(function SiTharVillage({
  onSelectBuilding,
}: SiTharVillageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    const b = siTharBuildings.find((item) => item.id === id);
    if (b && onSelectBuilding) {
      onSelectBuilding(b);
    }
  };

  // ၁။ ရွာနယ်နိမိတ် 3D Line Loop Geometry
  const boundaryLineGeom = useMemo(() => {
    const geom = new BufferGeometry();
    const pts = siTharBoundaryWorldPoints.map(
      (p: [number, number]) => new Vector3(p[0], 0.25, p[1]),
    );
    geom.setFromPoints(pts);
    return geom;
  }, []);

  // ၂။ လမ်းဆုံ/လမ်းကြောင်း Segment များ တွက်ချက်ခြင်း (Walkable Road Ribbons)
  const roadSegments = useMemo(() => {
    const list: {
      key: string;
      mx: number;
      mz: number;
      length: number;
      width: number;
      rot: number;
      isAh1: boolean;
    }[] = [];

    siTharRoads.forEach((r, rIdx) => {
      const pts = r.worldPoints;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const length = Math.hypot(dx, dz);
        if (length < 0.3) continue;

        const mx = (p1[0] + p2[0]) / 2;
        const mz = (p1[1] + p2[1]) / 2;
        const rot = -Math.atan2(dz, dx);

        list.push({
          key: `st-road-seg-${rIdx}-${i}`,
          mx,
          mz,
          length: length + 0.15,
          width: r.width,
          rot,
          isAh1: r.highway === 'trunk',
        });
      }
    });

    return list;
  }, []);

  // ၃။ စည်သာရွာ မြေပြင်ဧရိယာ (Village Ground Plinth)
  const groundBounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const b of siTharBuildings) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
      if (b.z < minZ) minZ = b.z;
      if (b.z > maxZ) maxZ = b.z;
    }
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      w: maxX - minX + 50,
      d: maxZ - minZ + 50,
    };
  }, []);

  const selectedBuilding = useMemo(
    () => siTharBuildings.find((b) => b.id === selectedId),
    [selectedId],
  );

  return (
    <group name="village-sithar">
      {/* ======================================================== */}
      {/* ၁။ ရွာမြေပြင်နှင့် ဧရိယာအောက်ခံ (Walkable Village Ground) */}
      {/* ======================================================== */}
      <mesh
        position={[groundBounds.cx, -0.04, groundBounds.cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        userData={{ walkable: true }}
      >
        <planeGeometry args={[groundBounds.w, groundBounds.d]} />
        <meshStandardMaterial color="#84995f" roughness={0.9} />
      </mesh>

      {/* ======================================================== */}
      {/* ၂။ ရွာနယ်နိမိတ်မျဉ်း (Village Boundary Line Loop) */}
      {/* ======================================================== */}
      {!diagnosticConfig.disableOSM && (
        <lineLoop geometry={boundaryLineGeom}>
          <lineBasicMaterial color="#eab308" linewidth={2} />
        </lineLoop>
      )}

      {/* ======================================================== */}
      {/* ၃။ OSM လမ်းကြောင်းများ (Walkable Real OSM Roads) */}
      {/* ======================================================== */}
      {!diagnosticConfig.disableOSM && (
        <group name="sithar-roads">
          {roadSegments.map((s) => (
            <mesh
              key={s.key}
              position={[s.mx, 0.04, s.mz]}
              rotation={[-Math.PI / 2, 0, s.rot]}
              receiveShadow
              userData={{ walkable: true }}
            >
              <planeGeometry args={[s.length, s.width]} />
              <meshStandardMaterial
                color={s.isAh1 ? '#3a4443' : '#5f665e'}
                roughness={0.88}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ======================================================== */}
      {/* ၄။ ခြားထားသော လယ်ကွင်းများ (Separation Fields: ကြာအင်း-စည်သာကြား ၁၀ ကွက်၊ စည်သာ-နတ်မြောင်းကြား ၁၀ ကွက်၊ စုစုပေါင်း ၂၀ ကွက်) */}
      {/* ======================================================== */}
      {/* Fields stream independently via Town -> SeparationFieldTiles. */}

      {/* ======================================================== */}
      {/* ၅။ အဆောက်အအုံများနှင့် လူနေအိမ်များ (Buildings) */}
      {/* ======================================================== */}
      {!diagnosticConfig.disableBuildings && (
        <group name="sithar-buildings">
          {siTharBuildings.map((building) => (
            <SiTharBuilding
              key={building.id}
              building={building}
              selected={selectedId === building.id}
              onSelect={handleSelect}
            />
          ))}
        </group>
      )}

      {/* ======================================================== */}
      {/* ၆။ သစ်ပင်များ (Vegetation & Trees) */}
      {/* ======================================================== */}
      <group name="sithar-trees">
        {siTharVillage.largeTrees.map((t, i) => (
          <Tree key={t.id} t={t} i={i} variant="large" />
        ))}
        {siTharVillage.trees.map((t, i) => (
          <Tree key={t.id} t={t} i={i} variant="canopy" />
        ))}
      </group>

      {/* ======================================================== */}
      {/* ၇။ ရွေးချယ်ထားသော အဆောက်အအုံ Floating 3D Badge */}
      {/* ======================================================== */}
      {selectedBuilding && (
        <group
          position={[
            selectedBuilding.x,
            5.5,
            selectedBuilding.z,
          ]}
        >
          <pointLight intensity={3.5} distance={15} color="#38bdf8" />
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      )}
    </group>
  );
});
