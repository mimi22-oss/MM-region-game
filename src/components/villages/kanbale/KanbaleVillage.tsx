import { memo, useMemo, useState } from 'react';
import { BufferGeometry, Vector3 } from 'three';
import {
  kanbaleVillage,
  kanbaleBuildings,
  kanbaleRoads,
  kanbaleBoundaryWorldPoints,
  kanbaleBoundaryBounds,
  type KanbaleBuildingData,
} from '../../../data/villages/kanbale';
import { KanbaleBuilding } from './KanbaleBuilding';
import { customBuildings } from './KanbaleCustomBuildings';
import { KanbaleDrain } from './KanbaleDrain';
import { Tree } from '../../Tree';

export interface KanbaleVillageProps {
  onSelectBuilding?: (building: KanbaleBuildingData) => void;
}

/**
 * ကံပုလဲရွာ (Kanbale Village) — 3D Scene Component
 *
 * အဓိက Feature များ:
 * ၁။ OpenStreetMap (OSM) Road Paths — တကယ့်လမ်းကြောင်းများအတိုင်း 3D Walkable Ribbons အဖြစ် Render ပြုလုပ်ခြင်း
 * ၂။ 3D Building Footprints — OSM Polygon Footprints ၆၈၀ လုံးကို Extrude လုပ်၍ တည်ဆောက်ခြင်း
 * ၃။ Custom Building Override System — `way/403027623` ကဲ့သို့ အိမ်များကို `KanbaleFarmhouse` ဖြင့် အစားထိုးခြင်း
 * ၄။ Village Boundary Line — ရွာနယ်နိမိတ်မျဉ်းကို 3D တွင် ပြသပေးခြင်း
 * ၅။ Building Selection System — အိမ်များကို Click နှိပ်၍ ID နှင့် အချက်အလက်များ ကြည့်ရှုနိုင်ခြင်း
 * ၆။ သစ်ပင်များနှင့် မြေပြင်ခင်းခြင်း (Trees & Walkable Ground)
 */
export const KanbaleVillage = memo(function KanbaleVillage({
  onSelectBuilding,
}: KanbaleVillageProps) {
  const [selectedId, setSelectedId] = useState<string | null>('way/403027623');

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    const b = kanbaleBuildings.find((item) => item.id === id);
    if (b && onSelectBuilding) {
      onSelectBuilding(b);
    }
  };

  // ၁။ ရွာနယ်နိမိတ် 3D Line Loop Geometry
  const boundaryLineGeom = useMemo(() => {
    const geom = new BufferGeometry();
    const pts = kanbaleBoundaryWorldPoints.map(
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
    }[] = [];

    kanbaleRoads.forEach((r, rIdx) => {
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
          key: `road-seg-${rIdx}-${i}`,
          mx,
          mz,
          length: length + 0.15,
          width: r.width,
          rot,
        });
      }
    });

    return list;
  }, []);

  // ၃။ ကံပုလဲရွာ နယ်နိမိတ် မြေပြင်ဧရိယာ (Village Ground Plinth)
  const groundCenterX = (kanbaleBoundaryBounds.minX + kanbaleBoundaryBounds.maxX) / 2;
  const groundCenterZ = (kanbaleBoundaryBounds.minZ + kanbaleBoundaryBounds.maxZ) / 2;
  const groundWidth = kanbaleBoundaryBounds.maxX - kanbaleBoundaryBounds.minX + 160;
  const groundDepth = kanbaleBoundaryBounds.maxZ - kanbaleBoundaryBounds.minZ + 160;

  const selectedBuilding = useMemo(
    () => kanbaleBuildings.find((b) => b.id === selectedId),
    [selectedId],
  );

  return (
    <group name="village-kanbale">
      {/* ======================================================== */}
      {/* ၁။ ရွာမြေပြင်နှင့် ဧရိယာအောက်ခံ (Walkable Village Ground) */}
      {/* ======================================================== */}
      <mesh
        position={[groundCenterX, -0.04, groundCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        userData={{ walkable: true }}
      >
        <planeGeometry args={[groundWidth, groundDepth]} />
        <meshStandardMaterial color="#889c62" roughness={0.9} />
      </mesh>

      {/* ======================================================== */}
      {/* ၂။ ရွာနယ်နိမိတ်မျဉ်း (Village Boundary Line Loop) */}
      {/* ======================================================== */}
      <lineLoop geometry={boundaryLineGeom}>
        <lineBasicMaterial color="#eab308" linewidth={2} />
      </lineLoop>

      {/* ======================================================== */}
      {/* ၃။ OSM လမ်းကြောင်းများ (Walkable Real OSM Roads) */}
      {/* ======================================================== */}
      <group name="kanbale-roads">
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
              color="#596663"
              roughness={0.88}
              metalness={0.05}
            />
          </mesh>
        ))}
      </group>

      {/* ======================================================== */}
      {/* ၄။ အဆောက်အအုံများ (Buildings with Custom Override System) */}
      {/* ======================================================== */}
      <group name="kanbale-buildings">
        {kanbaleBuildings.map((building) => {
          const isSelected = selectedId === building.id;
          const CustomComponent = customBuildings[building.id];

          if (CustomComponent) {
            return (
              <CustomComponent
                key={building.id}
                building={building}
                selected={isSelected}
                onSelect={handleSelect}
              />
            );
          }

          return (
            <KanbaleBuilding
              key={building.id}
              building={building}
              selected={isSelected}
              onSelect={handleSelect}
            />
          );
        })}
      </group>

      {/* ======================================================== */}
      {/* ၄.၅။ ရေနုတ်မြောင်း (Waterway Drain & Bridges) */}
      {/* ======================================================== */}
      <KanbaleDrain />

      {/* ======================================================== */}
      {/* ၅။ သစ်ပင်များ (Vegetation & Trees) */}
      {/* ======================================================== */}
      <group name="kanbale-trees">
        {kanbaleVillage.largeTrees.map((t, i) => (
          <Tree key={t.id} t={t} i={i} variant="large" />
        ))}
        {kanbaleVillage.trees.map((t, i) => (
          <Tree key={t.id} t={t} i={i} variant="canopy" />
        ))}
      </group>

      {/* ======================================================== */}
      {/* ၆။ ရွေးချယ်ထားသော အဆောက်အအုံ အချက်အလက် Floating 3D Badge */}
      {/* ======================================================== */}
      {selectedBuilding && (
        <group
          position={[
            selectedBuilding.x,
            selectedBuilding.height + 2.5,
            selectedBuilding.z,
          ]}
        >
          {/* Beacon Point Light */}
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
