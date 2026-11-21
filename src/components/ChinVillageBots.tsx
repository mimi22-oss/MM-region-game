import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { npcFaceGeometry, npcFaceMaterial, npcHandGeometry } from '../game/npcAnatomy';
import { tharYarGoneVillage } from '../data/villages/tharyargone';
import { kyarInnVillage } from '../data/villages/kyarinn';
import { houseVisualRotation } from './House';
import { mobileQuality } from '../game/sceneBudget';
import { useQualityPreset } from '../game/qualityPreset';
import { sourceIsEdited } from '../game/worldEdits';
import type { TimeMode } from '../game/environmentTime';
import { canStand } from '../game/collision';
import {
  applyBotAvoidanceStep,
  removeAvoidanceActor,
  upsertAvoidanceActor,
} from '../game/botAvoidance';
import { buildRoadGraph, type RouteNode } from '../game/robotRoutes';
import { trafficColliders } from '../game/trafficColliders';
import {
  disengageBotFight,
  getBotCombatReaction,
  getBotFightingState,
  isBotInCombat,
} from '../game/botFighting';
import { applyChinBotCombatPose, chinKindToNpcRole } from '../game/chinCombatPose';
import {
  createStreetPedestrianStates,
  desiredPedestrianCount,
  isDaytimeLivingHours,
  pickNearbyRoadNode,
  placePedestrianOnGraph,
  stepStreetPedestrian,
  type StreetPedestrianProfile,
  type StreetPedestrianState,
} from '../game/villageCrowd';
import { getChinHouseAssetCache } from '../game/chinHouseAssets';
import { getWeipulaVillagerCache, type WeipulaVillagerKind } from '../game/weipulaVillagers';
import {
  ChinVillagerFixedPoolController,
  defaultChinCompoundBounds,
  type ChinHouseholdHouseInput,
} from '../game/chinVillagerPool';

/**
 * ============================================================================
 * LIVE Chin Village Population & Attached-Door Controller (`<ChinVillageBots>`)
 * ============================================================================
 *
 * Mounted directly inside `StreamedWorld.tsx` (alongside `HouseResidentBots` &
 * `VillagePedestrianBots`) so it runs LIVE — never frozen or unmounted by
 * `RegionBuilder`'s `snapshotRegion()`!
 *
 * Strictly uses:
 * - **Singleton Memory Reference Cache** (`getWeipulaVillagerCache()` + `getChinHouseAssetCache()`)
 *   → ZERO duplicate BufferGeometries, CanvasTextures, or Materials!
 * - **Fixed Object Pool**:
 *   1. Household Chin Residents Pool (`64` desktop / `36` mobile fixed slots):
 *      Covers 1 to 10 random Chin ethnic residents per Chin house (some solo, some 10-person families!)
 *      walking in/out of their attached front doors, relaxing on verandas, strolling spacious yards,
 *      and stepping out through their front gates during daytime!
 *   2. Chin Street Pedestrians Pool (`28` desktop / `14` mobile fixed slots):
 *      Walks along REAL connected Tharyargone roads (`buildRoadGraph`) during morning/day/evening
 *      and returns home at night — matching Myothar Area 5's exact daytime living rhythm!
 *   3. Attached Hinged Double-Door Pool (`36` desktop / `18` mobile fixed slots):
 *      Mounts ONE flush attached double teak front door right inside each nearby Chin house's
 *      door frame (`frontWallZ + 0.05`) and swings it open smoothly when residents enter/exit
 *      or when the player approaches the porch!
 */

const HOUSE_POOL_DESKTOP = 64;
const HOUSE_POOL_MOBILE = 36;
const STREET_POOL_DESKTOP = 28;
const STREET_POOL_MOBILE = 14;
const DOOR_POOL_DESKTOP = 36;
const DOOR_POOL_MOBILE = 18;
const RECYCLE_DIST_SQ = 128 * 128;

interface PooledChinSlotRefs {
  root: Group | null;
  body: Group | null;
  head: Group | null;
  headMesh: Mesh | null;
  neckMesh: Mesh | null;
  hairCapMesh: Mesh | null;
  hairBunMesh: Mesh | null;
  headbandMesh: Mesh | null;
  torsoMesh: Mesh | null;
  sashMesh: Mesh | null;
  longyiMesh: Mesh | null;
  leftArm: Group | null;
  leftArmMesh: Mesh | null;
  rightArm: Group | null;
  rightArmMesh: Mesh | null;
  leftHandMesh: Mesh | null;
  rightHandMesh: Mesh | null;
  leftLeg: Group | null;
  leftLegMesh: Mesh | null;
  rightLeg: Group | null;
  rightLegMesh: Mesh | null;
  boundKey: string | null;
}

interface PooledDoorRefs {
  root: Group | null;
  leftHinge: Group | null;
  rightHinge: Group | null;
}

function emptySlotRefs(): PooledChinSlotRefs {
  return {
    root: null,
    body: null,
    head: null,
    headMesh: null,
    neckMesh: null,
    hairCapMesh: null,
    hairBunMesh: null,
    headbandMesh: null,
    torsoMesh: null,
    sashMesh: null,
    longyiMesh: null,
    leftArm: null,
    leftArmMesh: null,
    rightArm: null,
    rightArmMesh: null,
    leftHandMesh: null,
    rightHandMesh: null,
    leftLeg: null,
    leftLegMesh: null,
    rightLeg: null,
    rightLegMesh: null,
    boundKey: null,
  };
}

function emptyDoorRefs(): PooledDoorRefs {
  return { root: null, leftHinge: null, rightHinge: null };
}

function bindChinVisualMaterials(
  refs: PooledChinSlotRefs,
  bindKey: string,
  kind: Exclude<WeipulaVillagerKind, 'nurse'>,
  skinIndex: number,
  outfitIndex: number,
  scale: number,
  slotIndex = 0,
): void {
  if (refs.boundKey === bindKey) return;
  refs.boundKey = bindKey;
  const cache = getWeipulaVillagerCache();
  const skinMat = cache.skinMats[skinIndex % cache.skinMats.length];
  const isElder = kind === 'chin-elder';
  const isWoman = kind === 'chin-woman';
  const isKid = kind === 'chin-kid';
  const hairMat = isElder ? cache.hairSilverMat : cache.hairDarkMat;
  const topMat = cache.chinTopMats[outfitIndex % cache.chinTopMats.length];
  const weaveMat = cache.chinWeaveMats[outfitIndex % cache.chinWeaveMats.length];

  if (refs.headMesh) refs.headMesh.material = skinMat;
  if (refs.neckMesh) refs.neckMesh.material = skinMat;
  if (refs.leftHandMesh) refs.leftHandMesh.material = skinMat;
  if (refs.rightHandMesh) refs.rightHandMesh.material = skinMat;
  if (refs.leftLegMesh) refs.leftLegMesh.material = skinMat;
  if (refs.rightLegMesh) refs.rightLegMesh.material = skinMat;
  if (refs.hairCapMesh) refs.hairCapMesh.material = hairMat;
  if (refs.hairBunMesh) {
    refs.hairBunMesh.material = hairMat;
    refs.hairBunMesh.visible = isWoman;
  }
  if (refs.headbandMesh) refs.headbandMesh.visible = !isKid;
  if (refs.torsoMesh) refs.torsoMesh.material = topMat;
  if (refs.leftArmMesh) refs.leftArmMesh.material = topMat;
  if (refs.rightArmMesh) refs.rightArmMesh.material = topMat;
  if (refs.longyiMesh) refs.longyiMesh.material = weaveMat;
  if (refs.sashMesh) {
    refs.sashMesh.material = isElder ? cache.chinHeadbandMat : cache.chinGoldSashMat;
  }
  if (refs.root) {
    refs.root.scale.set(scale, scale, scale);
    refs.root.userData.npcRole = chinKindToNpcRole(kind, slotIndex);
  }
}

function applyChinWalkPose(
  refs: PooledChinSlotRefs,
  x: number,
  y: number,
  z: number,
  yaw: number,
  speed: number,
  walkDist: number,
  elapsed: number,
  phaseOffset: number,
): void {
  if (!refs.root) return;
  const walkFactor = Math.min(1, speed / 0.65);
  const stride = walkDist * 4.6;
  const bounce = Math.abs(Math.sin(stride)) * 0.03 * walkFactor;

  refs.root.position.set(x, y + bounce, z);
  refs.root.rotation.y = yaw;

  if (refs.head) {
    refs.head.rotation.y = Math.sin(elapsed * 0.85 + phaseOffset) * 0.24 * (1 - walkFactor * 0.6);
    refs.head.rotation.x = Math.sin(elapsed * 1.4 + phaseOffset) * 0.04;
  }
  const armSwing = Math.sin(stride) * 0.45 * walkFactor;
  if (refs.leftArm) {
    refs.leftArm.rotation.x = -armSwing;
    refs.leftArm.rotation.z = 0.08;
  }
  if (refs.rightArm) {
    refs.rightArm.rotation.x = armSwing;
    refs.rightArm.rotation.z = -0.08;
  }
  const legSwing = Math.sin(stride) * 0.36 * walkFactor;
  if (refs.leftLeg) refs.leftLeg.rotation.x = legSwing;
  if (refs.rightLeg) refs.rightLeg.rotation.x = -legSwing;
}

function ChinCharacterSlotView({
  name,
  active,
  refs,
}: {
  name: string;
  active: boolean;
  refs: PooledChinSlotRefs;
}) {
  const cache = getWeipulaVillagerCache();
  const localRootRef = useRef<Group>(null);

  // Register with the exact same `trafficColliders` map used by `ElderBotRig` / `KidBotRig` / `Player.tsx`
  // so bump-to-fight, child-protection defenders, and GLB counter-combos work automatically!
  useEffect(() => {
    const obj = localRootRef.current;
    if (!obj || !active) return;
    trafficColliders.set(obj, { width: 0.44, depth: 0.44, kind: 'robot' });
    return () => {
      trafficColliders.delete(obj);
    };
  }, [active]);

  return (
    <group
      name={name}
      visible={false}
      userData={{ dynamic: true, npcRole: 'uncle' }}
      ref={el => {
        (localRootRef as { current: Group | null }).current = el;
        refs.root = el;
      }}
    >
      <group
        ref={el => {
          refs.body = el;
        }}
      >
        <group
          position={[0, 1.56, 0]}
          ref={el => {
            refs.head = el;
          }}
        >
          <mesh ref={el => { refs.headMesh = el; }} geometry={cache.headGeo} material={cache.skinMats[0]} />
          <mesh geometry={npcFaceGeometry} material={npcFaceMaterial} />
          <mesh ref={el => { refs.hairCapMesh = el; }} position={[0, 0, 0]} geometry={cache.hairCapGeo} material={cache.hairDarkMat} />
          <mesh ref={el => { refs.hairBunMesh = el; }} position={[0, 0.04, -0.16]} geometry={cache.hairBunGeo} material={cache.hairDarkMat} visible={false} />
          <mesh ref={el => { refs.headbandMesh = el; }} position={[0, 0.06, 0]} rotation={[Math.PI / 2 - 0.14, 0, 0]} geometry={cache.chinHeadbandGeo} material={cache.chinHeadbandMat} />
        </group>
        <mesh ref={el => { refs.neckMesh = el; }} position={[0, 1.38, 0]} geometry={cache.neckGeo} material={cache.skinMats[0]} />
        <mesh ref={el => { refs.torsoMesh = el; }} position={[0, 1.11, 0]} geometry={cache.torsoGeo} material={cache.chinTopMats[0]} />
        <mesh ref={el => { refs.sashMesh = el; }} position={[0, 1.12, 0]} rotation={[0, 0, 0.42]} geometry={cache.sashGeo} material={cache.chinGoldSashMat} />
        <mesh ref={el => { refs.longyiMesh = el; }} position={[0, 0.56, 0]} geometry={cache.longyiGeo} material={cache.chinWeaveMats[0]} />
        <group position={[-0.21, 1.3, 0]} ref={el => { refs.leftArm = el; }}>
          <mesh ref={el => { refs.leftArmMesh = el; }} position={[0, 0, 0]} geometry={cache.armGeo} material={cache.chinTopMats[0]} />
          <mesh ref={el => { refs.leftHandMesh = el; }} position={[0, -0.452, 0]} geometry={npcHandGeometry} material={cache.skinMats[0]} />
        </group>
        <group position={[0.21, 1.3, 0]} ref={el => { refs.rightArm = el; }}>
          <mesh ref={el => { refs.rightArmMesh = el; }} position={[0, 0, 0]} geometry={cache.armGeo} material={cache.chinTopMats[0]} />
          <mesh ref={el => { refs.rightHandMesh = el; }} position={[0, -0.452, 0]} scale={[-1, 1, 1]} geometry={npcHandGeometry} material={cache.skinMats[0]} />
        </group>
        <group position={[-0.085, 0.54, 0]} ref={el => { refs.leftLeg = el; }}>
          <mesh ref={el => { refs.leftLegMesh = el; }} position={[0, -0.26, 0]} geometry={cache.legGeo} material={cache.skinMats[0]} />
          <mesh position={[0, -0.54, 0]} geometry={cache.shoeGeo} material={cache.shoeDarkMat} />
        </group>
        <group position={[0.085, 0.54, 0]} ref={el => { refs.rightLeg = el; }}>
          <mesh ref={el => { refs.rightLegMesh = el; }} position={[0, -0.26, 0]} geometry={cache.legGeo} material={cache.skinMats[0]} />
          <mesh position={[0, -0.54, 0]} geometry={cache.shoeGeo} material={cache.shoeDarkMat} />
        </group>
      </group>
    </group>
  );
}

/**
 * Single reusable Attached Hinged Double Teak Front Door Slot.
 * Sits flush inside the Chin house's front-wall door frame (`z = frontWallZ + 0.05`)
 * using ONLY Singleton `getChinHouseAssetCache()` geometries & materials!
 */
function AttachedChinDoorSlotView({
  slotIndex,
  refs,
}: {
  slotIndex: number;
  refs: PooledDoorRefs;
}) {
  const c = getChinHouseAssetCache();
  return (
    <group
      name={`chin-attached-door-slot-${slotIndex}`}
      visible={false}
      userData={{ dynamic: true }}
      ref={el => {
        refs.root = el;
      }}
    >
      {/* Left leaf hinged at outer edge x = -0.82 */}
      <group
        position={[-0.82, 0.88, 0]}
        ref={el => {
          refs.leftHinge = el;
        }}
      >
        <mesh position={[0.4, 1.13, 0]} scale={[0.8, 2.26, 0.08]} geometry={c.unitBoxGeo} material={c.doorLeafMat} castShadow />
        <mesh position={[0.68, 1.09, 0.06]} scale={[0.06, 0.24, 0.06]} geometry={c.unitBoxGeo} material={c.chinGoldMat} />
      </group>
      {/* Right leaf hinged at outer edge x = +0.82 */}
      <group
        position={[0.82, 0.88, 0]}
        ref={el => {
          refs.rightHinge = el;
        }}
      >
        <mesh position={[-0.4, 1.13, 0]} scale={[0.8, 2.26, 0.08]} geometry={c.unitBoxGeo} material={c.doorLeafMat} castShadow />
        <mesh position={[-0.68, 1.09, 0.06]} scale={[0.06, 0.24, 0.06]} geometry={c.unitBoxGeo} material={c.chinGoldMat} />
      </group>
    </group>
  );
}

const clearRoadPoint = (x: number, z: number) =>
  canStand(x, z) &&
  canStand(x + 0.08, z) &&
  canStand(x - 0.08, z) &&
  canStand(x, z + 0.08) &&
  canStand(x, z - 0.08);

type ChinFlatlandVillageId = 'tharyargone' | 'kyarinn';

const CHIN_FLATLAND_VILLAGES: readonly {
  readonly id: ChinFlatlandVillageId;
  readonly centerX: number;
  readonly centerZ: number;
  readonly roads: typeof tharYarGoneVillage.roads;
}[] = [
  {
    id: 'tharyargone',
    centerX: tharYarGoneVillage.x,
    centerZ: tharYarGoneVillage.z,
    roads: tharYarGoneVillage.roads,
  },
  {
    id: 'kyarinn',
    centerX: kyarInnVillage.x,
    centerZ: kyarInnVillage.z,
    roads: kyarInnVillage.roads,
  },
];

const cachedChinRoadGraphs = new Map<ChinFlatlandVillageId, RouteNode[]>();
function getChinVillageRoadGraph(villageId: ChinFlatlandVillageId): RouteNode[] {
  let graph = cachedChinRoadGraphs.get(villageId);
  if (!graph) {
    const meta = CHIN_FLATLAND_VILLAGES.find(v => v.id === villageId)!;
    graph = buildRoadGraph(meta.roads, clearRoadPoint);
    cachedChinRoadGraphs.set(villageId, graph);
  }
  return graph;
}

type ChinStreetProfile = StreetPedestrianProfile & {
  chinKind: Exclude<WeipulaVillagerKind, 'nurse'>;
};

function createChinStreetProfiles(count: number): ChinStreetProfile[] {
  const kinds: Exclude<WeipulaVillagerKind, 'nurse'>[] = [
    'chin-woman',
    'chin-man',
    'chin-elder',
    'chin-woman',
    'chin-man',
    'chin-kid',
  ];
  return Array.from({ length: count }, (_, i) => {
    const chinKind = kinds[i % kinds.length];
    const isKid = chinKind === 'chin-kid';
    return {
      slotIndex: i,
      role: chinKind === 'chin-woman' ? 'auntie' : chinKind === 'chin-kid' ? 'boy' : 'uncle',
      youthful: chinKind !== 'chin-elder',
      bottomStyle: 'longyi',
      outfitIndex: (i * 3 + 1) % 4,
      skinIndex: i % 3,
      hairIndex: chinKind === 'chin-elder' ? 1 : 0,
      heightScale: isKid ? 0.76 : chinKind === 'chin-woman' ? 0.96 : 1.02,
      walkSpeed: isKid ? 1.12 : chinKind === 'chin-elder' ? 0.76 : 0.92 + (i % 3) * 0.08,
      sideOffset: (i % 2 === 0 ? 1 : -1) * (0.95 + (i % 4) * 0.2),
      chinKind,
    };
  });
}

export function ChinVillageBots({
  activeRegions = [],
  minute = 780,
  timeMode = 'auto',
}: {
  activeRegions?: string[];
  minute?: number;
  timeMode?: TimeMode;
}) {
  const preset = useQualityPreset();
  const isLowQuality = mobileQuality || preset.id === 'mobile' || preset.id === 'low';
  const activeChinVillages = useMemo<ChinFlatlandVillageId[]>(
    () =>
      CHIN_FLATLAND_VILLAGES
        .filter(v => activeRegions.includes(v.id))
        .map(v => v.id),
    [activeRegions],
  );
  const isAnyChinVillageActive = activeChinVillages.length > 0;

  const houseCapacity = isLowQuality ? HOUSE_POOL_MOBILE : HOUSE_POOL_DESKTOP;
  const streetCapacity = isLowQuality ? STREET_POOL_MOBILE : STREET_POOL_DESKTOP;
  const doorCapacity = isLowQuality ? DOOR_POOL_MOBILE : DOOR_POOL_DESKTOP;

  const daytime = isDaytimeLivingHours(minute, timeMode);
  const targetStreetCount = desiredPedestrianCount(minute, timeMode, streetCapacity);

  // One shared Fixed Object Pool serves ALL flatland Chin villages (Tharyargone + Kyar Inn) with ZERO duplicate GPU slots!
  const chinVillageHouses = useMemo<ChinHouseholdHouseInput[]>(() => {
    const tharyargoneHomes = tharYarGoneVillage.houses
      .filter(h => !h.id.startsWith('tyg-landmark-') && !sourceIsEdited(h.id))
      .map(h => ({
        id: h.id,
        x: h.x,
        z: h.z,
        baseY: 0,
        width: h.width,
        depth: h.depth,
        rotation: houseVisualRotation(h),
        compound: defaultChinCompoundBounds(h.width, h.depth),
      }));
    const kyarInnHomes = kyarInnVillage.houses
      .filter(h => !h.id.startsWith('ki-') && !sourceIsEdited(h.id))
      .map(h => ({
        id: h.id,
        x: h.x,
        z: h.z,
        baseY: 0,
        width: h.width,
        depth: h.depth,
        rotation: houseVisualRotation(h),
        compound: defaultChinCompoundBounds(h.width, h.depth),
      }));
    return [...tharyargoneHomes, ...kyarInnHomes];
  }, []);

  const householdPool = useMemo(
    () =>
      new ChinVillagerFixedPoolController(
        chinVillageHouses,
        houseCapacity,
        isLowQuality ? 82 : 120,
        20261121,
        doorCapacity,
      ),
    [chinVillageHouses, houseCapacity, isLowQuality, doorCapacity],
  );

  const streetProfiles = useMemo(() => createChinStreetProfiles(STREET_POOL_DESKTOP), []);
  const streetStatesRef = useRef<StreetPedestrianState[]>(
    createStreetPedestrianStates(STREET_POOL_DESKTOP),
  );
  const streetRebalanceRef = useRef(0);

  const houseSlotRefs = useMemo(
    () => Array.from({ length: houseCapacity }, () => emptySlotRefs()),
    [houseCapacity],
  );
  const streetSlotRefs = useMemo(
    () => Array.from({ length: streetCapacity }, () => emptySlotRefs()),
    [streetCapacity],
  );
  const doorSlotRefs = useMemo(
    () => Array.from({ length: doorCapacity }, () => emptyDoorRefs()),
    [doorCapacity],
  );

  useEffect(() => {
    return () => {
      householdPool.dispose();
      for (let i = 0; i < HOUSE_POOL_DESKTOP; i++) removeAvoidanceActor(`chin-house-bot-${i}`);
      for (let i = 0; i < STREET_POOL_DESKTOP; i++) removeAvoidanceActor(`chin-street-bot-${i}`);
    };
  }, [householdPool]);

  const rootRef = useRef<Group>(null);

  useFrame(({ camera }, delta) => {
    const root = rootRef.current;
    if (!root) return;

    root.visible = isAnyChinVillageActive;
    if (!isAnyChinVillageActive) {
      for (let i = 0; i < houseCapacity; i++) removeAvoidanceActor(`chin-house-bot-${i}`);
      for (let i = 0; i < streetCapacity; i++) removeAvoidanceActor(`chin-street-bot-${i}`);
      return;
    }

    const dt = Math.min(delta, 0.05);
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
      x: camera.position.x,
      z: camera.position.z,
    };

    // 1. Update 1..10 random Chin household residents & nearby attached doors
    //    (Lock any slot currently in bump-to-fight combat so fighters are never recycled mid-fight!)
    householdPool.update(
      focus.x,
      focus.z,
      dt,
      false,
      daytime,
      slotIdx => isBotInCombat(`chin-house-bot-${slotIdx}`),
    );

    for (let i = 0; i < householdPool.slots.length; i++) {
      const m = householdPool.slots[i].member;
      const refs = houseSlotRefs[i];
      if (!refs || !refs.root) continue;
      const botId = `chin-house-bot-${i}`;

      if (!m) {
        refs.root.visible = false;
        removeAvoidanceActor(botId);
        continue;
      }

      bindChinVisualMaterials(refs, m.id, m.kind, m.skinIndex, m.outfitIndex, m.scale, i);

      if (applyChinBotCombatPose(refs, botId, 0.04)) {
        const combat = getBotCombatReaction(botId);
        if (combat && combat.hasWorldPos) {
          m.worldX = combat.worldX;
          m.worldZ = combat.worldZ;
        }
        upsertAvoidanceActor(botId, 'human', m.worldX, m.worldZ, m.yaw, 0.45);
        continue;
      }

      if (m.insideHouse) {
        refs.root.visible = false;
        removeAvoidanceActor(botId);
        continue;
      }
      const prevHX = refs.root.visible ? refs.root.position.x : m.worldX;
      const prevHZ = refs.root.visible ? refs.root.position.z : m.worldZ;
      const hAvoid = applyBotAvoidanceStep(
        botId,
        'human',
        prevHX,
        prevHZ,
        m.worldX,
        m.worldZ,
        m.yaw,
        m.kind === 'chin-kid' ? 0.38 : 0.46,
        dt,
      );
      m.worldX = hAvoid.x;
      m.worldZ = hAvoid.z;
      m.yaw = hAvoid.yaw;
      upsertAvoidanceActor(botId, 'human', m.worldX, m.worldZ, m.yaw, m.kind === 'chin-kid' ? 0.38 : 0.46, {
        speed: m.speed,
      });
      refs.root.visible = true;
      applyChinWalkPose(
        refs,
        m.worldX,
        m.worldY,
        m.worldZ,
        m.yaw,
        m.speed,
        m.walkDist,
        m.elapsed,
        m.phaseOffset,
      );
    }

    // 2. Sync fixed pool of ATTACHED hinged double front doors (1 flush door inside each nearby Chin house frame)
    for (let di = 0; di < householdPool.doorSlots.length; di++) {
      const ds = householdPool.doorSlots[di];
      const refs = doorSlotRefs[di];
      if (!refs || !refs.root) continue;
      if (!ds.house) {
        refs.root.visible = false;
        continue;
      }
      const h = ds.house;
      const frontWallZ = -0.6 + (h.depth - 2.4) / 2;
      const c = Math.cos(h.rotation);
      const s = Math.sin(h.rotation);
      const doorLocalZ = frontWallZ + 0.05;
      refs.root.visible = true;
      refs.root.position.set(
        h.x + doorLocalZ * s,
        h.baseY,
        h.z + doorLocalZ * c,
      );
      refs.root.rotation.set(0, h.rotation, 0);

      const swing = ds.open * 1.42;
      if (refs.leftHinge) refs.leftHinge.rotation.y = -swing;
      if (refs.rightHinge) refs.rightHinge.rotation.y = swing;
    }

    // 3. Update Chin Street Pedestrians walking on REAL connected Chin village roads (Tharyargone / Kyar Inn, daytime/evening only!)
    const streetStates = streetStatesRef.current;
    let nearestVillageId: ChinFlatlandVillageId = activeChinVillages[0];
    if (activeChinVillages.length > 1) {
      let bestDistSq = Infinity;
      for (const vid of activeChinVillages) {
        const meta = CHIN_FLATLAND_VILLAGES.find(v => v.id === vid)!;
        const dSq = (meta.centerX - focus.x) ** 2 + (meta.centerZ - focus.z) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          nearestVillageId = vid;
        }
      }
    }
    const roadGraph = getChinVillageRoadGraph(nearestVillageId);

    if (targetStreetCount === 0 || roadGraph.length < 2) {
      for (let i = 0; i < streetCapacity; i++) {
        streetStates[i].active = false;
        const refs = streetSlotRefs[i];
        if (refs?.root) refs.root.visible = false;
        removeAvoidanceActor(`chin-street-bot-${i}`);
      }
      const bf = getBotFightingState();
      if (
        bf.active &&
        bf.targetBotId &&
        (bf.targetBotId.startsWith('chin-street-bot-') || bf.targetBotId.startsWith('chin-house-bot-'))
      ) {
        disengageBotFight();
      }
      return;
    }

    streetRebalanceRef.current -= dt;
    const doRebalance = streetRebalanceRef.current <= 0;
    if (doRebalance) streetRebalanceRef.current = 0.5;

    for (let i = 0; i < streetCapacity; i++) {
      const st = streetStates[i];
      const prof = streetProfiles[i];
      const refs = streetSlotRefs[i];
      if (!refs || !refs.root) continue;
      const botId = `chin-street-bot-${i}`;

      if (i >= targetStreetCount && !isBotInCombat(botId)) {
        st.active = false;
        refs.root.visible = false;
        removeAvoidanceActor(botId);
        continue;
      }

      if (doRebalance && !isBotInCombat(botId)) {
        const dx = st.x - focus.x;
        const dz = st.z - focus.z;
        const wrongVillage = st.regionId !== nearestVillageId;
        if (!st.active || wrongVillage || dx * dx + dz * dz > RECYCLE_DIST_SQ) {
          const nodeIdx = pickNearbyRoadNode(roadGraph, focus.x, focus.z, 10, 105, st.seed + i * 31);
          if (nodeIdx >= 0) {
            placePedestrianOnGraph(st, nearestVillageId, roadGraph, nodeIdx, prof.sideOffset);
          }
        }
      }

      if (!st.active && !isBotInCombat(botId)) {
        refs.root.visible = false;
        removeAvoidanceActor(botId);
        continue;
      }

      bindChinVisualMaterials(
        refs,
        `street-chin-${i}`,
        prof.chinKind,
        prof.skinIndex,
        prof.outfitIndex,
        prof.heightScale,
        i,
      );

      if (applyChinBotCombatPose(refs, botId, 0.06)) {
        const combat = getBotCombatReaction(botId);
        if (combat && combat.hasWorldPos) {
          st.x = combat.worldX;
          st.z = combat.worldZ;
        }
        st.speed = combat?.chasing ? combat.chaseSpeed : 0;
        st.elapsed += dt;
        upsertAvoidanceActor(botId, 'human', st.x, st.z, st.yaw, 0.46, { speed: st.speed });
        continue;
      }

      const prevSX = st.x;
      const prevSZ = st.z;
      stepStreetPedestrian(st, prof, roadGraph, dt);
      const sRadius = prof.chinKind === 'chin-kid' ? 0.38 : 0.46;
      const sAvoid = applyBotAvoidanceStep(botId, 'human', prevSX, prevSZ, st.x, st.z, st.yaw, sRadius, dt, {
        canStand,
      });
      st.x = sAvoid.x;
      st.z = sAvoid.z;
      st.yaw = sAvoid.yaw;
      if (sAvoid.yieldedToCar || sAvoid.steered) {
        const moved = Math.hypot(st.x - prevSX, st.z - prevSZ);
        st.speed = moved / Math.max(0.001, dt);
        st.walkDistance += moved;
      }
      upsertAvoidanceActor(botId, 'human', st.x, st.z, st.yaw, sRadius, { speed: st.speed });
      refs.root.visible = true;
      applyChinWalkPose(
        refs,
        st.x,
        0.06,
        st.z,
        st.yaw,
        st.speed,
        st.walkDistance,
        st.elapsed,
        i * 1.13,
      );
    }
  });

  return (
    <group ref={rootRef} name="live-chin-village-bots" visible={false} userData={{ dynamic: true }}>
      {doorSlotRefs.map((refs, idx) => (
        <AttachedChinDoorSlotView key={`chin-door-${idx}`} slotIndex={idx} refs={refs} />
      ))}
      {houseSlotRefs.map((refs, idx) => (
        <ChinCharacterSlotView
          key={`chin-house-bot-${idx}`}
          name={`chin-house-bot-${idx}`}
          active={isAnyChinVillageActive}
          refs={refs}
        />
      ))}
      {streetSlotRefs.map((refs, idx) => (
        <ChinCharacterSlotView
          key={`chin-street-bot-${idx}`}
          name={`chin-street-bot-${idx}`}
          active={isAnyChinVillageActive}
          refs={refs}
        />
      ))}
    </group>
  );
}
