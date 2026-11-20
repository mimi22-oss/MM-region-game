/**
 * Reusable flyweight Kid Bot Rig (ကလေး ယောကျ်ားလေး / မိန်းကလေး) & Low Kid Stool
 * sharing the exact same singleton geometry & material cache (`getElderBotResourceCache`)
 * with zero per-house geometry or material allocation.
 */

import { useEffect, useRef, type RefObject } from 'react';
import { Vector3, type Group } from 'three';
import { getElderBotResourceCache } from '../game/elderBotResources';
import { coveredStride } from '../game/characterClothing';
import type { ResidentSeat, ResidentState } from '../game/residentBots';
import {
  BOT_COUNTER_ATTACK_META,
  getBotCombatReaction,
  getBotFightingState,
} from '../game/botFighting';
import { getSampledBotGlbPose } from '../game/botGlbMotionPlayer';
import { trafficColliders } from '../game/trafficColliders';

const kidCombatWorldScratch = new Vector3();

export interface KidBotRigHandles {
  root: Group | null;
  pelvis: Group | null;
  torso: Group | null;
  head: Group | null;
  leftArm: Group | null;
  rightArm: Group | null;
  leftForearm: Group | null;
  rightForearm: Group | null;
  // Boy articulated legs
  leftThigh: Group | null;
  rightThigh: Group | null;
  leftShin: Group | null;
  rightShin: Group | null;
  // Girl covered-dress feet & dress shells
  leftFoot: Group | null;
  rightFoot: Group | null;
  standDress: Group | null;
  sitDress: Group | null;
}

export function createEmptyKidHandles(): KidBotRigHandles {
  return {
    root: null,
    pelvis: null,
    torso: null,
    head: null,
    leftArm: null,
    rightArm: null,
    leftForearm: null,
    rightForearm: null,
    leftThigh: null,
    rightThigh: null,
    leftShin: null,
    rightShin: null,
    leftFoot: null,
    rightFoot: null,
    standDress: null,
    sitDress: null,
  };
}

/**
 * Per-frame playful kid animation driven by the single pooled useFrame loop in HouseResidentBots.
 */
export function applyKidBotPose(handles: KidBotRigHandles, state: ResidentState | null): void {
  const root = handles.root;
  if (!root) return;
  if (!state || !state.visible) {
    root.visible = false;
    return;
  }

  root.visible = true;
  root.position.set(state.x, state.y, state.z);
  root.rotation.y = state.yaw;

  const isBoy = state.role === 'boy';
  const sit = state.sitBlend;
  const reach = state.doorReachBlend;
  const walkFactor = Math.min(1, state.speed / 0.85) * (1 - sit);
  const stridePhase = state.walkDistance * 6.8;
  const bounce = Math.abs(Math.sin(stridePhase)) * 0.03 * walkFactor;
  const fidget = Math.sin(state.elapsed * 2.8 + (isBoy ? 0 : 1.7)) * 0.012;

  if (handles.pelvis) {
    handles.pelvis.position.y = 0.8 * (1 - sit) + 0.465 * sit + bounce;
    handles.pelvis.position.z = -0.02 * sit;
    handles.pelvis.rotation.z = Math.sin(stridePhase) * 0.03 * walkFactor;
  }

  if (handles.torso) {
    handles.torso.position.y = fidget;
    handles.torso.rotation.x = 0.04 * walkFactor + 0.06 * reach - 0.03 * sit;
  }

  // Curious playful head looking around & nodding
  if (handles.head) {
    const lookWave = Math.sin(state.elapsed * 1.15 + (isBoy ? 0.4 : 2.3)) * 0.28;
    const tilt = Math.sin(state.elapsed * 1.7 + (isBoy ? 0 : 1.2)) * 0.08;
    handles.head.rotation.y = lookWave * sit + Math.sin(state.elapsed * 1.3) * 0.09 * (1 - sit);
    handles.head.rotation.z = tilt * sit;
  }

  if (isBoy) {
    // Boy wears shorts: lively articulated running/walking legs & seated bend
    const swing = Math.sin(stridePhase) * 0.52 * walkFactor;
    const seatedThighRx = -1.46;
    const seatedShinRx = 1.46;
    if (handles.leftThigh) {
      handles.leftThigh.rotation.x = swing * (1 - sit) + seatedThighRx * sit;
    }
    if (handles.rightThigh) {
      handles.rightThigh.rotation.x = -swing * (1 - sit) + seatedThighRx * sit;
    }
    if (handles.leftShin) {
      handles.leftShin.rotation.x = Math.max(0, -swing) * 0.72 * (1 - sit) + seatedShinRx * sit;
    }
    if (handles.rightShin) {
      handles.rightShin.rotation.x = Math.max(0, swing) * 0.72 * (1 - sit) + seatedShinRx * sit;
    }
  } else {
    // Girl wears flared dress: coveredStride keeps legs cleanly inside her dress with zero clip
    const stride = coveredStride(stridePhase, walkFactor);
    const leftStepZ = Math.sin(stridePhase) * 0.095 * walkFactor;
    const rightStepZ = -leftStepZ;
    const leftLiftY = Math.max(0, Math.sin(stridePhase)) * 0.035 * walkFactor;
    const rightLiftY = Math.max(0, -Math.sin(stridePhase)) * 0.035 * walkFactor;

    if (handles.leftFoot) {
      handles.leftFoot.position.set(
        -0.082,
        leftLiftY * (1 - sit),
        leftStepZ * (1 - sit) + 0.28 * sit,
      );
      handles.leftFoot.rotation.x = stride * 0.7 * (1 - sit);
    }
    if (handles.rightFoot) {
      handles.rightFoot.position.set(
        0.082,
        rightLiftY * (1 - sit),
        rightStepZ * (1 - sit) + 0.28 * sit,
      );
      handles.rightFoot.rotation.x = -stride * 0.7 * (1 - sit);
    }
    if (handles.standDress) {
      const showStanding = sit < 0.45;
      handles.standDress.visible = showStanding;
      if (showStanding) {
        const crouch = 1 - sit * 0.3;
        handles.standDress.scale.set(0.8, 1.06 * crouch, 0.84);
        handles.standDress.position.y = bounce;
        handles.standDress.rotation.x = stride * 0.25;
      }
    }
    if (handles.sitDress) {
      handles.sitDress.visible = sit >= 0.45;
    }
  }

  // Playful arm swing when walking/running; relaxed lap/wave fidget when seated
  const armSwing = Math.sin(stridePhase) * 0.56 * walkFactor;
  const playWave = sit * Math.max(0, Math.sin(state.elapsed * 1.45 + (isBoy ? 0.5 : 2.6))) * 0.22;
  if (handles.leftArm) {
    handles.leftArm.rotation.x = -armSwing * (1 - sit) + (-0.32 - playWave * 0.5) * sit;
    handles.leftArm.rotation.z = 0.14 + 0.06 * sit;
  }
  if (handles.rightArm) {
    const baseRightX = armSwing * (1 - sit) + (-0.32 - playWave) * sit;
    handles.rightArm.rotation.x = baseRightX * (1 - reach) + -0.92 * reach;
    handles.rightArm.rotation.z = (-0.14 - 0.06 * sit) * (1 - reach) - 0.06 * reach;
  }
  if (handles.leftForearm) {
    handles.leftForearm.rotation.x = -0.26 * (1 - sit) + (-0.85 - playWave * 0.4) * sit;
  }
  if (handles.rightForearm) {
    const baseForearmX = -0.26 * (1 - sit) + (-0.85 - playWave * 0.7) * sit;
    handles.rightForearm.rotation.x = baseForearmX * (1 - reach) + -0.3 * reach;
  }

  if (handles.torso) {
    handles.torso.rotation.y = 0;
    handles.torso.rotation.z = 0;
  }
  if (handles.leftArm) handles.leftArm.rotation.y = 0;
  if (handles.rightArm) handles.rightArm.rotation.y = 0;
  if (handles.leftThigh) handles.leftThigh.rotation.z = 0;
  if (handles.rightThigh) handles.rightThigh.rotation.z = 0;

  // Zero-allocation GLB-driven combat pose & chase locomotion when sparring with the player
  const reaction = getBotCombatReaction(root.name);
  if (
    reaction &&
    (reaction.engaged ||
      reaction.hitTime > 0 ||
      reaction.knockoutTime > 0 ||
      reaction.attackMove !== null ||
      reaction.celebrateTime > 0)
  ) {
    if (reaction.hasWorldPos) {
      if (root.parent) {
        kidCombatWorldScratch.set(reaction.worldX, state.y, reaction.worldZ);
        root.parent.worldToLocal(kidCombatWorldScratch);
        root.position.x = kidCombatWorldScratch.x;
        root.position.z = kidCombatWorldScratch.z;
        if (Math.hypot(kidCombatWorldScratch.x, kidCombatWorldScratch.z) > 4.2) {
          root.position.y = 0;
        }
      } else {
        root.position.x = reaction.worldX;
        root.position.z = reaction.worldZ;
      }
    }

    const parentYaw = root.parent ? root.parent.rotation.y : 0;
    root.rotation.y = (reaction.chasing ? reaction.chaseYaw : reaction.facePlayerYaw) - parentYaw;
    if (handles.standDress) handles.standDress.visible = true;
    if (handles.sitDress) handles.sitDress.visible = false;

    const fight = getBotFightingState();
    const sharePrimaryGlb =
      fight.active &&
      (fight.targetBotId === root.name ||
        (reaction.celebrateTime > 0 && fight.botActiveGlbMotion === 'victory'));
    const glbPose = sharePrimaryGlb ? getSampledBotGlbPose() : null;

    if (reaction.chasing) {
      const phase = reaction.walkDistance * 5.6;
      const swing = Math.sin(phase);
      const lift = Math.abs(swing);
      if (handles.pelvis) {
        handles.pelvis.position.y = 0.8 + lift * 0.04;
        handles.pelvis.position.z = 0;
        handles.pelvis.rotation.z = swing * 0.04;
      }
      if (handles.torso) handles.torso.rotation.set(0.22, -swing * 0.14, 0);
      if (handles.leftArm) handles.leftArm.rotation.set(-0.65 - swing * 0.9, 0, 0.16);
      if (handles.rightArm) handles.rightArm.rotation.set(-0.65 + swing * 0.9, 0, -0.16);
      if (handles.leftForearm) handles.leftForearm.rotation.x = -1.2;
      if (handles.rightForearm) handles.rightForearm.rotation.x = -1.2;
      if (isBoy) {
        if (handles.leftThigh) handles.leftThigh.rotation.set(swing * 0.88, 0, 0);
        if (handles.rightThigh) handles.rightThigh.rotation.set(-swing * 0.88, 0, 0);
        if (handles.leftShin) handles.leftShin.rotation.x = Math.max(0.15, -swing * 1.1 + 0.3);
        if (handles.rightShin) handles.rightShin.rotation.x = Math.max(0.15, swing * 1.1 + 0.3);
      } else {
        if (handles.leftFoot) {
          handles.leftFoot.position.set(-0.082, Math.max(0, -swing) * 0.12, swing * 0.22);
          handles.leftFoot.rotation.x = -swing * 0.3;
        }
        if (handles.rightFoot) {
          handles.rightFoot.position.set(0.082, Math.max(0, swing) * 0.12, -swing * 0.22);
          handles.rightFoot.rotation.x = swing * 0.3;
        }
      }
    } else if (glbPose && glbPose.valid) {
      const yRatio = 0.8 / 0.84;
      if (handles.pelvis) {
        handles.pelvis.position.y = glbPose.pelvisY * yRatio;
        handles.pelvis.position.z = glbPose.pelvisZ;
        handles.pelvis.rotation.z = glbPose.pelvisRoll;
      }
      if (handles.torso) {
        handles.torso.rotation.set(glbPose.torsoPitch, glbPose.torsoYaw, glbPose.torsoRoll);
      }
      if (handles.head) {
        handles.head.rotation.x = glbPose.headPitch;
        handles.head.rotation.y = glbPose.headYaw;
      }
      if (handles.leftArm) {
        handles.leftArm.rotation.set(glbPose.leftArmX, glbPose.leftArmY, glbPose.leftArmZ);
      }
      if (handles.rightArm) {
        handles.rightArm.rotation.set(glbPose.rightArmX, glbPose.rightArmY, glbPose.rightArmZ);
      }
      if (handles.leftForearm) handles.leftForearm.rotation.x = glbPose.leftForearmX;
      if (handles.rightForearm) handles.rightForearm.rotation.x = glbPose.rightForearmX;
      if (isBoy) {
        if (handles.leftThigh) handles.leftThigh.rotation.set(glbPose.leftThighX, 0, glbPose.leftThighZ);
        if (handles.rightThigh) handles.rightThigh.rotation.set(glbPose.rightThighX, 0, glbPose.rightThighZ);
        if (handles.leftShin) handles.leftShin.rotation.x = glbPose.leftShinX;
        if (handles.rightShin) handles.rightShin.rotation.x = glbPose.rightShinX;
      } else {
        if (handles.leftFoot) {
          handles.leftFoot.position.set(-0.082, glbPose.leftFootY * yRatio, glbPose.leftFootZ);
          handles.leftFoot.rotation.x = -glbPose.leftFootZ * 0.85;
        }
        if (handles.rightFoot) {
          handles.rightFoot.position.set(0.082, glbPose.rightFootY * yRatio, glbPose.rightFootZ);
          handles.rightFoot.rotation.x = -glbPose.rightFootZ * 0.85;
        }
        if (handles.standDress) {
          const crouchRatio = Math.max(0.48, Math.min(1.06, glbPose.pelvisY / 0.84));
          handles.standDress.scale.set(0.8, 1.06 * crouchRatio, 0.84);
          handles.standDress.rotation.x =
            glbPose.proneFactor * 1.1 - Math.max(glbPose.leftFootZ, glbPose.rightFootZ) * 0.32;
        }
      }
    } else if (reaction.knockoutTime > 0) {
      if (handles.pelvis) {
        handles.pelvis.position.y = 0.28;
        handles.pelvis.rotation.z = 0.2;
      }
      if (handles.torso) handles.torso.rotation.x = -0.85;
      if (handles.leftArm) handles.leftArm.rotation.z = 0.6;
      if (handles.rightArm) handles.rightArm.rotation.z = -0.6;
    } else if (reaction.hitTime > 0) {
      const t = reaction.hitTime / Math.max(0.05, reaction.hitDuration);
      const snap = Math.sin(t * Math.PI) * reaction.hitStrength;
      if (handles.torso) handles.torso.rotation.x = -0.36 * snap;
      if (handles.head) handles.head.rotation.x = -0.3 * snap;
      if (handles.leftArm) {
        handles.leftArm.rotation.x = -0.6 - 0.3 * snap;
        handles.leftArm.rotation.z = 0.45 * snap + 0.15;
      }
      if (handles.rightArm) {
        handles.rightArm.rotation.x = -0.6 - 0.3 * snap;
        handles.rightArm.rotation.z = -0.45 * snap - 0.15;
      }
    } else if (reaction.attackMove) {
      const atkMeta = BOT_COUNTER_ATTACK_META[reaction.attackMove];
      const p = Math.min(1, reaction.attackElapsed / Math.max(0.08, reaction.attackDuration));
      const snap = Math.sin(p * Math.PI);
      if (atkMeta.kind === 'kick') {
        if (handles.torso) handles.torso.rotation.set(-0.2 * snap, 0.22 * snap, 0);
        if (isBoy && handles.rightThigh && handles.rightShin) {
          handles.rightThigh.rotation.set(-1.3 * snap, 0, 0);
          handles.rightShin.rotation.x = 0.2 * (1 - snap);
        } else if (handles.rightFoot) {
          handles.rightFoot.position.set(0.082, 0.42 * snap, 0.5 * snap);
        }
      } else {
        const rightLead = reaction.attackMove !== 'box_03';
        if (handles.torso) handles.torso.rotation.set(0.16 * snap, (rightLead ? -0.5 : 0.5) * snap, 0);
        if (handles.leftArm) handles.leftArm.rotation.set(rightLead ? -0.85 : -1.55 * snap - 0.4, 0, 0.18);
        if (handles.rightArm) handles.rightArm.rotation.set(rightLead ? -1.55 * snap - 0.4 : -0.85, 0, -0.18);
        if (handles.leftForearm) handles.leftForearm.rotation.x = rightLead ? -1.2 : -0.2;
        if (handles.rightForearm) handles.rightForearm.rotation.x = rightLead ? -0.2 : -1.2;
      }
    } else if (reaction.engaged) {
      const bob = Math.sin(reaction.elapsed * 7.2) * 0.025;
      if (handles.pelvis) handles.pelvis.position.y += bob;
      if (handles.leftArm) {
        handles.leftArm.rotation.x = -0.95;
        handles.leftArm.rotation.z = 0.2;
      }
      if (handles.rightArm) {
        handles.rightArm.rotation.x = -1.0;
        handles.rightArm.rotation.z = -0.2;
      }
      if (handles.leftForearm) handles.leftForearm.rotation.x = -1.15;
      if (handles.rightForearm) handles.rightForearm.rotation.x = -1.2;
    }
  }
}

/** Colorful low Myanmar kid stool (ခုံပုလေး) sharing flyweight unit geometries & cached materials. */
export function KidStool({
  seat,
  colorIndex = 0,
  visible = true,
}: {
  seat: ResidentSeat;
  colorIndex?: number;
  visible?: boolean;
}) {
  const res = getElderBotResourceCache();
  const topMat = res.kidStools[colorIndex % res.kidStools.length];
  const h = seat.seatHeight;

  return (
    <group
      name={seat.id}
      position={[seat.x, seat.floorY, seat.z]}
      visible={visible}
      userData={{ dynamic: true }}
      dispose={null}
    >
      {/* Round colorful stool seat */}
      <mesh
        geometry={res.geo.unitCyl}
        material={topMat}
        position={[0, h - 0.016, 0]}
        scale={[0.155, 0.032, 0.155]}
        castShadow
        receiveShadow
        dispose={null}
      />
      {/* 4 sturdy stool legs */}
      {[-0.085, 0.085].map((lx) =>
        [-0.085, 0.085].map((lz) => (
          <mesh
            key={`${lx}-${lz}`}
            geometry={res.geo.unitCyl}
            material={res.chairTeakDark}
            position={[lx, (h - 0.03) / 2, lz]}
            scale={[0.015, h - 0.03, 0.015]}
            dispose={null}
          />
        )),
      )}
    </group>
  );
}

export interface KidBotRigProps {
  role: 'boy' | 'girl';
  outfitIndex: number;
  skinIndex: number;
  heightScale: number;
  active?: boolean;
  name?: string;
  handlesRef: RefObject<KidBotRigHandles>;
}

/**
 * Memory-cached procedural Kid Bot Rig (ကလေး ယောကျ်ားလေး / မိန်းကလေး).
 * Swapping props only changes material references and scale — zero GPU allocations.
 */
export function KidBotRig({
  role,
  outfitIndex,
  skinIndex,
  heightScale,
  active = true,
  name,
  handlesRef,
}: KidBotRigProps) {
  const res = getElderBotResourceCache();
  const isBoy = role === 'boy';
  const outfit = isBoy
    ? res.boyOutfits[outfitIndex % res.boyOutfits.length]
    : res.girlOutfits[outfitIndex % res.girlOutfits.length];
  const skinMat = res.skins[skinIndex % res.skins.length];
  const hairMat = res.hairs[0]; // Youthful dark hair
  const rootRef = useRef<Group>(null);

  useEffect(() => {
    const obj = rootRef.current;
    if (!obj || !active) return;
    trafficColliders.set(obj, { width: 0.34, depth: 0.34, kind: 'robot' });
    return () => {
      trafficColliders.delete(obj);
    };
  }, [active]);

  const setHandle =
    <K extends keyof KidBotRigHandles>(key: K) =>
    (node: Group | null) => {
      if (handlesRef.current) handlesRef.current[key] = node;
    };

  return (
    <group
      ref={(node) => {
        (rootRef as { current: Group | null }).current = node;
        if (handlesRef.current) handlesRef.current.root = node;
      }}
      name={name ?? (isBoy ? 'kid-boy-bot' : 'kid-girl-bot')}
      visible={false}
      userData={{ dynamic: true, npcRole: role }}
      dispose={null}
    >
      <group scale={heightScale}>
        {/* Girl standing flared dress shell & covered feet */}
        {!isBoy && (
          <>
            <group ref={setHandle('standDress')} name="kid-girl-dress" scale={[0.8, 1.06, 0.84]}>
              <mesh
                geometry={res.geo.kidDressSkirt}
                material={outfit.bottom}
                castShadow
                receiveShadow
                dispose={null}
              />
            </group>
            {([-1, 1] as const).map((side) => (
              <group
                key={`gfoot-${side}`}
                ref={setHandle(side < 0 ? 'leftFoot' : 'rightFoot')}
                position={[side * 0.082, 0, 0]}
              >
                <mesh
                  geometry={res.geo.unitCyl}
                  material={skinMat}
                  position={[0, 0.12, 0]}
                  scale={[0.04, 0.16, 0.04]}
                  castShadow
                  dispose={null}
                />
                <mesh
                  geometry={res.geo.unitBox}
                  material={outfit.shoe}
                  position={[0, 0.025, 0.036]}
                  scale={[0.084, 0.05, 0.165]}
                  castShadow
                  dispose={null}
                />
              </group>
            ))}
          </>
        )}

        {/* Pelvis / Hip Root */}
        <group ref={setHandle('pelvis')} position={[0, 0.8, 0]}>
          {/* Waistband / shorts waist */}
          <mesh
            geometry={res.geo.unitCyl}
            material={outfit.bottom}
            position={[0, 0.01, 0]}
            scale={[0.162, 0.14, 0.145]}
            castShadow
            dispose={null}
          />
          {/* Girl waist ribbon bow */}
          {!isBoy && (
            <mesh
              geometry={res.geo.unitBox}
              material={outfit.ribbon}
              position={[0, 0.05, 0.135]}
              scale={[0.12, 0.036, 0.026]}
              dispose={null}
            />
          )}

          {/* Boy articulated shorts + legs + sneakers */}
          {isBoy &&
            ([-1, 1] as const).map((side) => (
              <group
                key={`bleg-${side}`}
                ref={setHandle(side < 0 ? 'leftThigh' : 'rightThigh')}
                position={[side * 0.082, 0, 0]}
              >
                {/* Shorts leg */}
                <mesh
                  geometry={res.geo.unitCyl}
                  material={outfit.bottom}
                  position={[0, -0.14, 0]}
                  scale={[0.068, 0.28, 0.068]}
                  castShadow
                  dispose={null}
                />
                {/* Lower thigh skin */}
                <mesh
                  geometry={res.geo.unitCyl}
                  material={skinMat}
                  position={[0, -0.32, 0]}
                  scale={[0.046, 0.12, 0.046]}
                  dispose={null}
                />
                {/* Knee & Shin */}
                <group
                  ref={setHandle(side < 0 ? 'leftShin' : 'rightShin')}
                  position={[0, -0.37, 0]}
                >
                  <mesh
                    geometry={res.geo.unitCyl}
                    material={skinMat}
                    position={[0, -0.19, 0]}
                    scale={[0.042, 0.38, 0.042]}
                    castShadow
                    dispose={null}
                  />
                  {/* Kid sneaker touching y = -0.43 (total = 0.80 => exact floor) */}
                  <mesh
                    geometry={res.geo.unitBox}
                    material={outfit.shoe}
                    position={[0, -0.4, 0.042]}
                    scale={[0.09, 0.06, 0.18]}
                    castShadow
                    dispose={null}
                  />
                  <mesh
                    geometry={res.geo.unitBox}
                    material={outfit.top}
                    position={[0, -0.39, 0.055]}
                    scale={[0.092, 0.018, 0.07]}
                    dispose={null}
                  />
                </group>
              </group>
            ))}

          {/* Girl seated dress lap drape */}
          {!isBoy && (
            <group ref={setHandle('sitDress')} visible={false}>
              <mesh
                geometry={res.geo.unitCyl}
                material={outfit.bottom}
                position={[0, -0.01, 0.16]}
                scale={[0.17, 0.36, 0.11]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                dispose={null}
              />
              <mesh
                geometry={res.geo.unitCyl}
                material={outfit.bottom}
                position={[0, -0.175, 0.31]}
                scale={[0.175, 0.31, 0.105]}
                castShadow
                dispose={null}
              />
            </group>
          )}

          {/* Kid Upper Body / Shirt or Blouse */}
          <group ref={setHandle('torso')} position={[0, 0.04, 0]}>
            <mesh
              geometry={res.geo.kidTorso}
              material={outfit.top}
              castShadow
              receiveShadow
              dispose={null}
            />
            {/* Cute shoulders */}
            <mesh
              geometry={res.geo.unitSphere}
              material={outfit.top}
              position={[0, 0.43, 0]}
              scale={[0.178, 0.062, 0.108]}
              castShadow
              dispose={null}
            />
            {/* Contrast collar (polo collar for boy / Peter-Pan collar for girl) */}
            <mesh
              geometry={res.geo.unitCyl}
              material={outfit.collar}
              position={[0, 0.485, 0.005]}
              scale={[0.088, 0.042, 0.088]}
              dispose={null}
            />
            {isBoy && (
              <mesh
                geometry={res.geo.unitBox}
                material={outfit.collar}
                position={[0, 0.32, 0.125]}
                scale={[0.22, 0.045, 0.012]}
                dispose={null}
              />
            )}

            {/* Neck */}
            <mesh
              geometry={res.geo.unitCyl}
              material={skinMat}
              position={[0, 0.535, 0]}
              scale={[0.052, 0.08, 0.052]}
              dispose={null}
            />

            {/* Short-sleeved Kid Arms */}
            {([-1, 1] as const).map((side) => (
              <group
                key={`karm-${side}`}
                ref={setHandle(side < 0 ? 'leftArm' : 'rightArm')}
                position={[side * 0.182, 0.43, 0]}
              >
                {/* Short sleeve */}
                <mesh
                  geometry={res.geo.upperSleeve}
                  scale={[0.92, 0.65, 0.92]}
                  material={outfit.top}
                  castShadow
                  dispose={null}
                />
                {/* Bare upper arm below short sleeve */}
                <mesh
                  geometry={res.geo.unitCyl}
                  material={skinMat}
                  position={[0, -0.195, 0]}
                  scale={[0.039, 0.12, 0.039]}
                  castShadow
                  dispose={null}
                />
                {/* Bare Forearm & Hand */}
                <group
                  ref={setHandle(side < 0 ? 'leftForearm' : 'rightForearm')}
                  position={[0, -0.245, 0]}
                >
                  <mesh
                    geometry={res.geo.unitCyl}
                    material={skinMat}
                    position={[0, -0.11, 0]}
                    scale={[0.034, 0.21, 0.034]}
                    castShadow
                    dispose={null}
                  />
                  <mesh
                    geometry={res.geo.unitSphere}
                    material={skinMat}
                    position={[0, -0.225, 0.006]}
                    scale={[0.036, 0.042, 0.028]}
                    dispose={null}
                  />
                </group>
              </group>
            ))}

            {/* Expressive Youthful Child Head (slightly bigger child proportion!) */}
            <group ref={setHandle('head')} position={[0, 0.685, 0.006]} scale={1.12}>
              <mesh
                geometry={res.geo.unitSphere}
                material={skinMat}
                scale={[0.128, 0.136, 0.128]}
                castShadow
                dispose={null}
              />

              {/* Ears */}
              {[-1, 1].map((side) => (
                <mesh
                  key={`kear-${side}`}
                  geometry={res.geo.unitSphere}
                  material={skinMat}
                  position={[side * 0.124, -0.01, -0.004]}
                  scale={[0.015, 0.026, 0.02]}
                  dispose={null}
                />
              ))}

              {/* Bright curious eyes */}
              {[-1, 1].map((side) => (
                <group key={`keye-${side}`} position={[side * 0.048, 0.014, 0.116]}>
                  <mesh
                    geometry={res.geo.unitSphere}
                    material={res.eyeWhite}
                    scale={[0.023, 0.02, 0.01]}
                    dispose={null}
                  />
                  <mesh
                    geometry={res.geo.unitSphere}
                    material={res.eyeDark}
                    position={[0, 0, 0.008]}
                    scale={[0.012, 0.013, 0.006]}
                    dispose={null}
                  />
                  <mesh
                    geometry={res.geo.unitBox}
                    material={hairMat}
                    position={[0, 0.032, 0.004]}
                    scale={[0.038, 0.007, 0.008]}
                    dispose={null}
                  />
                </group>
              ))}

              {/* Cute button nose & cheerful smile */}
              <mesh
                geometry={res.geo.unitSphere}
                material={skinMat}
                position={[0, -0.012, 0.128]}
                scale={[0.013, 0.013, 0.014]}
                dispose={null}
              />
              <mesh
                geometry={res.geo.unitBox}
                material={res.mouthAuntie}
                position={[0, -0.052, 0.118]}
                scale={[0.05, 0.011, 0.012]}
                dispose={null}
              />

              {isBoy ? (
                /* Boy youthful short hair with cute front fringe tuft */
                <group>
                  <mesh
                    geometry={res.geo.hairCapUncle}
                    material={hairMat}
                    position={[0, 0.038, -0.01]}
                    scale={[1.03, 0.9, 1.04]}
                    castShadow
                    dispose={null}
                  />
                  <mesh
                    geometry={res.geo.unitSphere}
                    material={hairMat}
                    position={[0.02, 0.115, 0.075]}
                    scale={[0.062, 0.034, 0.042]}
                    dispose={null}
                  />
                </group>
              ) : (
                /* Girl twin pigtails (ဆံပင် ၂ ဖက်စည်း) with matching ribbons + cute Thanaka cheeks */
                <group>
                  <mesh
                    geometry={res.geo.hairCapAuntie}
                    material={hairMat}
                    position={[0, 0.035, -0.012]}
                    scale={[1.03, 0.94, 1.04]}
                    castShadow
                    dispose={null}
                  />
                  {[-1, 1].map((side) => (
                    <group key={`pigtail-${side}`}>
                      {/* Twin side pigtails */}
                      <mesh
                        geometry={res.geo.unitSphere}
                        material={hairMat}
                        position={[side * 0.148, 0.042, -0.025]}
                        scale={[0.056, 0.068, 0.054]}
                        castShadow
                        dispose={null}
                      />
                      {/* Colorful hair ribbon matching her dress */}
                      <mesh
                        geometry={res.geo.unitSphere}
                        material={outfit.ribbon}
                        position={[side * 0.125, 0.075, -0.01]}
                        scale={[0.026, 0.022, 0.022]}
                        dispose={null}
                      />
                      {/* Cute Myanmar Thanaka cheek patches (သနပ်ခါးပါးကွက်) */}
                      <mesh
                        geometry={res.geo.unitBox}
                        material={res.thanaka}
                        position={[side * 0.072, -0.022, 0.104]}
                        rotation={[0, side * 0.5, 0]}
                        scale={[0.04, 0.032, 0.006]}
                        dispose={null}
                      />
                    </group>
                  ))}
                </group>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
