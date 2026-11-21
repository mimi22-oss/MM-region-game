import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import {
  natmyaungVillage,
  natmyaungBuildings,
  natmyaungRoads,
  natmyaungBoundaryWorldPoints,
  natmyaungBoundaryBounds,
  natmyaungPonds,
  type NatmyaungBuildingData,
} from '../../../data/villages/natmyaung';
import { natmyaungWeipulaSeparationFields } from '../../../data/villages/natmyaung/separationFields';
import { registerGroundRegion, releaseGroundRegion } from '../../../game/groundSurface';
import { NatmyaungBuilding } from './NatmyaungBuilding';
import { Tree } from '../../Tree';
import { diagnosticConfig } from '../../../game/diagnosticMode';

/** 10 bunded separation paddy fields between Nat Myaung village and Maha Weipula Mountain (1 instanced draw call). */
function NatmyaungWeipulaPaddyFields() {
  const meshRef = useRef<InstancedMesh>(null);
  const { scene } = useThree();

  useLayoutEffect(() => {
    const object = meshRef.current;
    if (!object) return;
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const axis = new Vector3(0, 1, 0);
    const position = new Vector3();
    const size = new Vector3();
    const color = new Color();
    let idx = 0;

    for (const f of natmyaungWeipulaSeparationFields) {
      const c = Math.cos(f.rotation);
      const s = Math.sin(f.rotation);
      rotation.setFromAxisAngle(axis, f.rotation);
      const put = (u: number, y: number, v: number, w: number, h: number, d: number, paint: string) => {
        matrix.compose(
          position.set(f.x + u * c + v * s, y, f.z - u * s + v * c),
          rotation,
          size.set(w, h, d),
        );
        object.setMatrixAt(idx, matrix);
        object.setColorAt(idx++, color.set(paint));
      };
      // Paddy interior plot
      put(0, 0.02, 0, f.width, 0.08, f.depth, f.color);
      // 4 earthen bund walls (ကန်သင်းရိုး)
      for (const side of [-1, 1]) {
        put(0, 0.07, (side * f.depth) / 2, f.width, 0.1, 0.45, '#556b2f');
        put((side * f.width) / 2, 0.07, 0, 0.45, 0.1, f.depth, '#556b2f');
      }
    }

    object.instanceMatrix.needsUpdate = true;
    if (object.instanceColor) object.instanceColor.needsUpdate = true;
    object.computeBoundingSphere();
    object.computeBoundingBox();

    const regionId = 'natmyaung-weipula-separation-fields';
    registerGroundRegion(scene, regionId, object);
    return () => releaseGroundRegion(scene, regionId);
  }, [scene]);

  return (
    <instancedMesh
      name="natmyaung-weipula-paddy-fields"
      ref={meshRef}
      args={[undefined, undefined, natmyaungWeipulaSeparationFields.length * 5]}
      receiveShadow
      userData={{ walkable: true }}
    >
      <boxGeometry />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

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
      {/* ၄။ နတ်မြောင်း-မဟာဝေပုလ္လကြား လယ်ကွင်း ၁၀ ကွင်း (10 Separation Paddy Fields) */}
      {/* ======================================================== */}
      <NatmyaungWeipulaPaddyFields />

      {/* ======================================================== */}
      {/* ၅။ နတ်မြောင်း ရွာလယ်ရေကန် (Village Pond) */}
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
