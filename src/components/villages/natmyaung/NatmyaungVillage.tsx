import { memo, useMemo, useState } from 'react';
import { BufferGeometry, Vector3 } from 'three';
import {
  natmyaungVillage,
  natmyaungBuildings,
  natmyaungRoads,
  natmyaungBoundaryWorldPoints,
  natmyaungBoundaryBounds,
  natmyaungPonds,
  type NatmyaungBuildingData,
} from '../../../data/villages/natmyaung';
import { NatmyaungBuilding } from './NatmyaungBuilding';
import { Tree } from '../../Tree';
import { diagnosticConfig } from '../../../game/diagnosticMode';

export interface NatmyaungVillageProps {
  onSelectBuilding?: (building: NatmyaungBuildingData) => void;
}

/**
 * နတ်မြောင်းရွာ (Nat Myaung Village) — 3D Scene Component
 *
 * အဓိက Feature များ:
 * ၁။ OpenStreetMap (OSM) Road Paths — AH1 နှင့် ရွာတွင်းလမ်း ၄ သွယ်ကို Walkable 3D Ribbons အဖြစ် Render ပြုလုပ်ခြင်း
 * ၂။ 3D Building Models — မြို့သာရပ်ကွက် နယ်မြေ (၅) စတိုင် အမိုးခုံးခေါင်မိုး၊ ကမ်းဆိုင်းခါးပတ်၊ ပြတင်းပေါက်များနှင့် ခြံစည်းရိုး
 * ၃။ Village Landmarks — အုပ်ချုပ်ရေးမှူးရုံး၊ မူလတန်းကျောင်း၊ ကျေးလက်ဆေးပေးခန်း၊ ဘုန်းတော်ကြီးကျောင်း၊ ရွာလယ်ရေကန်
 * ၄။ Village Boundary Line — ရွာနယ်နိမိတ်မျဉ်းကို 3D တွင် ပြသပေးခြင်း
 * ၅။ Building Selection System — အိမ်များနှင့် အဆောက်အအုံများကို Click နှိပ်၍ အချက်အလက်များ ကြည့်ရှုနိုင်ခြင်း
 * ၆။ အရိပ်ရသစ်ပင်ကြီးများနှင့် စိမ်းလန်းသောမြေပြင်
 */
export const NatmyaungVillage = memo(function NatmyaungVillage({
  onSelectBuilding,
}: NatmyaungVillageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    const b = natmyaungBuildings.find((item) => item.id === id);
    if (b && onSelectBuilding) {
      onSelectBuilding(b);
    }
  };

  // ၁။ ရွာနယ်နိမိတ် 3D Line Loop Geometry
  const boundaryLineGeom = useMemo(() => {
    const geom = new BufferGeometry();
    const pts = natmyaungBoundaryWorldPoints.map(
      (p) => new Vector3(p[0], 0.25, p[1]),
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

    natmyaungRoads.forEach((r, rIdx) => {
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
          key: `nm-road-seg-${rIdx}-${i}`,
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

  // ၃။ နတ်မြောင်းရွာ နယ်နိမိတ် မြေပြင်ဧရိယာ (Village Ground Plinth)
  const groundBounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const b of natmyaungBuildings) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
      if (b.z < minZ) minZ = b.z;
      if (b.z > maxZ) maxZ = b.z;
    }
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      w: maxX - minX + 60,
      d: maxZ - minZ + 60,
    };
  }, []);

  const selectedBuilding = useMemo(
    () => natmyaungBuildings.find((b) => b.id === selectedId),
    [selectedId],
  );

  return (
    <group name="village-natmyaung">
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
        <group name="natmyaung-roads">
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
      {/* ၄။ နတ်မြောင်း ရွာလယ်ရေကန် (Village Pond) */}
      {/* ======================================================== */}
      {natmyaungPonds.map((pond) => (
        <group key={pond.id} position={[pond.x, 0.05, pond.z]}>
          {/* ရေပြင်အောက်ခံ (Water Basin) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[pond.width / 2, 32]} />
            <meshStandardMaterial
              color="#2a6f97"
              roughness={0.2}
              metalness={0.3}
            />
          </mesh>
          {/* ကန်ပေါင် (Pond Bank) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[pond.width / 2 - 0.5, pond.width / 2 + 1.2, 32]} />
            <meshStandardMaterial color="#606c38" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ======================================================== */}
      {/* ၅။ အဆောက်အအုံများနှင့် လူနေအိမ်များ (Buildings) */}
      {/* ======================================================== */}
      {!diagnosticConfig.disableBuildings && (
        <group name="natmyaung-buildings">
          {natmyaungBuildings.map((building) => (
            <NatmyaungBuilding
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
      <group name="natmyaung-trees">
        {natmyaungVillage.largeTrees.map((t, i) => (
          <Tree key={t.id} t={t} i={i} variant="large" />
        ))}
        {natmyaungVillage.trees.map((t, i) => (
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
