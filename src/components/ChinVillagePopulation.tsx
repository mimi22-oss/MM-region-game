import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { mobileQuality } from '../game/sceneBudget';
import { getWeipulaVillagerCache } from '../game/weipulaVillagers';
import {
  ChinVillagerFixedPoolController,
  type ChinHouseholdHouseInput,
} from '../game/chinVillagerPool';

interface PooledChinSlotRefs {
  root: Group | null;
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
  leftLeg: Group | null;
  leftLegMesh: Mesh | null;
  rightLeg: Group | null;
  rightLegMesh: Mesh | null;
  boundMemberId: string | null;
}

function emptySlotRefs(): PooledChinSlotRefs {
  return {
    root: null,
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
    leftLeg: null,
    leftLegMesh: null,
    rightLeg: null,
    rightLegMesh: null,
    boundMemberId: null,
  };
}

/**
 * Single reusable Fixed-Pool Chin Villager rig bound strictly to the
 * Singleton Memory Reference Cache (`getWeipulaVillagerCache()`).
 * Materials & visibility swap cleanly on slot recycle — ZERO allocations!
 */
function PooledChinVillagerSlotView({
  slotIndex,
  refs,
}: {
  slotIndex: number;
  refs: PooledChinSlotRefs;
}) {
  const cache = getWeipulaVillagerCache();

  return (
    <group
      name={`chin-pool-slot-${slotIndex}`}
      visible={false}
      ref={el => {
        refs.root = el;
      }}
    >
      {/* Head + Hair + Chin Woven Golden Headband */}
      <group
        position={[0, 1.56, 0]}
        ref={el => {
          refs.head = el;
        }}
      >
        <mesh
          ref={el => {
            refs.headMesh = el;
          }}
          geometry={cache.headGeo}
          material={cache.skinMats[0]}
        />
        <mesh
          ref={el => {
            refs.hairCapMesh = el;
          }}
          position={[0, 0.03, -0.01]}
          geometry={cache.hairCapGeo}
          material={cache.hairDarkMat}
        />
        <mesh
          ref={el => {
            refs.hairBunMesh = el;
          }}
          position={[0, 0.04, -0.16]}
          geometry={cache.hairBunGeo}
          material={cache.hairDarkMat}
          visible={false}
        />
        <mesh
          ref={el => {
            refs.headbandMesh = el;
          }}
          position={[0, 0.06, 0]}
          rotation={[Math.PI / 2 - 0.14, 0, 0]}
          geometry={cache.chinHeadbandGeo}
          material={cache.chinHeadbandMat}
        />
      </group>

      {/* Neck, Chin Embroidered Top & Traditional Woven Shoulder Sash */}
      <mesh
        ref={el => {
          refs.neckMesh = el;
        }}
        position={[0, 1.38, 0]}
        geometry={cache.neckGeo}
        material={cache.skinMats[0]}
      />
      <mesh
        ref={el => {
          refs.torsoMesh = el;
        }}
        position={[0, 1.11, 0]}
        geometry={cache.torsoGeo}
        material={cache.chinTopMats[0]}
      />
      <mesh
        ref={el => {
          refs.sashMesh = el;
        }}
        position={[0, 1.12, 0]}
        rotation={[0, 0, 0.42]}
        geometry={cache.sashGeo}
        material={cache.chinGoldSashMat}
      />

      {/* Traditional Chin Woven Diamond Htamein / Longyi */}
      <mesh
        ref={el => {
          refs.longyiMesh = el;
        }}
        position={[0, 0.56, 0]}
        geometry={cache.longyiGeo}
        material={cache.chinWeaveMats[0]}
      />

      {/* Left Arm */}
      <group
        position={[-0.23, 1.3, 0]}
        ref={el => {
          refs.leftArm = el;
        }}
      >
        <mesh
          ref={el => {
            refs.leftArmMesh = el;
          }}
          position={[0, -0.22, 0]}
          geometry={cache.armGeo}
          material={cache.chinTopMats[0]}
        />
      </group>

      {/* Right Arm */}
      <group
        position={[0.23, 1.3, 0]}
        ref={el => {
          refs.rightArm = el;
        }}
      >
        <mesh
          ref={el => {
            refs.rightArmMesh = el;
          }}
          position={[0, -0.22, 0]}
          geometry={cache.armGeo}
          material={cache.chinTopMats[0]}
        />
      </group>

      {/* Left & Right Legs */}
      <group
        position={[-0.085, 0.54, 0]}
        ref={el => {
          refs.leftLeg = el;
        }}
      >
        <mesh
          ref={el => {
            refs.leftLegMesh = el;
          }}
          position={[0, -0.26, 0]}
          geometry={cache.legGeo}
          material={cache.skinMats[0]}
        />
        <mesh position={[0, -0.5, 0.04]} geometry={cache.shoeGeo} material={cache.shoeDarkMat} />
      </group>
      <group
        position={[0.085, 0.54, 0]}
        ref={el => {
          refs.rightLeg = el;
        }}
      >
        <mesh
          ref={el => {
            refs.rightLegMesh = el;
          }}
          position={[0, -0.26, 0]}
          geometry={cache.legGeo}
          material={cache.skinMats[0]}
        />
        <mesh position={[0, -0.5, 0.04]} geometry={cache.shoeGeo} material={cache.shoeDarkMat} />
      </group>
    </group>
  );
}

/**
 * Reusable Chin Village Population Component (`<ChinVillagePopulation>`)
 *
 * Uses strict **Singleton Memory Reference Cache** (`getWeipulaVillagerCache()`) +
 * **Fixed Object Pool** (`ChinVillagerFixedPoolController`):
 * - Assigns 1 to 10 random Chin ethnic residents per Chin house (some solo, some 10-person families!)
 * - Recycles a fixed number of GPU character rigs (`40` mobile / `72` desktop) around the player
 * - Drives each house's OWN attached front double door open/close smoothly
 */
export function ChinVillagePopulation({
  regionId,
  houses,
  center,
  activeRadius = 115,
  sleepRange = 420,
  villageSeed = 20261121,
}: {
  regionId: string;
  houses: readonly ChinHouseholdHouseInput[];
  center: { x: number; z: number };
  activeRadius?: number;
  sleepRange?: number;
  villageSeed?: number;
}) {
  const rootRef = useRef<Group>(null);
  const poolCapacity = mobileQuality ? 40 : 72;
  const effectiveRadius = mobileQuality ? Math.min(78, activeRadius) : activeRadius;
  const sleepRangeSq = sleepRange * sleepRange;

  const controller = useMemo(
    () => new ChinVillagerFixedPoolController(houses, poolCapacity, effectiveRadius, villageSeed),
    [houses, poolCapacity, effectiveRadius, villageSeed],
  );

  const slotRefsList = useMemo(
    () => Array.from({ length: poolCapacity }, () => emptySlotRefs()),
    [poolCapacity],
  );

  useEffect(() => {
    controller.update(center.x, center.z, 0, true);
    return () => {
      controller.dispose();
    };
  }, [center.x, center.z, controller]);

  useFrame(({ camera }, delta) => {
    const root = rootRef.current;
    if (!root) return;

    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    const dx = focus.x - center.x;
    const dz = focus.z - center.z;
    const near = dx * dx + dz * dz <= sleepRangeSq;
    root.visible = near;
    if (!near) return;

    controller.update(focus.x, focus.z, delta);
    const cache = getWeipulaVillagerCache();

    for (let i = 0; i < controller.slots.length; i++) {
      const m = controller.slots[i].member;
      const refs = slotRefsList[i];
      if (!refs.root) continue;

      if (!m || m.insideHouse) {
        refs.root.visible = false;
        continue;
      }

      refs.root.visible = true;

      // Re-bind Singleton materials ONLY when this slot recycles to a different Chin resident
      if (refs.boundMemberId !== m.id) {
        refs.boundMemberId = m.id;
        const skinMat = cache.skinMats[m.skinIndex % cache.skinMats.length];
        const isElder = m.kind === 'chin-elder';
        const isWoman = m.kind === 'chin-woman';
        const isKid = m.kind === 'chin-kid';
        const hairMat = isElder ? cache.hairSilverMat : cache.hairDarkMat;
        const topMat = cache.chinTopMats[m.outfitIndex % cache.chinTopMats.length];
        const weaveMat = cache.chinWeaveMats[m.outfitIndex % cache.chinWeaveMats.length];

        if (refs.headMesh) refs.headMesh.material = skinMat;
        if (refs.neckMesh) refs.neckMesh.material = skinMat;
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
        refs.root.scale.set(m.scale, m.scale, m.scale);
      }

      const walkFactor = Math.min(1, m.speed / 0.65);
      const stride = m.walkDist * 4.6;
      const bounce = Math.abs(Math.sin(stride)) * 0.03 * walkFactor;

      refs.root.position.set(m.worldX, m.worldY + bounce, m.worldZ);
      refs.root.rotation.y = m.yaw;

      if (refs.head) {
        refs.head.rotation.y =
          Math.sin(m.elapsed * 0.85 + m.phaseOffset) * 0.24 * (1 - walkFactor * 0.6);
        refs.head.rotation.x = Math.sin(m.elapsed * 1.4 + m.phaseOffset) * 0.04;
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
  });

  return (
    <group ref={rootRef} name={`chin-village-population-${regionId}`} userData={{ dynamic: true }}>
      {slotRefsList.map((refs, idx) => (
        <PooledChinVillagerSlotView key={`chin-slot-${idx}`} slotIndex={idx} refs={refs} />
      ))}
    </group>
  );
}
