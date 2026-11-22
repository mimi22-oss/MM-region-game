import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { mobileQuality } from '../../game/sceneBudget';
import { useQualityPreset } from '../../game/qualityPreset';
import type { TimeMode } from '../../game/environmentTime';
import { trafficColliders } from '../../game/trafficColliders';
import { getMonkAssetCache } from '../../game/monkAssets';
import { npcFaceGeometry, npcFaceMaterial, npcHandGeometry } from '../../game/npcAnatomy';
import {
  MONK_POOL_DESKTOP,
  MONK_POOL_MOBILE,
  MonkFixedPoolController,
  type MonkMemberState,
} from '../../game/monkPool';

/**
 * ============================================================================
 * PooledMonks — Singleton Memory Reference Cache + Fixed Object Pool Renderer
 * (`ဘုန်းတော်ကြီးများ နှင့် ကိုရင်များ`)
 * ============================================================================
 *
 * Mounts ONCE in `<StreamedWorld>` with a strictly fixed pool capacity
 * (`24` desktop / `14` mobile). Every monk slot reuses:
 * 1. ONE Singleton `getMonkAssetCache()` (zero duplicate GPU geometries/materials),
 * 2. ONE Fixed Object Pool (`MonkFixedPoolController`) with zero per-frame allocations,
 * 3. Direct imperative ref transforms in `useFrame` (zero React re-renders).
 */

interface MonkSlotRefs {
  root: Group | null;
  body: Group | null;
  headMesh: Mesh | null;
  neckMesh: Mesh | null;
  chestMesh: Mesh | null;
  torsoMesh: Mesh | null;
  drapeMesh: Mesh | null;
  longyiMesh: Mesh | null;
  leftArm: Group | null;
  rightArm: Group | null;
  leftArmMesh: Mesh | null;
  rightArmMesh: Mesh | null;
  leftHandMesh: Mesh | null;
  rightHandMesh: Mesh | null;
  leftLeg: Group | null;
  rightLeg: Group | null;
  leftLegMesh: Mesh | null;
  rightLegMesh: Mesh | null;
  almsBowlGroup: Group | null;
  palmFanGroup: Group | null;
  beadsMesh: Mesh | null;
  boundId: string | null;
}

function createEmptyMonkRefs(): MonkSlotRefs {
  return {
    root: null,
    body: null,
    headMesh: null,
    neckMesh: null,
    chestMesh: null,
    torsoMesh: null,
    drapeMesh: null,
    longyiMesh: null,
    leftArm: null,
    rightArm: null,
    leftArmMesh: null,
    rightArmMesh: null,
    leftHandMesh: null,
    rightHandMesh: null,
    leftLeg: null,
    rightLeg: null,
    leftLegMesh: null,
    rightLegMesh: null,
    almsBowlGroup: null,
    palmFanGroup: null,
    beadsMesh: null,
    boundId: null,
  };
}

function bindMonkVisuals(refs: MonkSlotRefs, m: MonkMemberState): void {
  if (refs.boundId === m.id) return;
  refs.boundId = m.id;

  const mc = getMonkAssetCache();
  const base = mc.base;
  const skinMat = base.skinMats[m.skinIndex % base.skinMats.length];
  const { robeVariant } = m;
  const robeMat = robeVariant === 2 ? mc.saffronRobeMat : robeVariant === 1 ? mc.burgundyRobeMat : mc.maroonRobeMat;

  if (refs.headMesh) refs.headMesh.material = skinMat;
  if (refs.neckMesh) refs.neckMesh.material = skinMat;
  if (refs.chestMesh) refs.chestMesh.material = skinMat;
  if (refs.torsoMesh) refs.torsoMesh.material = robeMat;
  if (refs.drapeMesh) refs.drapeMesh.material = mc.shoulderDrapeMats[robeVariant];
  if (refs.longyiMesh) refs.longyiMesh.material = robeMat;
  if (refs.leftArmMesh) refs.leftArmMesh.material = skinMat;
  if (refs.rightArmMesh) refs.rightArmMesh.material = skinMat;
  if (refs.leftHandMesh) refs.leftHandMesh.material = skinMat;
  if (refs.rightHandMesh) refs.rightHandMesh.material = skinMat;
  if (refs.leftLegMesh) refs.leftLegMesh.material = skinMat;
  if (refs.rightLegMesh) refs.rightLegMesh.material = skinMat;

  if (refs.almsBowlGroup) refs.almsBowlGroup.visible = m.carriesAlmsBowl;
  if (refs.palmFanGroup) refs.palmFanGroup.visible = m.carriesFan;
  if (refs.beadsMesh) refs.beadsMesh.visible = m.carriesBeads;

  if (refs.root) {
    refs.root.scale.setScalar(m.scale);
    refs.root.name = `monastery-monk-${m.id}`;
    refs.root.userData.npcRole = 'monk';
    refs.root.userData.monkRole = m.role;
  }
}

/**
 * Standalone Reusable Theravada Monk Rig (shares 100% of `getMonkAssetCache()`
 * Singleton geometries & materials; used inside every Fixed Pool slot).
 */
export const MonkRigSlot = memo(function MonkRigSlot({
  slotIndex,
  refs,
}: {
  slotIndex: number;
  refs: MonkSlotRefs;
}) {
  const mc = getMonkAssetCache();
  const base = mc.base;

  return (
    <group
      ref={(el) => {
        refs.root = el;
      }}
      name={`monastery-monk-slot-${slotIndex}`}
      visible={false}
      userData={{ npcRole: 'monk' }}
    >
      <group
        ref={(el) => {
          refs.body = el;
        }}
      >
        {/* Shaved Head (`ဦးခေါင်း`) + Face */}
        <group position={[0, 1.56, 0]}>
          <mesh
            ref={(el) => {
              refs.headMesh = el;
            }}
            geometry={base.headGeo}
            material={base.skinMats[0]}
            castShadow
          />
          <mesh geometry={npcFaceGeometry} material={npcFaceMaterial} />
        </group>

        {/* Neck */}
        <mesh
          ref={(el) => {
            refs.neckMesh = el;
          }}
          position={[0, 1.38, 0]}
          geometry={base.neckGeo}
          material={base.skinMats[0]}
        />

        <mesh
          ref={(el) => { refs.chestMesh = el; }}
          geometry={mc.chestGeo}
          material={base.skinMats[0]}
        />

        {/* Diagonal robe wrap with a separate folded cloth over the monk's left shoulder. */}
        <mesh
          ref={(el) => {
            refs.torsoMesh = el;
          }}
          geometry={mc.wrappedRobeGeo}
          material={mc.maroonRobeMat}
          castShadow
        />
        <mesh
          ref={(el) => {
            refs.drapeMesh = el;
          }}
          name="monk-shoulder-drape"
          geometry={mc.shoulderDrapeGeo}
          material={mc.shoulderDrapeMats[0]}
        />

        {/* Lower Robe (`သင်းပိုင်`) */}
        <mesh
          ref={(el) => {
            refs.longyiMesh = el;
          }}
          geometry={mc.lowerRobeGeo}
          material={mc.maroonRobeMat}
          castShadow
        />

        {/* Left Arm */}
        <group
          ref={(el) => {
            refs.leftArm = el;
          }}
          position={[-0.215, 1.29, 0]}
        >
          <mesh
            ref={(el) => {
              refs.leftArmMesh = el;
            }}
            geometry={base.armGeo}
            material={base.skinMats[0]}
          />
          <mesh
            ref={(el) => {
              refs.leftHandMesh = el;
            }}
            position={[0, -0.44, 0.02]}
            geometry={npcHandGeometry}
            material={base.skinMats[0]}
          />
          {/* Prayer Beads (`စိပ်ပုတီး`) in left hand */}
          <mesh
            ref={(el) => {
              refs.beadsMesh = el;
            }}
            position={[0, -0.46, 0.05]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={mc.prayerBeadsGeo}
            material={mc.prayerBeadsMat}
            visible={false}
          />
        </group>

        {/* Right Arm (often carrying Ceremonial Fan `ယပ်တောင်`) */}
        <group
          ref={(el) => {
            refs.rightArm = el;
          }}
          position={[0.215, 1.29, 0]}
        >
          <mesh
            ref={(el) => {
              refs.rightArmMesh = el;
            }}
            geometry={base.armGeo}
            material={base.skinMats[0]}
          />
          <mesh
            ref={(el) => {
              refs.rightHandMesh = el;
            }}
            position={[0, -0.44, 0.02]}
            scale={[-1, 1, 1]}
            geometry={npcHandGeometry}
            material={base.skinMats[0]}
          />
          {/* Ceremonial Monk's Palm-Leaf Fan (`ယပ်တောင်`) */}
          <group
            ref={(el) => {
              refs.palmFanGroup = el;
            }}
            position={[0, -0.42, 0.08]}
            rotation={[0.45, 0, -0.12]}
            visible={false}
          >
            <mesh position={[0, 0.14, 0]} geometry={mc.palmFanHandleGeo} material={mc.palmFanHandleMat} />
            <mesh
              position={[0, 0.34, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={mc.palmFanBladeGeo}
              material={mc.palmFanMat}
            />
          </group>
        </group>

        {/* Black-Lacquer Theravada Alms Bowl (`သပိတ်`) cradled in front of chest */}
        <group
          ref={(el) => {
            refs.almsBowlGroup = el;
          }}
          position={[0, 1.0, 0.22]}
          visible={false}
        >
          <mesh geometry={mc.almsBowlBodyGeo} material={mc.almsBowlMat} castShadow />
          <mesh position={[0, 0.075, 0]} geometry={mc.almsBowlRimGeo} material={mc.almsBowlRimMat} />
          <mesh position={[0, 0.08, 0]} geometry={mc.almsBowlLidGeo} material={mc.almsBowlMat} />
        </group>

        {/* Left & Right Legs + Monastery Slippers */}
        <group
          ref={(el) => {
            refs.leftLeg = el;
          }}
          position={[-0.085, 0.42, 0]}
        >
          <mesh
            ref={(el) => {
              refs.leftLegMesh = el;
            }}
            position={[0, -0.153, 0]}
            geometry={base.legGeo}
            material={base.skinMats[0]}
          />
          <mesh position={[0, -0.418, 0]} geometry={base.shoeGeo} material={mc.sandalMat} />
        </group>
        <group
          ref={(el) => {
            refs.rightLeg = el;
          }}
          position={[0.085, 0.42, 0]}
        >
          <mesh
            ref={(el) => {
              refs.rightLegMesh = el;
            }}
            position={[0, -0.153, 0]}
            geometry={base.legGeo}
            material={base.skinMats[0]}
          />
          <mesh position={[0, -0.418, 0]} geometry={base.shoeGeo} material={mc.sandalMat} />
        </group>
      </group>
    </group>
  );
});

export const PooledMonks = memo(function PooledMonks({
  activeRegions = [],
  minute = 480,
  timeMode,
}: {
  activeRegions?: string[];
  minute?: number;
  timeMode?: TimeMode;
}) {
  const preset = useQualityPreset();
  const isLow = mobileQuality || preset.id === 'mobile' || preset.id === 'low';
  const capacity = isLow ? MONK_POOL_MOBILE : MONK_POOL_DESKTOP;
  const activeRadius = isLow ? 160 : 220;

  const controller = useMemo(
    () => new MonkFixedPoolController(capacity, activeRadius),
    [capacity, activeRadius],
  );
  const slotRefs = useMemo(
    () => Array.from({ length: capacity }, () => createEmptyMonkRefs()),
    [capacity],
  );
  const rebalanceTimer = useRef(0);
  const registeredColliders = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      for (const idx of registeredColliders.current) {
        const root = slotRefs[idx]?.root;
        if (root) trafficColliders.delete(root);
      }
      registeredColliders.current.clear();
      controller.dispose();
    };
  }, [controller, slotRefs]);

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    rebalanceTimer.current -= dt;
    if (rebalanceTimer.current <= 0) {
      rebalanceTimer.current = 0.35;
      const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
        x: camera.position.x,
        z: camera.position.z,
      };
      controller.rebalance(focus.x, focus.z, activeRegions, minute, timeMode);
    }

    controller.step(dt);
    const t = clock.elapsedTime;

    for (let si = 0; si < capacity; si++) {
      const slot = controller.slots[si];
      const refs = slotRefs[si];
      const root = refs.root;
      if (!root) continue;

      const m = slot.member;
      if (!m || !m.active) {
        if (root.visible) {
          root.visible = false;
          if (registeredColliders.current.has(si)) {
            trafficColliders.delete(root);
            registeredColliders.current.delete(si);
          }
        }
        continue;
      }

      bindMonkVisuals(refs, m);
      if (!root.visible) root.visible = true;

      root.position.set(m.x, m.y, m.z);
      root.rotation.y = m.yaw;

      // Register traffic collider once while active so player walks respectfully around monks
      if (!registeredColliders.current.has(si)) {
        trafficColliders.set(root, {
          width: 0.68,
          depth: 0.64,
          kind: 'robot',
        });
        registeredColliders.current.add(si);
      }

      // Serene Theravada walking / alms-cradling / praying animation
      const walking = m.speed > 0.05;
      const swing = walking ? Math.sin(m.walkPhase) * 0.32 : 0;
      if (refs.body) {
        refs.body.position.y = walking ? Math.abs(Math.sin(m.walkPhase)) * 0.025 : Math.sin(t * 1.4 + si) * 0.006;
      }
      if (refs.leftLeg) refs.leftLeg.rotation.x = swing;
      if (refs.rightLeg) refs.rightLeg.rotation.x = -swing;

      if (m.carriesAlmsBowl) {
        // Both forearms gently cradle the black lacquer alms bowl (`သပိတ်`)
        if (refs.leftArm) {
          refs.leftArm.rotation.x = -0.68;
          refs.leftArm.rotation.z = 0.24;
        }
        if (refs.rightArm) {
          refs.rightArm.rotation.x = -0.68;
          refs.rightArm.rotation.z = -0.24;
        }
      } else {
        if (refs.leftArm) {
          refs.leftArm.rotation.x = walking ? -swing * 0.65 : -0.18;
          refs.leftArm.rotation.z = 0.06;
        }
        if (refs.rightArm) {
          refs.rightArm.rotation.x = m.carriesFan ? -0.52 + Math.sin(t * 1.6 + si) * 0.06 : walking ? swing * 0.65 : -0.12;
          refs.rightArm.rotation.z = -0.06;
        }
      }
    }
  });

  return (
    <group name="pooled-monastery-monks" userData={{ dynamic: true }}>
      {slotRefs.map((refs, idx) => (
        <MonkRigSlot key={`monk-pool-slot-${idx}`} slotIndex={idx} refs={refs} />
      ))}
    </group>
  );
});
