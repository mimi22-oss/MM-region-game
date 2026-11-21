import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { angle, toWorld } from '../data/ward';
import { mobileQuality } from '../game/sceneBudget';
import { getChinHouseDoorOpen } from '../game/chinVillages';
import { defaultChinCompoundBounds, type ChinCompoundBounds } from '../game/chinVillagerPool';
import {
  disposeChinHouseAssetCache,
  getChinHouseAssetCache,
  type ChinHouseAssetCache,
} from '../game/chinHouseAssets';

export { disposeChinHouseAssetCache, getChinHouseAssetCache, type ChinHouseAssetCache };

/**
 * ချင်းရိုးရာ အောက်ချင်းငှက် ခေါင်မိုးအမှတ်အသား (3D Sculpted Great Hornbill Roof Emblem)
 *
 * Perched proudly atop Chin traditional rooftops with:
 * - Jet-black body & outspread wings with white trailing edge tips
 * - Crisp white neck collar
 * - Iconic golden-yellow long curved beak + prominent orange-gold casque
 * - Long white hornbill tail with signature black sub-terminal band
 */
export function ChinHornbillRoofEmblem({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: {
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const c = getChinHouseAssetCache();

  return (
    <group
      name="chin-hornbill-roof-emblem"
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[scale, scale, scale]}
    >
      {/* ခေါင်မိုးထိပ် ချင်းရိုးရာ ထိုင်ခုံပလ္လင် (Carved Chin Ridge Pedestal) */}
      <mesh position={[0, 0.11, 0]} geometry={c.perchBaseGeo} material={c.teakDarkMat} castShadow />
      <mesh position={[0, 0.25, 0]} scale={[1.05, 0.08, 0.34]} geometry={c.unitBoxGeo} material={c.chinCrimsonMat} />
      <mesh position={[0, 0.48, 0]} geometry={c.perchPostGeo} material={c.teakDarkMat} castShadow />

      {/* အောက်ချင်းငှက် ကိုယ်ထည် (Great Hornbill Body facing +Z) */}
      <group position={[0, 0.92, 0]}>
        {/* အနက်ရောင် ကိုယ်ထည် (Black Torso) */}
        <mesh
          position={[0, 0, -0.04]}
          scale={[0.82, 0.78, 1.32]}
          geometry={c.hornbillBodyGeo}
          material={c.hornbillBlackMat}
          castShadow
        />

        {/* အဖြူရောင် လည်ပင်းနှင့် ရင်ဘတ် (Iconic White Neck Collar) */}
        <mesh
          position={[0, 0.22, 0.2]}
          rotation={[0.38, 0, 0]}
          geometry={c.hornbillNeckGeo}
          material={c.hornbillWhiteMat}
          castShadow
        />

        {/* ခေါင်းနှင့် မျက်လုံး (Head) */}
        <mesh
          position={[0, 0.39, 0.3]}
          geometry={c.hornbillHeadGeo}
          material={c.hornbillBlackMat}
          castShadow
        />

        {/* အောက်ချင်းငှက် ခေါင်းမောက် ရွှေလိမ္မော်ရောင် (Signature Hornbill Casque) */}
        <mesh
          position={[0, 0.51, 0.42]}
          rotation={[0.16, 0, 0]}
          geometry={c.hornbillCasqueGeo}
          material={c.hornbillCasqueOrangeMat}
          castShadow
        />

        {/* ရှည်လျားကောက်ကွေးသော ရွှေဝါရောင် နှုတ်သီးကြီး (Long Curved Golden Hornbill Beak) */}
        <mesh
          position={[0, 0.39, 0.68]}
          rotation={[Math.PI / 2 + 0.2, 0, 0]}
          geometry={c.hornbillBeakUpperGeo}
          material={c.hornbillBeakGoldMat}
          castShadow
        />
        <mesh
          position={[0, 0.32, 0.6]}
          rotation={[Math.PI / 2 + 0.14, 0, 0]}
          geometry={c.hornbillBeakLowerGeo}
          material={c.hornbillBeakGoldMat}
        />

        {/* ဖြန့်ကားထားသော အောက်ချင်းငှက် တောင်ပံ ၂ ဖက် (Spread Black Wings + White Edge Tips) */}
        {([-1, 1] as const).map(side => (
          <group
            key={`hb-wing-${side}`}
            position={[side * 0.56, 0.12, -0.02]}
            rotation={[0.14, -side * 0.18, side * 0.34]}
          >
            <mesh geometry={c.hornbillWingGeo} material={c.hornbillBlackMat} castShadow />
            {/* တောင်ပံအဖြူရောင် အနားကွပ် (White Wing Bar & Feathers) */}
            <mesh
              position={[side * 0.32, -0.01, -0.14]}
              geometry={c.hornbillWingTipGeo}
              material={c.hornbillWhiteMat}
            />
          </group>
        ))}

        {/* ရှည်လျားသော အဖြူရောင်အမြီးနှင့် အနက်ရောင်ကန့်လန့်စင်း (Signature White Tail + Black Band) */}
        <group position={[0, -0.16, -0.58]} rotation={[-0.42, 0, 0]}>
          <mesh geometry={c.hornbillTailGeo} material={c.hornbillWhiteMat} castShadow />
          <mesh position={[0, 0, -0.16]} geometry={c.hornbillTailBandGeo} material={c.hornbillBlackMat} />
        </group>
      </group>
    </group>
  );
}

/**
 * ချင်းရိုးရာ နွားနောက်ဦးချို အမှတ်အသား (Traditional Chin Carved Mithun Horn Plaque)
 */
function ChinMithunWallEmblem({ position }: { position: [number, number, number] }) {
  const c = getChinHouseAssetCache();
  return (
    <group position={position} name="chin-mithun-symbol">
      <mesh geometry={c.mithunShieldGeo} material={c.chinCrimsonMat} />
      {([-1, 1] as const).map(side => (
        <mesh
          key={`horn-${side}`}
          position={[side * 0.24, 0.12, 0.06]}
          rotation={[0, 0, side < 0 ? Math.PI * 0.22 : -Math.PI * 0.98]}
          geometry={c.mithunHornGeo}
          material={c.mithunHornMat}
        />
      ))}
    </group>
  );
}

export interface ChinTraditionalHouseProps {
  u: number;
  v: number;
  baseY: number;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  roofColor: string;
  title: string;
  hasLoom?: boolean;
  hasDryingRack?: boolean;
  hasFlag?: boolean;
  hasClinicCross?: boolean;
  hasChimney?: boolean;
  /** Shows the iconic Chin Hornbill (အောက်ချင်းငှက်) rooftop emblem (default: true). */
  showHornbill?: boolean;
  hornbillScale?: number;
}

/**
 * ချင်းရိုးရာ တောင်ပေါ် ပျဉ်ထောင်အိမ် (Dedicated Reusable Chin Traditional House Component)
 *
 * Includes authentic Chin cultural architecture:
 * - Sculpted Great Hornbill (အောက်ချင်းငှက်) perched proudly atop the roof ridge
 * - Woven Chin geometric diamond pattern eaves frieze (ချင်းရိုးရာ ဂျပ်ခုတ်အဆင် မျက်နှာစာ)
 * - Traditional Chin Mithun horn gable plaque (နွားနောက်ဦးချို အမှတ်အသား)
 * - Timber foundation stilts, walkable front veranda, orchid flower boxes, loom/corn rack
 */
export function ChinTraditionalHouse({
  u,
  v,
  baseY,
  width,
  depth,
  height,
  wallColor,
  roofColor,
  title,
  hasLoom,
  hasDryingRack,
  hasFlag,
  hasClinicCross,
  hasChimney,
  showHornbill = true,
  hornbillScale = 1.08,
}: ChinTraditionalHouseProps) {
  const c = getChinHouseAssetCache();
  const pos = toWorld(u, v);
  const halfW = width / 2;
  const halfD = depth / 2;

  return (
    <group name={`chin-house-${title}`} position={[pos.x, baseY, pos.z]} rotation={[0, angle, 0]}>
      {/* အိမ်တိုင်လုံးများ (Timber Foundation Stilts — shared geometry & material) */}
      {[-halfW + 0.6, 0, halfW - 0.6].flatMap(px =>
        [-halfD + 0.6, 0, halfD + 0.6].map(pz => (
          <mesh
            key={`post-${px}-${pz}`}
            position={[px, 0.6, pz]}
            geometry={c.postGeo}
            material={c.teakDarkMat}
            castShadow
          />
        )),
      )}

      {/* အိမ်မကြီး ပျဉ်ကာနံရံများ (Main House Timber Living Quarters) */}
      <mesh position={[0, height / 2 + 0.8, -0.6]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth - 2.4]} />
        <meshStandardMaterial color={wallColor} roughness={0.8} />
      </mesh>

      {/* ချင်းရိုးရာ ဂျပ်ခုတ်အဆင် အိမ်မျက်နှာစာ ခါးပတ်တန်း (Traditional Chin Woven Diamond Frieze) */}
      <mesh
        position={[0, height + 0.56, -0.6 + (depth - 2.4) / 2 + 0.06]}
        scale={[width + 0.12, 0.54, 0.08]}
        geometry={c.unitBoxGeo}
        material={c.chinFriezeMat}
      />

      {/* ချင်းရိုးရာ နွားနောက်ဦးချို အမှတ်အသား (Traditional Chin Mithun Horn Emblem on Gable Front) */}
      {!hasClinicCross && (
        <ChinMithunWallEmblem position={[0, height + 0.08, -0.6 + (depth - 2.4) / 2 + 0.08]} />
      )}

      {/* အမိုးစောက် ခေါင်မိုးအဆင့်ဆင့် + အောက်ချင်းငှက် ခေါင်မိုးအမှတ်အသား */}
      <group position={[0, height + 1.2, -0.6]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[width + 1.6, 0.35, depth - 1.2]} />
          <meshStandardMaterial color={roofColor} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[width * 0.75, 0.65, depth * 0.65]} />
          <meshStandardMaterial color={roofColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.45, 0]} castShadow>
          <boxGeometry args={[width * 0.45, 0.45, depth * 0.4]} />
          <meshStandardMaterial color={roofColor} roughness={0.55} />
        </mesh>

        {/* ခေါင်မိုးထိပ် အောက်ချင်းငှက်ပုံ (Great Hornbill Rooftop Symbol facing front veranda) */}
        {showHornbill && (
          <ChinHornbillRoofEmblem position={[0, 1.68, 0.15]} scale={hornbillScale} />
        )}
      </group>

      {/* ပြတင်းပေါက် သစ်သားတံခါးရွက်များ (Windows with Wooden Shutters) */}
      {[-halfW + 1.4, halfW - 1.4].map(wx => (
        <mesh
          key={`win-${wx}`}
          position={[wx, height * 0.55 + 0.8, -0.6 + (depth - 2.4) / 2 + 0.05]}
          scale={[1.3, 1.3, 0.1]}
          geometry={c.unitBoxGeo}
          material={c.windowDarkMat}
        />
      ))}

      {/* အိမ်ရှေ့ ကျွန်းသား တံခါးမကြီး ၂ ချပ်နှင့် ကြမ်းသုတ်ဖျာ (Farmhouse-style Double Teak Front Door & Mat) */}
      <group name="chin-house-front-door" position={[0, 0.85, -0.6 + (depth - 2.4) / 2]}>
        {/* တံခါးဘောင် (Teak Door Frame: left/right jambs + top lintel) */}
        {([-0.92, 0.92] as const).map(dx => (
          <mesh
            key={`jamb-${dx}`}
            position={[dx, 1.18, 0.04]}
            scale={[0.14, 2.36, 0.2]}
            geometry={c.unitBoxGeo}
            material={c.doorFrameMat}
          />
        ))}
        <mesh
          position={[0, 2.38, 0.04]}
          scale={[1.98, 0.16, 0.22]}
          geometry={c.unitBoxGeo}
          material={c.doorFrameMat}
        />
        {/* တံခါးရွက် ၂ ချပ် (Double Teak Door Leaves + Brass Handles) */}
        {([-0.42, 0.42] as const).map(dx => (
          <mesh
            key={`leaf-${dx}`}
            position={[dx, 1.16, 0.05]}
            scale={[0.8, 2.26, 0.08]}
            geometry={c.unitBoxGeo}
            material={c.doorLeafMat}
          />
        ))}
        {([-0.14, 0.14] as const).map(hx => (
          <mesh
            key={`handle-${hx}`}
            position={[hx, 1.12, 0.11]}
            scale={[0.06, 0.24, 0.06]}
            geometry={c.unitBoxGeo}
            material={c.chinGoldMat}
          />
        ))}
        {/* အဝင်ကြိုဆို ကြမ်းသုတ်ဖျာ (Welcome Door Mat) */}
        <mesh
          position={[0, 0.02, 0.56]}
          scale={[1.4, 0.03, 0.7]}
          geometry={c.unitBoxGeo}
          material={c.welcomeMatMat}
        />
      </group>

      {/* အရှေ့ဘက် လသာဆောင် ဝရံတာ (Walkable Front Veranda Deck) */}
      <mesh
        userData={{ walkable: true }}
        position={[0, 0.75, halfD - 1.1]}
        scale={[width + 0.6, 0.2, 2.6]}
        geometry={c.unitBoxGeo}
        material={c.verandaDeckMat}
        receiveShadow
      />

      {/* ဝရံတာ လက်ရန်းတိုင်များနှင့် အကာအရံ (Veranda Timber Railing) */}
      <group position={[0, 1.35, halfD + 0.15]}>
        <mesh scale={[width + 0.6, 0.1, 0.12]} geometry={c.unitBoxGeo} material={c.teakDarkMat} />
        {[-halfW + 0.2, 0, halfW - 0.2].map(rx => (
          <mesh
            key={`rail-post-${rx}`}
            position={[rx, -0.3, 0]}
            scale={[0.15, 0.6, 0.15]}
            geometry={c.unitBoxGeo}
            material={c.teakDarkMat}
          />
        ))}
      </group>

      {/* ဝရံတာပေါ်က ပန်းအိုးတန်းများ (Flower Boxes with Mountain Orchids) */}
      {[-halfW + 1.0, halfW - 1.0].map(fx => (
        <group key={`flower-${fx}`} position={[fx, 1.45, halfD + 0.15]}>
          <mesh scale={[1.4, 0.25, 0.3]} geometry={c.unitBoxGeo} material={c.timberMidMat} />
          {[-0.4, 0, 0.4].map(px => (
            <mesh
              key={`bloom-${px}`}
              position={[px, 0.25, 0]}
              geometry={c.flowerBloomGeo}
              material={px < 0 ? c.bloomPinkMat : px === 0 ? c.bloomGoldMat : c.bloomRoseMat}
            />
          ))}
        </group>
      ))}

      {/* ဝရံတာ အဝင် ဆင်ခြေလျှောခင်း (Step / Approach Ramp to Veranda) */}
      <mesh
        userData={{ walkable: true }}
        position={[0, 0.4, halfD + 0.55]}
        scale={[2.4, 0.35, 0.8]}
        geometry={c.unitBoxGeo}
        material={c.stepRampMat}
        receiveShadow
      />

      {/* ဆိုင်ကယ် ရပ်နားရန် ကျောက်ပြားခင်း နေရာ (Paved Motorcycle Parking Pad) */}
      <mesh
        userData={{ walkable: true }}
        position={[halfW + 1.5, 0.1, 0]}
        scale={[2.6, 0.15, 4.2]}
        geometry={c.unitBoxGeo}
        material={c.parkingStoneMat}
        receiveShadow
      />

      {/* ယက္ကန်းစင် (Traditional Chin Handloom Display on Veranda) */}
      {hasLoom && (
        <group position={[-halfW + 1.8, 1.15, halfD - 0.8]}>
          <mesh position={[0, 0.4, 0]} scale={[1.4, 0.8, 0.8]} geometry={c.unitBoxGeo} material={c.teakDarkMat} />
          <mesh position={[0, 0.45, 0.42]} scale={[1.2, 0.7, 0.04]} geometry={c.unitBoxGeo} material={c.chinFriezeMat} />
        </group>
      )}

      {/* ပြောင်းဖူးလှန်းစင် (Corn Drying Rack with Golden Cobs) */}
      {hasDryingRack && (
        <group position={[-halfW - 0.8, 0.2, halfD - 1.0]}>
          <mesh position={[0, 1.2, 0]} scale={[0.2, 2.4, 2.2]} geometry={c.unitBoxGeo} material={c.teakDarkMat} />
          {[-0.6, 0, 0.6].map(cy => (
            <mesh
              key={`corn-${cy}`}
              position={[0.15, 1.2 + cy, 0]}
              scale={[0.2, 0.35, 1.8]}
              geometry={c.unitBoxGeo}
              material={c.chinGoldMat}
            />
          ))}
        </group>
      )}

      {/* ရွာသူကြီးအိမ် အလံတိုင် (Chief House Flag Mast) */}
      {hasFlag && (
        <group position={[halfW + 1.2, 0, halfD + 1.0]}>
          <mesh position={[0, 3.2, 0]} geometry={c.flagPoleGeo} material={c.flagPoleMat} />
          <mesh position={[0.8, 5.8, 0]} scale={[1.6, 1.0, 0.02]} geometry={c.unitBoxGeo} material={c.chinGoldMat} />
        </group>
      )}

      {/* ကျေးလက်ဆေးပေးခန်း အမှတ်အသား (Clinic Red Cross) */}
      {hasClinicCross && (
        <group position={[0, height + 0.3, halfD - 0.55]}>
          <mesh scale={[1.6, 0.8, 0.1]} geometry={c.unitBoxGeo} material={c.clinicWhiteMat} />
          <mesh position={[0, 0, 0.06]} scale={[0.6, 0.2, 0.02]} geometry={c.unitBoxGeo} material={c.clinicRedMat} />
          <mesh position={[0, 0, 0.06]} scale={[0.2, 0.6, 0.02]} geometry={c.unitBoxGeo} material={c.clinicRedMat} />
        </group>
      )}

      {/* ကျောက်ခေါင်းတိုင် (Stone Fireplace Chimney) */}
      {hasChimney && (
        <mesh
          position={[halfW - 0.8, height + 1.2, -0.6]}
          scale={[1.1, 3.2, 1.1]}
          geometry={c.unitBoxGeo}
          material={c.stoneChimneyMat}
          castShadow
        />
      )}
    </group>
  );
}

export interface ChinHouseBatchItem {
  id: string;
  x: number;
  z: number;
  baseY: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  wallColor: string;
  roofColor: string;
  hornbillScale?: number;
  terraceWidth?: number;
  terraceDepth?: number;
  compound?: ChinCompoundBounds;
  isChiefHouse?: boolean;
  isClinic?: boolean;
}

/**
 * High-performance Instanced Chin Traditional House Batch (`<ChinTraditionalHouseBatch>`)
 *
 * Renders dozens or hundreds of stepped hillside Chin Traditional Houses using ONE shared
 * Singleton Memory Reference Cache (`getChinHouseAssetCache()`) — preserving full cultural
 * architectural details on EVERY SINGLE house:
 *  - Deep hillside stone retaining pier + walkable terrace bench & front village lane
 *  - Timber foundation stilts, warm tinted walls, Chin woven geometric diamond eaves frieze
 *  - Carved Chin Mithun horn gable emblem (or Clinic Red Cross)
 *  - 3-tier pitched Chin mountain roof
 *  - Full 3D sculpted Great Hornbill (`အောက်ချင်းငှက်`) perched proudly on every rooftop
 *  - Walkable front veranda, timber railing, orchid flower boxes, windows & entrance ramp
 */
export function ChinTraditionalHouseBatch({
  houses,
  name = 'chin-traditional-house-batch',
  walkableGroupRef,
  flatGround = false,
  showCompoundFence = false,
  omitStaticDoorLeaves = false,
}: {
  houses: readonly ChinHouseBatchItem[];
  name?: string;
  walkableGroupRef?: RefObject<Group | null>;
  /** Set true for flat valley villages (no 28m hillside retaining walls or terraced street lanes). */
  flatGround?: boolean;
  /** Set true to add Farmhouse-style compound grass yards, wire mesh fences & blue front sheet gates. */
  showCompoundFence?: boolean;
  /**
   * Set true inside snapshotted regions (`StreamedWorld` RegionBuilder) where `<ChinVillageBots>`
   * renders the live animated attached double doors inside each house's door frame — ensuring
   * strictly ONE attached front door per house!
   */
  omitStaticDoorLeaves?: boolean;
}) {
  const c = getChinHouseAssetCache();
  const n = houses.length;

  // Non-walkable structural & decorative instanced layers
  const retainingRef = useRef<InstancedMesh>(null);
  const postsRef = useRef<InstancedMesh>(null);
  const wallsRef = useRef<InstancedMesh>(null);
  const friezeRef = useRef<InstancedMesh>(null);
  const roofsRef = useRef<InstancedMesh>(null);
  const windowsRef = useRef<InstancedMesh>(null);
  const doorBackdropRef = useRef<InstancedMesh>(null);
  const doorFrameRef = useRef<InstancedMesh>(null);
  const doorLeafRef = useRef<InstancedMesh>(null);
  const doorHandleRef = useRef<InstancedMesh>(null);
  const welcomeMatRef = useRef<InstancedMesh>(null);
  const stepRampRef = useRef<InstancedMesh>(null);
  const lastDoorOpenRef = useRef<Float32Array>(new Float32Array(0));
  const doorScratch = useMemo(
    () => ({
      parentM: new Matrix4(),
      hingeM: new Matrix4(),
      localM: new Matrix4(),
      finalM: new Matrix4(),
      pos: new Vector3(),
      quat: new Quaternion(),
      scl: new Vector3(),
      euler: new Euler(),
    }),
    [],
  );
  const railingRef = useRef<InstancedMesh>(null);
  const flowerBoxRef = useRef<InstancedMesh>(null);
  const bloomRef = useRef<InstancedMesh>(null);
  const mithunShieldRef = useRef<InstancedMesh>(null);
  const mithunHornRef = useRef<InstancedMesh>(null);
  // Farmhouse-style Compound Yard & Fences (when showCompoundFence=true)
  const yardLawnRef = useRef<InstancedMesh>(null);
  const wireMeshRef = useRef<InstancedMesh>(null);
  const fenceSteelRef = useRef<InstancedMesh>(null);
  const blueFenceRef = useRef<InstancedMesh>(null);
  const blueCapRef = useRef<InstancedMesh>(null);
  // Hornbill (အောက်ချင်းငှက်) instanced layers — every single house has a sculpted Hornbill atop its roof!
  const hbPerchBaseRef = useRef<InstancedMesh>(null);
  const hbPerchTrimRef = useRef<InstancedMesh>(null);
  const hbPerchPostRef = useRef<InstancedMesh>(null);
  const hbBodyRef = useRef<InstancedMesh>(null);
  const hbNeckRef = useRef<InstancedMesh>(null);
  const hbHeadRef = useRef<InstancedMesh>(null);
  const hbCasqueRef = useRef<InstancedMesh>(null);
  const hbBeakUpperRef = useRef<InstancedMesh>(null);
  const hbBeakLowerRef = useRef<InstancedMesh>(null);
  const hbWingRef = useRef<InstancedMesh>(null);
  const hbWingTipRef = useRef<InstancedMesh>(null);
  const hbTailRef = useRef<InstancedMesh>(null);
  const hbTailBandRef = useRef<InstancedMesh>(null);

  // Walkable terrace decks, front lanes & verandas (mounted inside walkableGroupRef for ground raycasts)
  const terraceDeckRef = useRef<InstancedMesh>(null);
  const terraceLaneRef = useRef<InstancedMesh>(null);
  const verandaDeckRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (n === 0) return;

    const parentM = new Matrix4();
    const hbRootM = new Matrix4();
    const wingRootM = new Matrix4();
    const tailRootM = new Matrix4();
    const localM = new Matrix4();
    const finalM = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3();
    const euler = new Euler();
    const color = new Color();

    const setPart = (
      mesh: InstancedMesh | null,
      idx: number,
      base: Matrix4,
      lx: number,
      ly: number,
      lz: number,
      rx: number,
      ry: number,
      rz: number,
      sx: number,
      sy: number,
      sz: number,
      tint?: string,
    ) => {
      if (!mesh) return;
      quat.setFromEuler(euler.set(rx, ry, rz));
      localM.compose(pos.set(lx, ly, lz), quat, scl.set(sx, sy, sz));
      finalM.multiplyMatrices(base, localM);
      mesh.setMatrixAt(idx, finalM);
      if (tint) mesh.setColorAt(idx, color.set(tint));
    };

    let postIdx = 0;
    let roofIdx = 0;
    let winIdx = 0;
    let doorFrameIdx = 0;
    let doorLeafIdx = 0;
    let doorHandleIdx = 0;
    let railIdx = 0;
    let fboxIdx = 0;
    let bloomIdx = 0;
    let hornIdx = 0;
    let wingIdx = 0;
    let wireIdx = 0;
    let steelIdx = 0;
    let blueIdx = 0;
    let blueCapIdx = 0;

    for (let i = 0; i < n; i++) {
      const h = houses[i];
      const halfW = h.width / 2;
      const halfD = h.depth / 2;
      const tW = h.terraceWidth ?? h.width + 6.0;
      const tD = h.terraceDepth ?? h.depth + 5.2;
      const hbScale = h.hornbillScale ?? 1.08;

      quat.setFromEuler(euler.set(0, h.rotation, 0));
      parentM.compose(pos.set(h.x, h.baseY, h.z), quat, scl.set(1, 1, 1));

      // 1. Foundation: either flat valley stone plinth (flatGround) OR deep hillside retaining terrace
      if (flatGround) {
        setPart(terraceDeckRef.current, i, parentM, 0, 0.12, 0.1, 0, 0, 0, h.width + 0.9, 0.24, h.depth + 0.9);
      } else {
        setPart(retainingRef.current, i, parentM, 0, -14.0, 0.4, 0, 0, 0, tW + 0.6, 28.0, tD + 0.6);
        setPart(terraceDeckRef.current, i, parentM, 0, -0.02, 0.4, 0, 0, 0, tW, 0.34, tD);
        setPart(terraceLaneRef.current, i, parentM, 0, 0.17, halfD + 1.65, 0, 0, 0, tW + 0.2, 0.1, 2.5);
      }

      // 3. Timber foundation stilts (6 posts per house)
      for (const px of [-halfW + 0.6, 0, halfW - 0.6]) {
        for (const pz of [-halfD + 0.6, halfD + 0.4]) {
          setPart(postsRef.current, postIdx++, parentM, px, 0.6, pz, 0, 0, 0, 1, 1, 1);
        }
      }

      // 4. Main timber house living quarters walls (tinted per house)
      setPart(
        wallsRef.current,
        i,
        parentM,
        0,
        h.height / 2 + 0.8,
        -0.6,
        0,
        0,
        0,
        h.width,
        h.height,
        h.depth - 2.4,
        h.wallColor,
      );

      // 5. Traditional Chin woven geometric diamond eaves frieze
      const frontWallZ = -0.6 + (h.depth - 2.4) / 2;
      setPart(
        friezeRef.current,
        i,
        parentM,
        0,
        h.height + 0.56,
        frontWallZ + 0.06,
        0,
        0,
        0,
        h.width + 0.12,
        0.54,
        0.08,
      );

      // 6. Traditional Chin Mithun horn gable emblem (hidden via zero-scale on clinic)
      const mithunS = h.isClinic ? 0 : 1;
      setPart(
        mithunShieldRef.current,
        i,
        parentM,
        0,
        h.height + 0.08,
        frontWallZ + 0.08,
        0,
        0,
        0,
        mithunS,
        mithunS,
        mithunS,
      );
      for (const side of [-1, 1] as const) {
        setPart(
          mithunHornRef.current,
          hornIdx++,
          parentM,
          side * 0.24,
          h.height + 0.2,
          frontWallZ + 0.14,
          0,
          0,
          side < 0 ? Math.PI * 0.22 : -Math.PI * 0.98,
          mithunS,
          mithunS,
          mithunS,
        );
      }

      // 7. 3-Tier pitched Chin mountain roofs (tinted per house)
      const roofBaseY = h.height + 1.2;
      setPart(
        roofsRef.current,
        roofIdx++,
        parentM,
        0,
        roofBaseY + 0.45,
        -0.6,
        0,
        0,
        0,
        h.width + 1.6,
        0.35,
        h.depth - 1.2,
        h.roofColor,
      );
      setPart(
        roofsRef.current,
        roofIdx++,
        parentM,
        0,
        roofBaseY + 0.95,
        -0.6,
        0,
        0,
        0,
        h.width * 0.75,
        0.65,
        h.depth * 0.65,
        h.roofColor,
      );
      setPart(
        roofsRef.current,
        roofIdx++,
        parentM,
        0,
        roofBaseY + 1.45,
        -0.6,
        0,
        0,
        0,
        h.width * 0.45,
        0.45,
        h.depth * 0.4,
        h.roofColor,
      );

      // 8. Sculpted 3D Great Hornbill (အောက်ချင်းငှက်) perched proudly atop every roof ridge!
      quat.identity();
      localM.compose(pos.set(0, roofBaseY + 1.68, -0.45), quat, scl.set(hbScale, hbScale, hbScale));
      hbRootM.multiplyMatrices(parentM, localM);

      setPart(hbPerchBaseRef.current, i, hbRootM, 0, 0.11, 0, 0, 0, 0, 1, 1, 1);
      setPart(hbPerchTrimRef.current, i, hbRootM, 0, 0.25, 0, 0, 0, 0, 1.05, 0.08, 0.34);
      setPart(hbPerchPostRef.current, i, hbRootM, 0, 0.48, 0, 0, 0, 0, 1, 1, 1);

      // Hornbill body shifted up by +0.92 inside hbRootM
      setPart(hbBodyRef.current, i, hbRootM, 0, 0.92, -0.04, 0, 0, 0, 0.82, 0.78, 1.32);
      setPart(hbNeckRef.current, i, hbRootM, 0, 1.14, 0.2, 0.38, 0, 0, 1, 1, 1);
      setPart(hbHeadRef.current, i, hbRootM, 0, 1.31, 0.3, 0, 0, 0, 1, 1, 1);
      setPart(hbCasqueRef.current, i, hbRootM, 0, 1.43, 0.42, 0.16, 0, 0, 1, 1, 1);
      setPart(hbBeakUpperRef.current, i, hbRootM, 0, 1.31, 0.68, Math.PI / 2 + 0.2, 0, 0, 1, 1, 1);
      setPart(hbBeakLowerRef.current, i, hbRootM, 0, 1.24, 0.6, Math.PI / 2 + 0.14, 0, 0, 1, 1, 1);

      for (const side of [-1, 1] as const) {
        quat.setFromEuler(euler.set(0.14, -side * 0.18, side * 0.34));
        localM.compose(pos.set(side * 0.56, 1.04, -0.02), quat, scl.set(1, 1, 1));
        wingRootM.multiplyMatrices(hbRootM, localM);
        setPart(hbWingRef.current, wingIdx, wingRootM, 0, 0, 0, 0, 0, 0, 1, 1, 1);
        setPart(hbWingTipRef.current, wingIdx, wingRootM, side * 0.32, -0.01, -0.14, 0, 0, 0, 1, 1, 1);
        wingIdx++;
      }

      quat.setFromEuler(euler.set(-0.42, 0, 0));
      localM.compose(pos.set(0, 0.76, -0.58), quat, scl.set(1, 1, 1));
      tailRootM.multiplyMatrices(hbRootM, localM);
      setPart(hbTailRef.current, i, tailRootM, 0, 0, 0, 0, 0, 0, 1, 1, 1);
      setPart(hbTailBandRef.current, i, tailRootM, 0, 0, -0.16, 0, 0, 0, 1, 1, 1);

      // 9. Windows with wooden shutters (2 per house) + Farmhouse-style Double Teak Front Door & Mat
      for (const wx of [-halfW + 1.4, halfW - 1.4]) {
        setPart(
          windowsRef.current,
          winIdx++,
          parentM,
          wx,
          h.height * 0.55 + 0.8,
          frontWallZ + 0.05,
          0,
          0,
          0,
          1.3,
          1.3,
          0.1,
        );
      }

      // Double Teak Front Door Interior Recess + Frame (left jamb, right jamb, top lintel)
      setPart(doorBackdropRef.current, i, parentM, 0, 2.01, frontWallZ + 0.015, 0, 0, 0, 1.66, 2.28, 0.04);
      setPart(doorFrameRef.current, doorFrameIdx++, parentM, -0.92, 2.03, frontWallZ + 0.04, 0, 0, 0, 0.14, 2.36, 0.2);
      setPart(doorFrameRef.current, doorFrameIdx++, parentM, 0.92, 2.03, frontWallZ + 0.04, 0, 0, 0, 0.14, 2.36, 0.2);
      setPart(doorFrameRef.current, doorFrameIdx++, parentM, 0, 3.23, frontWallZ + 0.04, 0, 0, 0, 1.98, 0.16, 0.22);
      // Double Teak Door Leaves + Golden Brass Handles (omitted when live `<ChinVillageBots>` owns the hinged leaves)
      if (!omitStaticDoorLeaves) {
        setPart(doorLeafRef.current, doorLeafIdx++, parentM, -0.42, 2.01, frontWallZ + 0.05, 0, 0, 0, 0.8, 2.26, 0.08);
        setPart(doorLeafRef.current, doorLeafIdx++, parentM, 0.42, 2.01, frontWallZ + 0.05, 0, 0, 0, 0.8, 2.26, 0.08);
        setPart(doorHandleRef.current, doorHandleIdx++, parentM, -0.14, 1.97, frontWallZ + 0.11, 0, 0, 0, 0.06, 0.24, 0.06);
        setPart(doorHandleRef.current, doorHandleIdx++, parentM, 0.14, 1.97, frontWallZ + 0.11, 0, 0, 0, 0.06, 0.24, 0.06);
      }
      setPart(welcomeMatRef.current, i, parentM, 0, 0.87, frontWallZ + 0.56, 0, 0, 0, 1.4, 0.03, 0.7);

      // 10. Walkable Front Veranda Deck + Step Ramp + Railing + Orchid Flower Boxes
      setPart(verandaDeckRef.current, i, parentM, 0, 0.75, halfD - 1.1, 0, 0, 0, h.width + 0.6, 0.2, 2.6);
      setPart(stepRampRef.current, i, parentM, 0, 0.4, halfD + 0.55, 0, 0, 0, 2.4, 0.35, 0.8);
      // Leave open center entry gap in front veranda railing so the door & steps connect cleanly!
      const sideRailW = Math.max(1.2, (h.width + 0.6 - 2.4) / 2);
      const sideRailX = 1.2 + sideRailW / 2;
      setPart(railingRef.current, railIdx++, parentM, -sideRailX, 1.35, halfD + 0.15, 0, 0, 0, sideRailW, 0.1, 0.12);
      setPart(railingRef.current, railIdx++, parentM, sideRailX, 1.35, halfD + 0.15, 0, 0, 0, sideRailW, 0.1, 0.12);
      for (const rx of [-halfW + 0.2, -1.2, 1.2, halfW - 0.2]) {
        setPart(railingRef.current, railIdx++, parentM, rx, 1.05, halfD + 0.15, 0, 0, 0, 0.14, 0.6, 0.14);
      }
      for (const fx of [-halfW + 1.0, halfW - 1.0]) {
        setPart(flowerBoxRef.current, fboxIdx++, parentM, fx, 1.45, halfD + 0.15, 0, 0, 0, 1.4, 0.25, 0.3);
        setPart(bloomRef.current, bloomIdx++, parentM, fx, 1.7, halfD + 0.15, 0, 0, 0, 1.1, 0.9, 1.1);
      }

      // 11. Spacious Farmhouse-style Compound Yard, Wire Mesh Fences & Blue Front Sheet Fence + Open Gate
      if (showCompoundFence) {
        const bounds = h.compound ?? defaultChinCompoundBounds(h.width, h.depth);
        const sideHalf = bounds.sideHalf;
        const backHalf = bounds.backHalf;
        const frontHalf = bounds.frontHalf;
        const fenceW = sideHalf * 2;
        const fenceD = backHalf + frontHalf;
        const centerZ = (frontHalf - backHalf) / 2;
        const gateHalf = 1.5; // Wide 3.0m open front entrance gate
        const wingLen = Math.max(0.8, sideHalf - gateHalf);
        const wingCenter = gateHalf + wingLen / 2;

        // Compound green lawn pad cleanly seated above village soil (y=0.022, below lanes y=0.08)
        setPart(yardLawnRef.current, i, parentM, 0, 0.022, centerZ, 0, 0, 0, fenceW - 0.12, 0.024, fenceD - 0.12);

        // Left, Right, Back translucent galvanized Wire Mesh panels (3 per house)
        setPart(wireMeshRef.current, wireIdx++, parentM, -sideHalf, 0.8, centerZ, 0, Math.PI / 2, 0, fenceD, 1.32, 0.03);
        setPart(wireMeshRef.current, wireIdx++, parentM, sideHalf, 0.8, centerZ, 0, Math.PI / 2, 0, fenceD, 1.32, 0.03);
        setPart(wireMeshRef.current, wireIdx++, parentM, 0, 0.8, -backHalf, 0, 0, 0, fenceW, 1.32, 0.03);

        // Wire mesh top rails (3) + corner/mid fence posts (6) + 2 front steel gate posts = 11 steel pieces
        setPart(fenceSteelRef.current, steelIdx++, parentM, -sideHalf, 1.48, centerZ, 0, Math.PI / 2, 0, fenceD, 0.07, 0.07);
        setPart(fenceSteelRef.current, steelIdx++, parentM, sideHalf, 1.48, centerZ, 0, Math.PI / 2, 0, fenceD, 0.07, 0.07);
        setPart(fenceSteelRef.current, steelIdx++, parentM, 0, 1.48, -backHalf, 0, 0, 0, fenceW, 0.07, 0.07);
        setPart(fenceSteelRef.current, steelIdx++, parentM, -sideHalf, 0.78, -backHalf, 0, 0, 0, 0.12, 1.56, 0.12);
        setPart(fenceSteelRef.current, steelIdx++, parentM, sideHalf, 0.78, -backHalf, 0, 0, 0, 0.12, 1.56, 0.12);
        setPart(fenceSteelRef.current, steelIdx++, parentM, -sideHalf, 0.78, centerZ, 0, 0, 0, 0.1, 1.56, 0.1);
        setPart(fenceSteelRef.current, steelIdx++, parentM, sideHalf, 0.78, centerZ, 0, 0, 0, 0.1, 1.56, 0.1);
        setPart(fenceSteelRef.current, steelIdx++, parentM, -sideHalf, 0.78, frontHalf, 0, 0, 0, 0.12, 1.56, 0.12);
        setPart(fenceSteelRef.current, steelIdx++, parentM, sideHalf, 0.78, frontHalf, 0, 0, 0, 0.12, 1.56, 0.12);
        // Front entrance gate posts
        setPart(fenceSteelRef.current, steelIdx++, parentM, -gateHalf, 0.98, frontHalf, 0, 0, 0, 0.18, 1.96, 0.18);
        setPart(fenceSteelRef.current, steelIdx++, parentM, gateHalf, 0.98, frontHalf, 0, 0, 0, 0.18, 1.96, 0.18);

        // Front Farmhouse Blue Sheet Fence wings (2) + 2 Open Gate Leaves swung inward = 4 blue sheet panels
        setPart(blueFenceRef.current, blueIdx++, parentM, -wingCenter, 0.915, frontHalf, 0, 0, 0, wingLen, 1.83, 0.06);
        setPart(blueFenceRef.current, blueIdx++, parentM, wingCenter, 0.915, frontHalf, 0, 0, 0, wingLen, 1.83, 0.06);
        // Open double gate leaves swung inward into the spacious front yard
        setPart(blueFenceRef.current, blueIdx++, parentM, -gateHalf + 0.3, 0.88, frontHalf - 0.68, 0, 1.15, 0, 1.38, 1.72, 0.05);
        setPart(blueFenceRef.current, blueIdx++, parentM, gateHalf - 0.3, 0.88, frontHalf - 0.68, 0, -1.15, 0, 1.38, 1.72, 0.05);

        // Dark Blue Top Caps on front fence wings (2) + Gate Post Caps (2) = 4 caps
        setPart(blueCapRef.current, blueCapIdx++, parentM, -wingCenter, 1.84, frontHalf, 0, 0, 0, wingLen + 0.04, 0.06, 0.1);
        setPart(blueCapRef.current, blueCapIdx++, parentM, wingCenter, 1.84, frontHalf, 0, 0, 0, wingLen + 0.04, 0.06, 0.1);
        setPart(blueCapRef.current, blueCapIdx++, parentM, -gateHalf, 1.98, frontHalf, 0, 0, 0, 0.24, 0.06, 0.24);
        setPart(blueCapRef.current, blueCapIdx++, parentM, gateHalf, 1.98, frontHalf, 0, 0, 0, 0.24, 0.06, 0.24);
      }
    }

    lastDoorOpenRef.current = new Float32Array(n);

    const allMeshes = [
      retainingRef.current,
      terraceDeckRef.current,
      terraceLaneRef.current,
      verandaDeckRef.current,
      postsRef.current,
      wallsRef.current,
      friezeRef.current,
      roofsRef.current,
      windowsRef.current,
      doorBackdropRef.current,
      doorFrameRef.current,
      doorLeafRef.current,
      doorHandleRef.current,
      welcomeMatRef.current,
      stepRampRef.current,
      railingRef.current,
      flowerBoxRef.current,
      bloomRef.current,
      mithunShieldRef.current,
      mithunHornRef.current,
      yardLawnRef.current,
      wireMeshRef.current,
      fenceSteelRef.current,
      blueFenceRef.current,
      blueCapRef.current,
      hbPerchBaseRef.current,
      hbPerchTrimRef.current,
      hbPerchPostRef.current,
      hbBodyRef.current,
      hbNeckRef.current,
      hbHeadRef.current,
      hbCasqueRef.current,
      hbBeakUpperRef.current,
      hbBeakLowerRef.current,
      hbWingRef.current,
      hbWingTipRef.current,
      hbTailRef.current,
      hbTailBandRef.current,
    ];
    for (const m of allMeshes) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      m.computeBoundingBox();
    }
  }, [flatGround, houses, n, omitStaticDoorLeaves, showCompoundFence]);

  // Smoothly animate each house's OWN attached double front door when `chinHouseDoorOpen` changes
  // (skipped when `omitStaticDoorLeaves` delegates live hinged doors to `<ChinVillageBots>`)
  useFrame(() => {
    if (omitStaticDoorLeaves) return;
    const leafMesh = doorLeafRef.current;
    const handleMesh = doorHandleRef.current;
    if (!leafMesh || !handleMesh || n === 0) return;

    const last = lastDoorOpenRef.current;
    if (last.length !== n) return;

    let dirty = false;
    const { parentM, hingeM, localM, finalM, pos, quat, scl, euler } = doorScratch;

    for (let i = 0; i < n; i++) {
      const h = houses[i];
      const open = getChinHouseDoorOpen(h.id);
      if (Math.abs(open - last[i]) < 0.002) continue;
      last[i] = open;
      dirty = true;

      const frontWallZ = -0.6 + (h.depth - 2.4) / 2;
      quat.setFromEuler(euler.set(0, h.rotation, 0));
      parentM.compose(pos.set(h.x, h.baseY, h.z), quat, scl.set(1, 1, 1));

      const swingAngle = open * 1.42;
      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const side = sideIdx === 0 ? -1 : 1; // -1 = left hinge (-0.82), +1 = right hinge (+0.82)
        // Left door swings outward (-angle around Y), right door swings outward (+angle around Y)
        quat.setFromEuler(euler.set(0, side * swingAngle, 0));
        localM.compose(pos.set(side * 0.82, 2.01, frontWallZ + 0.05), quat, scl.set(1, 1, 1));
        hingeM.multiplyMatrices(parentM, localM);

        // Door leaf extends 0.40m inward from its outer hinge toward center
        quat.identity();
        localM.compose(pos.set(-side * 0.4, 0, 0), quat, scl.set(0.8, 2.26, 0.08));
        finalM.multiplyMatrices(hingeM, localM);
        leafMesh.setMatrixAt(i * 2 + sideIdx, finalM);

        // Brass handle stays mounted near the inner edge of the swinging leaf
        localM.compose(pos.set(-side * 0.68, -0.04, 0.06), quat, scl.set(0.06, 0.24, 0.06));
        finalM.multiplyMatrices(hingeM, localM);
        handleMesh.setMatrixAt(i * 2 + sideIdx, finalM);
      }
    }

    if (dirty) {
      leafMesh.instanceMatrix.needsUpdate = true;
      handleMesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (n === 0) return null;

  return (
    <group name={name}>
      {/* Walkable foundation/terrace benches, optional terraced village lanes & front verandas */}
      <group ref={walkableGroupRef} name={`${name}-walkable`}>
        <instancedMesh
          ref={terraceDeckRef}
          args={[c.unitBoxGeo, c.terraceDeckMat, n]}
          receiveShadow
          userData={{ walkable: true }}
        />
        {!flatGround && (
          <instancedMesh
            ref={terraceLaneRef}
            args={[c.unitBoxGeo, c.terraceLaneMat, n]}
            receiveShadow
            userData={{ walkable: true }}
          />
        )}
        <instancedMesh
          ref={verandaDeckRef}
          args={[c.unitBoxGeo, c.verandaDeckMat, n]}
          receiveShadow
          userData={{ walkable: true }}
        />
      </group>

      {/* Deep hillside retaining piers (terraced mountain slopes only) */}
      {!flatGround && (
        <instancedMesh ref={retainingRef} args={[c.unitBoxGeo, c.retainingWallMat, n]} />
      )}

      {/* Timber house structure, Chin woven diamond frieze, Mithun emblems & 3-tier roofs */}
      <instancedMesh ref={postsRef} args={[c.postGeo, c.teakDarkMat, n * 6]} />
      <instancedMesh
        ref={wallsRef}
        args={[c.unitBoxGeo, c.instancedWallMat, n]}
        castShadow={!mobileQuality}
        receiveShadow
      />
      <instancedMesh ref={friezeRef} args={[c.unitBoxGeo, c.chinFriezeMat, n]} />
      <instancedMesh
        ref={roofsRef}
        args={[c.unitBoxGeo, c.instancedRoofMat, n * 3]}
        castShadow={!mobileQuality}
      />
      <instancedMesh ref={windowsRef} args={[c.unitBoxGeo, c.windowDarkMat, n * 2]} />
      <instancedMesh ref={doorBackdropRef} args={[c.unitBoxGeo, c.windowDarkMat, n]} />
      <instancedMesh ref={doorFrameRef} args={[c.unitBoxGeo, c.doorFrameMat, n * 3]} />
      {!omitStaticDoorLeaves && (
        <>
          <instancedMesh ref={doorLeafRef} args={[c.unitBoxGeo, c.doorLeafMat, n * 2]} />
          <instancedMesh ref={doorHandleRef} args={[c.unitBoxGeo, c.chinGoldMat, n * 2]} />
        </>
      )}
      <instancedMesh ref={welcomeMatRef} args={[c.unitBoxGeo, c.welcomeMatMat, n]} />
      <instancedMesh ref={stepRampRef} args={[c.unitBoxGeo, c.stepRampMat, n]} receiveShadow />
      <instancedMesh ref={railingRef} args={[c.unitBoxGeo, c.teakDarkMat, n * 6]} />
      <instancedMesh ref={flowerBoxRef} args={[c.unitBoxGeo, c.timberMidMat, n * 2]} />
      <instancedMesh ref={bloomRef} args={[c.flowerBloomGeo, c.bloomPinkMat, n * 2]} />
      <instancedMesh ref={mithunShieldRef} args={[c.mithunShieldGeo, c.chinCrimsonMat, n]} />
      <instancedMesh ref={mithunHornRef} args={[c.mithunHornGeo, c.mithunHornMat, n * 2]} />

      {/* Farmhouse-style Compound Grass Yard, Wire Mesh Fences & Blue Front Sheet Gates */}
      {showCompoundFence && (
        <>
          <instancedMesh ref={yardLawnRef} args={[c.unitBoxGeo, c.yardLawnMat, n]} receiveShadow />
          <instancedMesh ref={wireMeshRef} args={[c.unitBoxGeo, c.wireMeshMat, n * 3]} />
          <instancedMesh ref={fenceSteelRef} args={[c.unitBoxGeo, c.fenceSteelMat, n * 11]} />
          <instancedMesh
            ref={blueFenceRef}
            args={[c.unitBoxGeo, c.blueFenceMat, n * 4]}
            castShadow={!mobileQuality}
            receiveShadow
          />
          <instancedMesh ref={blueCapRef} args={[c.unitBoxGeo, c.blueFenceCapMat, n * 4]} />
        </>
      )}

      {/* Sculpted 3D Great Hornbill (အောက်ချင်းငှက်) on EVERY house rooftop */}
      <instancedMesh ref={hbPerchBaseRef} args={[c.perchBaseGeo, c.teakDarkMat, n]} />
      <instancedMesh ref={hbPerchTrimRef} args={[c.unitBoxGeo, c.chinCrimsonMat, n]} />
      <instancedMesh ref={hbPerchPostRef} args={[c.perchPostGeo, c.teakDarkMat, n]} />
      <instancedMesh ref={hbBodyRef} args={[c.hornbillBodyGeo, c.hornbillBlackMat, n]} />
      <instancedMesh ref={hbNeckRef} args={[c.hornbillNeckGeo, c.hornbillWhiteMat, n]} />
      <instancedMesh ref={hbHeadRef} args={[c.hornbillHeadGeo, c.hornbillBlackMat, n]} />
      <instancedMesh ref={hbCasqueRef} args={[c.hornbillCasqueGeo, c.hornbillCasqueOrangeMat, n]} />
      <instancedMesh ref={hbBeakUpperRef} args={[c.hornbillBeakUpperGeo, c.hornbillBeakGoldMat, n]} />
      <instancedMesh ref={hbBeakLowerRef} args={[c.hornbillBeakLowerGeo, c.hornbillBeakGoldMat, n]} />
      <instancedMesh ref={hbWingRef} args={[c.hornbillWingGeo, c.hornbillBlackMat, n * 2]} />
      <instancedMesh ref={hbWingTipRef} args={[c.hornbillWingTipGeo, c.hornbillWhiteMat, n * 2]} />
      <instancedMesh ref={hbTailRef} args={[c.hornbillTailGeo, c.hornbillWhiteMat, n]} />
      <instancedMesh ref={hbTailBandRef} args={[c.hornbillTailBandGeo, c.hornbillBlackMat, n]} />

      {/* Special landmark accents: Chief's House Flag & Clinic Red Cross */}
      {houses.map(h =>
        h.isChiefHouse ? (
          <group
            key={`chief-flag-${h.id}`}
            position={[h.x, h.baseY, h.z]}
            rotation={[0, h.rotation, 0]}
          >
            <mesh position={[h.width / 2 + 1.2, 3.2, h.depth / 2 + 0.9]} geometry={c.flagPoleGeo} material={c.flagPoleMat} />
            <mesh
              position={[h.width / 2 + 2.0, 5.8, h.depth / 2 + 0.9]}
              scale={[1.6, 1.0, 0.02]}
              geometry={c.unitBoxGeo}
              material={c.chinGoldMat}
            />
          </group>
        ) : h.isClinic ? (
          <group
            key={`clinic-cross-${h.id}`}
            position={[h.x, h.baseY, h.z]}
            rotation={[0, h.rotation, 0]}
          >
            <group position={[0, h.height + 0.3, h.depth / 2 - 0.55]}>
              <mesh scale={[1.6, 0.8, 0.1]} geometry={c.unitBoxGeo} material={c.clinicWhiteMat} />
              <mesh position={[0, 0, 0.06]} scale={[0.6, 0.2, 0.02]} geometry={c.unitBoxGeo} material={c.clinicRedMat} />
              <mesh position={[0, 0, 0.06]} scale={[0.2, 0.6, 0.02]} geometry={c.unitBoxGeo} material={c.clinicRedMat} />
            </group>
          </group>
        ) : null,
      )}
    </group>
  );
}
