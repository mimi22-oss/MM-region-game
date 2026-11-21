import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { toWorld } from '../data/ward';
import { mobileQuality } from '../game/sceneBudget';
import { WEIPULA_VILLAGE_V_OFFSET } from '../game/weipulaClimb';
import { trafficColliders } from '../game/trafficColliders';
import { isBotInCombat } from '../game/botFighting';
import { applyChinBotCombatPose, chinKindToNpcRole } from '../game/chinCombatPose';
import {
  createWeipulaVillagerRoster,
  createWeipulaVillagerRuntime,
  getWeipulaVillagerCache,
  stepWeipulaVillager,
  type WeipulaVillagerDescriptor,
  type WeipulaVillagerRuntime,
} from '../game/weipulaVillagers';

export type VillagerHandles = {
  root: Group | null;
  body: Group | null;
  head: Group | null;
  leftArm: Group | null;
  rightArm: Group | null;
  leftLeg: Group | null;
  rightLeg: Group | null;
};

const VILLAGE_CENTER = toWorld(-335, 4421 + WEIPULA_VILLAGE_V_OFFSET);
const ACTIVE_RANGE_SQ = 260 * 260;

/**
 * Single articulated Nurse / Chin Villager mesh bound strictly to the
 * Singleton Memory Reference Cache (`getWeipulaVillagerCache()`).
 * Zero per-villager geometry or material allocation!
 */
export function WeipulaVillagerRig({
  desc,
  register,
}: {
  desc: WeipulaVillagerDescriptor;
  register: (h: VillagerHandles) => void;
}) {
  const cache = getWeipulaVillagerCache();
  const localRootRef = useRef<Group>(null);
  const handlesRef = useRef<VillagerHandles>({
    root: null,
    body: null,
    head: null,
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
  });

  useEffect(() => {
    const obj = localRootRef.current;
    if (!obj) return;
    trafficColliders.set(obj, { width: 0.44, depth: 0.44, kind: 'robot' });
    return () => {
      trafficColliders.delete(obj);
    };
  }, []);

  const isNurse = desc.kind === 'nurse';
  const isWoman = desc.kind === 'chin-woman' || isNurse;
  const isElder = desc.kind === 'chin-elder';
  const isKid = desc.kind === 'chin-kid';
  const npcRole = chinKindToNpcRole(desc.kind, desc.outfitIndex);

  const skinMat = cache.skinMats[desc.skinIndex % cache.skinMats.length];
  const hairMat = isElder ? cache.hairSilverMat : cache.hairDarkMat;
  const topMat = isNurse
    ? cache.nurseWhiteMat
    : cache.chinTopMats[desc.outfitIndex % cache.chinTopMats.length];
  const bottomMat = isNurse
    ? cache.nurseLongyiMat
    : cache.chinWeaveMats[desc.outfitIndex % cache.chinWeaveMats.length];

  return (
    <group
      name={desc.id}
      scale={[desc.scale, desc.scale, desc.scale]}
      userData={{ dynamic: true, npcRole }}
      ref={el => {
        (localRootRef as { current: Group | null }).current = el;
        handlesRef.current.root = el;
        register(handlesRef.current);
      }}
    >
      <group
        ref={el => {
          handlesRef.current.body = el;
        }}
      >
        {/* Head + Hair + Nurse Cap / Chin Headband */}
        <group
          position={[0, 1.56, 0]}
          ref={el => {
            handlesRef.current.head = el;
          }}
        >
          <mesh geometry={cache.headGeo} material={skinMat} />
          <mesh position={[0, 0.03, -0.01]} geometry={cache.hairCapGeo} material={hairMat} />
          {isWoman && (
            <mesh position={[0, 0.04, -0.16]} geometry={cache.hairBunGeo} material={hairMat} />
          )}

          {/* Myanmar Rural Nurse Cap with Red Cross Emblem */}
          {isNurse && (
            <group position={[0, 0.165, 0.015]}>
              <mesh geometry={cache.nurseCapGeo} material={cache.nurseWhiteMat} />
              <mesh position={[0, 0.005, 0.062]} geometry={cache.crossHGeo} material={cache.redCrossMat} />
              <mesh position={[0, 0.005, 0.062]} geometry={cache.crossVGeo} material={cache.redCrossMat} />
            </group>
          )}

          {/* Traditional Chin Woven Golden Headband */}
          {!isNurse && !isKid && (
            <mesh
              position={[0, 0.06, 0]}
              rotation={[Math.PI / 2 - 0.14, 0, 0]}
              geometry={cache.chinHeadbandGeo}
              material={cache.chinHeadbandMat}
            />
          )}
        </group>

        {/* Neck & Torso */}
        <mesh position={[0, 1.38, 0]} geometry={cache.neckGeo} material={skinMat} />
        <mesh position={[0, 1.11, 0]} geometry={cache.torsoGeo} material={topMat} />

        {/* Nurse Chest Red Cross Badge OR Chin Traditional Woven Shoulder Sash */}
        {isNurse ? (
          <group position={[0.07, 1.2, 0.175]}>
            <mesh geometry={cache.crossHGeo} material={cache.redCrossMat} />
            <mesh geometry={cache.crossVGeo} material={cache.redCrossMat} />
          </group>
        ) : (
          <mesh
            position={[0, 1.12, 0]}
            rotation={[0, 0, 0.42]}
            geometry={cache.sashGeo}
            material={isElder ? cache.chinHeadbandMat : cache.chinGoldSashMat}
          />
        )}

        {/* Traditional Chin Woven Htamein/Longyi or Nurse Red Longyi */}
        <mesh position={[0, 0.56, 0]} geometry={cache.longyiGeo} material={bottomMat} />

        {/* Left Arm */}
        <group
          position={[-0.23, 1.3, 0]}
          ref={el => {
            handlesRef.current.leftArm = el;
          }}
        >
          <mesh position={[0, -0.22, 0]} geometry={cache.armGeo} material={topMat} />
        </group>

        {/* Right Arm (+ White Medical First-Aid Kit Bag for Nurses) */}
        <group
          position={[0.23, 1.3, 0]}
          ref={el => {
            handlesRef.current.rightArm = el;
          }}
        >
          <mesh position={[0, -0.22, 0]} geometry={cache.armGeo} material={topMat} />
          {isNurse && (
            <group position={[0.04, -0.46, 0.04]}>
              <mesh geometry={cache.medBagGeo} material={cache.medBagMat} />
              <mesh position={[0.064, 0, 0]} rotation={[0, Math.PI / 2, 0]} geometry={cache.crossHGeo} material={cache.redCrossMat} />
              <mesh position={[0.064, 0, 0]} rotation={[0, Math.PI / 2, 0]} geometry={cache.crossVGeo} material={cache.redCrossMat} />
            </group>
          )}
        </group>

        {/* Left & Right Feet/Legs peeking below Longyi */}
        <group
          position={[-0.085, 0.54, 0]}
          ref={el => {
            handlesRef.current.leftLeg = el;
          }}
        >
          <mesh position={[0, -0.26, 0]} geometry={cache.legGeo} material={skinMat} />
          <mesh position={[0, -0.5, 0.04]} geometry={cache.shoeGeo} material={cache.shoeDarkMat} />
        </group>
        <group
          position={[0.085, 0.54, 0]}
          ref={el => {
            handlesRef.current.rightLeg = el;
          }}
        >
          <mesh position={[0, -0.26, 0]} geometry={cache.legGeo} material={skinMat} />
          <mesh position={[0, -0.5, 0.04]} geometry={cache.shoeGeo} material={cache.shoeDarkMat} />
        </group>
      </group>
    </group>
  );
}

/**
 * ဝေပုလ္လ လှေကားထစ်ရွာ သူနာပြုများနှင့် ချင်းလူမျိုးစု ရွာသူရွာသားများ Controller
 * Single useFrame loop, proximity sleep (> 260m = 0ms CPU & hidden), Singleton Cache references.
 */
export function WeipulaVillageResidents({
  tierElevations,
}: {
  tierElevations: readonly [number, number, number, number];
}) {
  const rootGroupRef = useRef<Group>(null);

  const roster = useMemo(() => {
    const full = createWeipulaVillagerRoster();
    // On low-end mobile, still keep at least 5 residents per house (40 total) for authentic crowded village feel
    if (!mobileQuality) return full;
    const perHouse = new Map<string, number>();
    return full.filter(r => {
      const count = perHouse.get(r.houseId) ?? 0;
      if (count >= 5) return false;
      perHouse.set(r.houseId, count + 1);
      return true;
    });
  }, []);

  const runtimesRef = useRef<WeipulaVillagerRuntime[] | null>(null);
  if (!runtimesRef.current || runtimesRef.current.length !== roster.length) {
    runtimesRef.current = roster.map(createWeipulaVillagerRuntime);
  }
  const handlesListRef = useRef<(VillagerHandles | null)[]>(new Array(roster.length).fill(null));

  useFrame(({ camera }, delta) => {
    const group = rootGroupRef.current;
    if (!group) return;

    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    const dx = focus.x - VILLAGE_CENTER.x;
    const dz = focus.z - VILLAGE_CENTER.z;
    const near = dx * dx + dz * dz <= ACTIVE_RANGE_SQ;
    group.visible = near;
    if (!near) return;

    const runtimes = runtimesRef.current!;
    const handlesList = handlesListRef.current;
    const dt = Math.min(delta, 0.08);

    for (let i = 0; i < runtimes.length; i++) {
      const rt = runtimes[i];
      const h = handlesList[i];
      if (!h || !h.root) continue;

      const baseY = tierElevations[rt.desc.tierIndex] + rt.desc.yOffset;
      if (isBotInCombat(rt.desc.id) && applyChinBotCombatPose(h, rt.desc.id, baseY)) {
        rt.elapsed += dt;
        continue;
      }

      stepWeipulaVillager(rt, dt);

      const walkFactor = Math.min(1, rt.speed / 0.65);
      const stride = rt.walkDist * 4.6;
      const bounce = Math.abs(Math.sin(stride)) * 0.03 * walkFactor;

      h.root.position.set(rt.x, baseY + bounce, rt.z);
      h.root.rotation.y = rt.yaw;

      if (h.head) {
        h.head.rotation.y = Math.sin(rt.elapsed * 0.85 + rt.desc.phaseOffset) * 0.24 * (1 - walkFactor * 0.6);
        h.head.rotation.x = Math.sin(rt.elapsed * 1.4 + rt.desc.phaseOffset) * 0.04;
      }
      const armSwing = Math.sin(stride) * 0.45 * walkFactor;
      if (h.leftArm) {
        h.leftArm.rotation.x = -armSwing;
        h.leftArm.rotation.z = 0.08;
      }
      if (h.rightArm) {
        // Gentle friendly wave occasionally while paused, or steady med-bag carry for nurses
        const nurseCarry = rt.desc.kind === 'nurse' ? 0.25 : 1.0;
        h.rightArm.rotation.x = armSwing * nurseCarry;
        h.rightArm.rotation.z = -0.08;
      }
      const legSwing = Math.sin(stride) * 0.36 * walkFactor;
      if (h.leftLeg) h.leftLeg.rotation.x = legSwing;
      if (h.rightLeg) h.rightLeg.rotation.x = -legSwing;
    }
  });

  return (
    <group ref={rootGroupRef} name="weipula-village-nurses-and-chin-residents" userData={{ dynamic: true }}>
      {roster.map((desc, idx) => (
        <WeipulaVillagerRig
          key={desc.id}
          desc={desc}
          register={h => {
            handlesListRef.current[idx] = h;
          }}
        />
      ))}
    </group>
  );
}
