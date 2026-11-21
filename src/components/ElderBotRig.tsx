/**
 * Reusable flyweight Elder Bot Rig & Veranda Armchair shared by memory reference
 * between UShweCoupleBots and the pooled HouseResidentBots system.
 *
 * Every mesh uses shared BufferGeometry & cached MeshStandardMaterial instances from
 * `getElderBotResourceCache()` so mounting/reassigning pooled slots allocates ZERO
 * new geometries, textures, or materials.
 */

import { npcCalfGeometry, npcEyesGeometry, npcFaceMaterial, npcHandGeometry, npcShoeGeometry, npcSandalFootGeometry } from '../game/npcAnatomy';
import { useEffect, useRef, type RefObject } from 'react';
import { Vector3, type Group } from 'three';
import { getElderBotResourceCache } from '../game/elderBotResources';
import { coveredStride } from '../game/characterClothing';
import type { ResidentRole, ResidentSeat, ResidentState } from '../game/residentBots';
import {
  BOT_COUNTER_ATTACK_META,
  getBotCombatReaction,
  getBotFightingState,
} from '../game/botFighting';
import { getSampledBotGlbPose } from '../game/botGlbMotionPlayer';
import { trafficColliders } from '../game/trafficColliders';
import { mobileQuality } from '../game/sceneBudget';

const combatWorldScratch = new Vector3();

export interface ElderBotRigHandles {
  root: Group | null;
  pelvis: Group | null;
  torso: Group | null;
  head: Group | null;
  leftArm: Group | null;
  rightArm: Group | null;
  leftForearm: Group | null;
  rightForearm: Group | null;
  leftFoot: Group | null;
  rightFoot: Group | null;
  standLongyi: Group | null;
  sitLongyi: Group | null;
  leftThigh?: Group | null;
  rightThigh?: Group | null;
  leftShin?: Group | null;
  rightShin?: Group | null;
}

/**
 * Pure per-frame pose updater driven by the parent controller (single useFrame loop
 * per pool instead of hundreds of individual R3F subscriptions).
 */
export function applyElderBotPose(handles: ElderBotRigHandles, state: ResidentState | null): void {
  const root = handles.root;
  if (!root) return;
  if (!state || !state.visible) {
    root.visible = false;
    return;
  }

  root.visible = true;
  root.position.set(state.x, state.y, state.z);
  root.rotation.y = state.yaw;

  const isUncle = state.role === 'uncle';
  const sit = state.sitBlend;
  const reach = state.doorReachBlend;
  const walkFactor = Math.min(1, state.speed / 0.75) * (1 - sit);
  const stridePhase = state.walkDistance * 5.2;
  const stride = coveredStride(stridePhase, walkFactor);
  const armSwing = Math.sin(stridePhase) * 0.42 * walkFactor;
  const bounce = Math.abs(Math.sin(stridePhase)) * 0.018 * walkFactor;
  const breath = Math.sin(state.elapsed * 2.0 + (isUncle ? 0 : 1.4)) * 0.008;

  const seatedPelvisY = Math.max(0.35, Math.min(0.51, (state.seatHeight || 0.43) + 0.065));
  if (handles.pelvis) {
    handles.pelvis.position.y = 0.84 * (1 - sit) + seatedPelvisY * sit + bounce;
    handles.pelvis.position.z = -0.05 * sit;
    handles.pelvis.rotation.z = Math.sin(stridePhase) * 0.018 * walkFactor;
  }

  if (handles.torso) {
    handles.torso.position.y = breath;
    handles.torso.rotation.x = -0.07 * sit + 0.025 * walkFactor + 0.05 * reach;
  }

  if (handles.head) {
    const chatBase = isUncle ? 0.24 : -0.24;
    const chatWave = Math.sin(state.elapsed * 0.7 + (isUncle ? 0 : 2.1)) * 0.22;
    const nod = Math.sin(state.elapsed * 1.45 + (isUncle ? 0.5 : 2.8)) * 0.055;
    handles.head.rotation.y =
      (chatBase + chatWave) * sit + Math.sin(state.elapsed * 0.8) * 0.06 * (1 - sit);
    handles.head.rotation.x = nod * sit;
  }

  if (handles.leftThigh && handles.rightThigh && handles.leftShin && handles.rightShin) {
    // Articulated long trousers (ဘောင်းဘီရှည်): exact floor-contact IK on any chair height
    const thighSwing = Math.sin(stridePhase) * 0.44 * walkFactor;
    const liftRatio = Math.max(-0.2, Math.min(0.35, (0.44 - seatedPelvisY) / 0.4));
    const seatedThighRx = -Math.PI / 2 - Math.asin(liftRatio);
    const seatedShinRx = -seatedThighRx;
    handles.leftThigh.rotation.x = thighSwing * (1 - sit) + seatedThighRx * sit;
    handles.rightThigh.rotation.x = -thighSwing * (1 - sit) + seatedThighRx * sit;
    handles.leftShin.rotation.x = Math.max(0, -thighSwing) * 0.65 * (1 - sit) + seatedShinRx * sit;
    handles.rightShin.rotation.x = Math.max(0, thighSwing) * 0.65 * (1 - sit) + seatedShinRx * sit;
  }

  const leftStepZ = Math.sin(stridePhase) * 0.09 * walkFactor;
  const rightStepZ = -leftStepZ;
  const leftLiftY = Math.max(0, Math.sin(stridePhase)) * 0.032 * walkFactor;
  const rightLiftY = Math.max(0, -Math.sin(stridePhase)) * 0.032 * walkFactor;

  if (handles.leftFoot) {
    handles.leftFoot.position.set(
      -0.088,
      leftLiftY * (1 - sit),
      leftStepZ * (1 - sit) + 0.3 * sit,
    );
    handles.leftFoot.rotation.x = stride * 0.7 * (1 - sit);
  }
  if (handles.rightFoot) {
    handles.rightFoot.position.set(
      0.088,
      rightLiftY * (1 - sit),
      rightStepZ * (1 - sit) + 0.3 * sit,
    );
    handles.rightFoot.rotation.x = -stride * 0.7 * (1 - sit);
  }

  if (handles.standLongyi) {
    const showStanding = sit < 0.45;
    handles.standLongyi.visible = showStanding;
    if (showStanding) {
      const crouchScale = 1 - sit * 0.32;
      handles.standLongyi.scale.set(
        isUncle ? 0.84 : 0.78,
        1.12 * crouchScale,
        isUncle ? 0.9 : 0.88,
      );
      handles.standLongyi.position.y = bounce;
      handles.standLongyi.rotation.x = stride * 0.25;
    }
  }
  if (handles.sitLongyi) {
    handles.sitLongyi.visible = sit >= 0.45;
  }

  const gesture =
    sit * Math.max(0, Math.sin(state.elapsed * 0.95 + (isUncle ? 0 : 3.1))) * 0.16;
  if (handles.leftArm) {
    handles.leftArm.rotation.x =
      -armSwing * 0.55 * (1 - sit) + (-0.34 - gesture * 0.5) * sit;
    handles.leftArm.rotation.z = 0.09 + 0.07 * sit;
  }
  if (handles.rightArm) {
    const baseRightX = armSwing * 0.55 * (1 - sit) + (-0.34 - gesture) * sit;
    handles.rightArm.rotation.x = baseRightX * (1 - reach) + -0.82 * reach;
    handles.rightArm.rotation.z = (-0.09 - 0.07 * sit) * (1 - reach) - 0.05 * reach;
  }
  if (handles.leftForearm) {
    handles.leftForearm.rotation.x =
      -0.18 * (1 - sit) + (-0.98 - gesture * 0.4) * sit;
  }
  if (handles.rightForearm) {
    const baseForearmX = -0.18 * (1 - sit) + (-0.98 - gesture * 0.8) * sit;
    handles.rightForearm.rotation.x = baseForearmX * (1 - reach) + -0.32 * reach;
  }

  // Reset torso Y/Z and arm Y rotations from any prior combat frame
  if (handles.torso) {
    handles.torso.rotation.y = 0;
    handles.torso.rotation.z = 0;
  }
  if (handles.leftArm) handles.leftArm.rotation.y = 0;
  if (handles.rightArm) handles.rightArm.rotation.y = 0;
  if (handles.leftThigh) handles.leftThigh.rotation.z = 0;
  if (handles.rightThigh) handles.rightThigh.rotation.z = 0;

  // Zero-allocation GLB-driven combat pose & chase locomotion when fighting with the player
  const reaction = getBotCombatReaction(root.name);
  if (
    reaction &&
    (reaction.engaged ||
      reaction.hitTime > 0 ||
      reaction.knockoutTime > 0 ||
      reaction.attackMove !== null ||
      reaction.celebrateTime > 0)
  ) {
    // Sync live world chase/close-in XZ into parent's local coordinate frame
    if (reaction.hasWorldPos) {
      if (root.parent) {
        combatWorldScratch.set(reaction.worldX, state.y, reaction.worldZ);
        root.parent.worldToLocal(combatWorldScratch);
        root.position.x = combatWorldScratch.x;
        root.position.z = combatWorldScratch.z;
        // Drop smoothly to ground level when resident leaves elevated house porch
        if (Math.hypot(combatWorldScratch.x, combatWorldScratch.z) > 4.2) {
          root.position.y = 0;
        }
      } else {
        root.position.x = reaction.worldX;
        root.position.z = reaction.worldZ;
      }
    }

    const parentYaw = root.parent ? root.parent.rotation.y : 0;
    const targetLocalYaw = (reaction.chasing ? reaction.chaseYaw : reaction.facePlayerYaw) - parentYaw;
    root.rotation.y = targetLocalYaw;
    if (handles.standLongyi) handles.standLongyi.visible = true;
    if (handles.sitLongyi) handles.sitLongyi.visible = false;

    const fight = getBotFightingState();
    const sharePrimaryGlb =
      fight.active &&
      (fight.targetBotId === root.name ||
        (reaction.celebrateTime > 0 && fight.botActiveGlbMotion === 'victory'));
    const glbPose = sharePrimaryGlb ? getSampledBotGlbPose() : null;

    if (reaction.chasing) {
      // Brisk sprint chase animation while pursuing a fleeing player
      const phase = reaction.walkDistance * 5.2;
      const swing = Math.sin(phase);
      const lift = Math.abs(swing);
      if (handles.pelvis) {
        handles.pelvis.position.y = 0.84 + lift * 0.045;
        handles.pelvis.position.z = 0;
        handles.pelvis.rotation.z = swing * 0.04;
      }
      if (handles.torso) handles.torso.rotation.set(0.22, -swing * 0.14, 0);
      if (handles.head) handles.head.rotation.set(-0.1, 0, 0);
      if (handles.leftArm) handles.leftArm.rotation.set(-0.65 - swing * 0.95, 0, 0.16);
      if (handles.rightArm) handles.rightArm.rotation.set(-0.65 + swing * 0.95, 0, -0.16);
      if (handles.leftForearm) handles.leftForearm.rotation.x = -1.25;
      if (handles.rightForearm) handles.rightForearm.rotation.x = -1.25;
      if (handles.leftThigh && handles.rightThigh && handles.leftShin && handles.rightShin) {
        handles.leftThigh.rotation.set(swing * 0.88, 0, 0);
        handles.rightThigh.rotation.set(-swing * 0.88, 0, 0);
        handles.leftShin.rotation.x = Math.max(0.15, -swing * 1.15 + 0.35);
        handles.rightShin.rotation.x = Math.max(0.15, swing * 1.15 + 0.35);
      }
      if (handles.leftFoot) {
        handles.leftFoot.position.set(-0.088, Math.max(0, -swing) * 0.14, swing * 0.24);
        handles.leftFoot.rotation.x = -swing * 0.32;
      }
      if (handles.rightFoot) {
        handles.rightFoot.position.set(0.088, Math.max(0, swing) * 0.14, -swing * 0.24);
        handles.rightFoot.rotation.x = swing * 0.32;
      }
      if (handles.standLongyi) {
        handles.standLongyi.scale.set(isUncle ? 0.84 : 0.78, 1.12, isUncle ? 1.02 : 0.98);
        handles.standLongyi.position.y = 0;
        handles.standLongyi.rotation.x = 0.08;
      }
    } else if (glbPose && glbPose.valid) {
      // Apply REAL sampled GLB bone transforms (box_01/02/03, front_kick_01/02, warm_up, victory, hit/defeat)
      if (handles.pelvis) {
        handles.pelvis.position.y = glbPose.pelvisY;
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

      if (handles.leftThigh && handles.rightThigh && handles.leftShin && handles.rightShin) {
        handles.leftThigh.rotation.set(glbPose.leftThighX, 0, glbPose.leftThighZ);
        handles.rightThigh.rotation.set(glbPose.rightThighX, 0, glbPose.rightThighZ);
        handles.leftShin.rotation.x = glbPose.leftShinX;
        handles.rightShin.rotation.x = glbPose.rightShinX;
      }
      if (handles.leftFoot) {
        handles.leftFoot.position.set(-0.088, glbPose.leftFootY, glbPose.leftFootZ);
        handles.leftFoot.rotation.x = -glbPose.leftFootZ * 0.85;
      }
      if (handles.rightFoot) {
        handles.rightFoot.position.set(0.088, glbPose.rightFootY, glbPose.rightFootZ);
        handles.rightFoot.rotation.x = -glbPose.rightFootZ * 0.85;
      }
      if (handles.standLongyi) {
        const kickLift = Math.max(glbPose.leftFootY, glbPose.rightFootY);
        const crouchRatio = Math.max(0.45, Math.min(1.08, glbPose.pelvisY / 0.84));
        handles.standLongyi.scale.set(
          isUncle ? 0.84 : 0.78,
          1.12 * crouchRatio,
          isUncle ? 0.9 + kickLift * 0.22 : 0.88 + kickLift * 0.22,
        );
        handles.standLongyi.position.y = Math.max(0, glbPose.pelvisY - 0.84) * 0.5;
        handles.standLongyi.rotation.x =
          glbPose.proneFactor * 1.15 - Math.max(glbPose.leftFootZ, glbPose.rightFootZ) * 0.35;
      }
    } else if (reaction.knockoutTime > 0) {
      if (handles.pelvis) {
        handles.pelvis.position.y = 0.28;
        handles.pelvis.position.z = -0.18;
        handles.pelvis.rotation.z = 0.22;
      }
      if (handles.torso) handles.torso.rotation.x = -0.95;
      if (handles.head) handles.head.rotation.x = -0.35;
      if (handles.leftArm) {
        handles.leftArm.rotation.x = -0.35;
        handles.leftArm.rotation.z = 0.65;
      }
      if (handles.rightArm) {
        handles.rightArm.rotation.x = -0.35;
        handles.rightArm.rotation.z = -0.65;
      }
    } else if (reaction.hitTime > 0) {
      const t = reaction.hitTime / Math.max(0.05, reaction.hitDuration);
      const snap = Math.sin(t * Math.PI) * reaction.hitStrength;
      if (handles.pelvis) {
        handles.pelvis.position.z -= 0.14 * snap;
        handles.pelvis.rotation.z = (reaction.hitKind === 'kick' ? 0.14 : -0.12) * snap;
      }
      if (handles.torso) {
        handles.torso.rotation.x = (reaction.hitKind === 'kick' ? 0.42 : -0.38) * snap;
      }
      if (handles.head) {
        handles.head.rotation.x = -0.35 * snap;
        handles.head.rotation.y = 0.32 * snap;
      }
      if (handles.leftArm) {
        handles.leftArm.rotation.x = -0.5 - 0.35 * snap;
        handles.leftArm.rotation.z = 0.45 * snap + 0.15;
      }
      if (handles.rightArm) {
        handles.rightArm.rotation.x = -0.5 - 0.35 * snap;
        handles.rightArm.rotation.z = -0.45 * snap - 0.15;
      }
    } else if (reaction.attackMove) {
      // Independent defender close-quarters box / kick strike animation
      const atkMeta = BOT_COUNTER_ATTACK_META[reaction.attackMove];
      const p = Math.min(1, reaction.attackElapsed / Math.max(0.08, reaction.attackDuration));
      const snap = Math.sin(p * Math.PI);
      if (atkMeta.kind === 'kick') {
        if (handles.torso) handles.torso.rotation.set(-0.22 * snap, 0.25 * snap, 0);
        if (handles.leftArm) handles.leftArm.rotation.set(-0.95, 0, 0.35);
        if (handles.rightArm) handles.rightArm.rotation.set(-0.95, 0, -0.35);
        if (handles.leftForearm) handles.leftForearm.rotation.x = -1.2;
        if (handles.rightForearm) handles.rightForearm.rotation.x = -1.2;
        if (handles.rightThigh && handles.rightShin) {
          handles.rightThigh.rotation.set(-1.35 * snap, 0, 0);
          handles.rightShin.rotation.x = 0.25 * (1 - snap);
        }
        if (handles.rightFoot) {
          handles.rightFoot.position.set(0.088, 0.46 * snap, 0.56 * snap);
          handles.rightFoot.rotation.x = -0.55 * snap;
        }
      } else {
        const rightLead = reaction.attackMove !== 'box_03';
        if (handles.torso) handles.torso.rotation.set(0.18 * snap, (rightLead ? -0.55 : 0.55) * snap, 0);
        if (handles.leftArm) {
          handles.leftArm.rotation.set(rightLead ? -0.85 : -1.62 * snap - 0.4, 0, 0.18);
        }
        if (handles.rightArm) {
          handles.rightArm.rotation.set(rightLead ? -1.62 * snap - 0.4 : -0.85, 0, -0.18);
        }
        if (handles.leftForearm) handles.leftForearm.rotation.x = rightLead ? -1.2 : -0.18;
        if (handles.rightForearm) handles.rightForearm.rotation.x = rightLead ? -0.18 : -1.2;
      }
    } else if (reaction.engaged) {
      const bob = Math.sin(reaction.elapsed * 7.2) * 0.025;
      if (handles.pelvis) handles.pelvis.position.y += bob;
      if (handles.torso) handles.torso.rotation.x = 0.08;
      if (handles.leftArm) {
        handles.leftArm.rotation.x = -0.92 + bob * 3;
        handles.leftArm.rotation.z = 0.18;
      }
      if (handles.rightArm) {
        handles.rightArm.rotation.x = -0.98 - bob * 3;
        handles.rightArm.rotation.z = -0.18;
      }
      if (handles.leftForearm) handles.leftForearm.rotation.x = -1.18;
      if (handles.rightForearm) handles.rightForearm.rotation.x = -1.22;
    }
  }
}

/**
 * Shared flyweight wooden/rattan veranda armchair (all boxes share `unitBox` & cached teak materials).
 */
export function VerandaChair({
  seat,
  visible = true,
  dynamic = false,
}: {
  seat: ResidentSeat;
  visible?: boolean;
  dynamic?: boolean;
}) {
  const res = getElderBotResourceCache();
  const sY = seat.seatHeight;
  const seatW = 0.54;
  const seatD = 0.5;
  const legH = sY - 0.03;

  return (
    <group
      name={seat.id}
      position={[seat.x, seat.floorY, seat.z]}
      rotation={[0, seat.yaw, 0]}
      visible={visible}
      userData={dynamic ? { dynamic: true } : undefined}
      dispose={null}
    >
      {[-0.22, 0.22].map((lx) =>
        [-0.2, 0.2].map((lz) => (
          <mesh
            key={`${lx}-${lz}`}
            geometry={res.geo.unitBox}
            material={res.chairTeakMid}
            position={[lx, legH / 2, lz]}
            scale={[0.045, legH, 0.045]}
            castShadow
            receiveShadow
            dispose={null}
          />
        )),
      )}
      {[-0.22, 0.22].map((lx) => (
        <mesh
          key={`side-${lx}`}
          geometry={res.geo.unitBox}
          material={res.chairTeakDark}
          position={[lx, 0.14, 0]}
          scale={[0.03, 0.035, 0.4]}
          dispose={null}
        />
      ))}
      <mesh
        geometry={res.geo.unitBox}
        material={res.chairTeakDark}
        position={[0, 0.14, -0.2]}
        scale={[0.44, 0.035, 0.03]}
        dispose={null}
      />
      <mesh
        geometry={res.geo.unitBox}
        material={res.chairTeakFrame}
        position={[0, sY - 0.025, 0]}
        scale={[seatW, 0.05, seatD]}
        castShadow
        receiveShadow
        dispose={null}
      />
      <mesh
        geometry={res.geo.unitBox}
        material={res.chairRattan}
        position={[0, sY + 0.004, 0.005]}
        scale={[seatW - 0.08, 0.022, seatD - 0.08]}
        receiveShadow
        dispose={null}
      />
      <group position={[0, sY, -0.22]} rotation={[-0.14, 0, 0]}>
        {[-0.23, 0.23].map((bx) => (
          <mesh
            key={`stile-${bx}`}
            geometry={res.geo.unitBox}
            material={res.chairTeakMid}
            position={[bx, 0.28, 0]}
            scale={[0.045, 0.56, 0.042]}
            castShadow
            dispose={null}
          />
        ))}
        <mesh
          geometry={res.geo.unitBox}
          material={res.chairTeakFrame}
          position={[0, 0.54, 0]}
          scale={[0.52, 0.065, 0.045]}
          castShadow
          dispose={null}
        />
        {[-0.12, 0, 0.12].map((sx) => (
          <mesh
            key={`slat-${sx}`}
            geometry={res.geo.unitBox}
            material={res.chairSlat}
            position={[sx, 0.27, 0.004]}
            scale={[0.06, 0.44, 0.022]}
            dispose={null}
          />
        ))}
      </group>
      {[-0.255, 0.255].map((ax) => (
        <group key={`arm-${ax}`} position={[ax, sY, 0]}>
          <mesh
            geometry={res.geo.unitBox}
            material={res.chairTeakMid}
            position={[0, 0.11, 0.19]}
            scale={[0.04, 0.22, 0.04]}
            dispose={null}
          />
          <mesh
            geometry={res.geo.unitBox}
            material={res.chairTeakFrame}
            position={[0, 0.22, -0.01]}
            scale={[0.06, 0.036, 0.46]}
            castShadow
            dispose={null}
          />
        </group>
      ))}
    </group>
  );
}

export interface ElderBotRigProps {
  role: ResidentRole;
  outfitIndex: number;
  skinIndex: number;
  hairIndex: number;
  heightScale: number;
  /** Youthful parent / young adult styling (no grey temples, reading glasses, or silver streak). */
  youthful?: boolean;
  /** 'longyi' (traditional Paso/Htamein) or 'trousers' (full-length long pants + sneakers). */
  bottomStyle?: 'longyi' | 'trousers';
  active?: boolean;
  name?: string;
  handlesRef: RefObject<ElderBotRigHandles>;
}

/**
 * Memory-cached procedural Elder Bot Rig (ဦးလေး / ဒေါ်လေး / အဖေ / အမေ / အစ်ကိုကြီး).
 * Swapping `role`, `outfitIndex`, `skinIndex`, `hairIndex`, or `heightScale` merely updates
 * material references and group scale — zero new BufferGeometries or MeshStandardMaterials.
 */
export function ElderBotRig({
  role,
  outfitIndex,
  skinIndex,
  hairIndex,
  heightScale,
  youthful = false,
  bottomStyle = 'longyi',
  active = true,
  name,
  handlesRef,
}: ElderBotRigProps) {
  const res = getElderBotResourceCache();
  const isUncle = role === 'uncle';
  const wearsTrousers = bottomStyle === 'trousers';
  const outfit = isUncle
    ? res.uncleOutfits[outfitIndex % res.uncleOutfits.length]
    : res.auntieOutfits[outfitIndex % res.auntieOutfits.length];
  const skinMat = res.skins[skinIndex % res.skins.length];
  const hairMat = res.hairs[hairIndex % res.hairs.length];
  const mouthMat = isUncle ? res.mouthUncle : res.mouthAuntie;
  const rootRef = useRef<Group>(null);

  // Register collider ONLY while this pooled rig is actively assigned to a nearby house
  useEffect(() => {
    const obj = rootRef.current;
    if (!obj || !active) return;
    trafficColliders.set(obj, { width: 0.44, depth: 0.44, kind: 'robot' });
    return () => {
      trafficColliders.delete(obj);
    };
  }, [active]);

  const setHandle =
    <K extends keyof ElderBotRigHandles>(key: K) =>
    (node: Group | null) => {
      if (handlesRef.current) handlesRef.current[key] = node;
    };

  return (
    <group
      ref={(node) => {
        (rootRef as { current: Group | null }).current = node;
        if (handlesRef.current) handlesRef.current.root = node;
      }}
      name={name ?? (isUncle ? 'elder-uncle-bot' : 'elder-auntie-bot')}
      visible={false}
      userData={{ dynamic: true, npcRole: role }}
      dispose={null}
    >
      <group scale={heightScale}>
        {/* 1. Opaque Longyi / Htamein Shell & Covered Ankles (when wearing longyi) */}
        {!wearsTrousers && (
          <>
            <group
              ref={setHandle('standLongyi')}
              name="opaque-elder-longyi"
              scale={[isUncle ? 0.84 : 0.78, 1.12, isUncle ? 0.9 : 0.88]}
            >
              <mesh
                geometry={res.geo.longyiShell}
                material={outfit.longyi}
                castShadow
                receiveShadow
                dispose={null}
              />
            </group>

            {([-1, 1] as const).map((side) => (
              <group
                key={`foot-${side}`}
                ref={setHandle(side < 0 ? 'leftFoot' : 'rightFoot')}
                position={[side * 0.088, 0, 0]}
              >
                <mesh
                  geometry={npcCalfGeometry}
                  material={skinMat}
                  position={[0, 0.15, 0]}
                  scale={[0.96, 0.43, 0.96]}
                  castShadow
                  dispose={null}
                />
                <mesh
                  geometry={npcSandalFootGeometry}
                  material={skinMat}
                  position={[0, 0.01, 0]}
                  scale={1}
                  dispose={null}
                />
                <mesh
                  geometry={npcShoeGeometry}
                  material={outfit.sandal}
                  position={[0, 0, 0]}
                  scale={[0.93, 0.20, 0.97]}
                  castShadow
                  dispose={null}
                />
                <mesh
                  geometry={res.geo.unitBox}
                  material={outfit.sandal}
                  position={[0, 0.046, 0.055]}
                  scale={[0.082, 0.012, 0.04]}
                  dispose={null}
                />
              </group>
            ))}
          </>
        )}

        {/* 3. Pelvis, Trousers or Seated Longyi Drape, Tailored Upper Body & Head */}
        <group ref={setHandle('pelvis')} position={[0, 0.84, 0]}>
          <mesh
            geometry={res.geo.unitCyl}
            material={wearsTrousers ? res.trousersDark : outfit.longyi}
            position={[0, 0.015, 0]}
            scale={[isUncle ? 0.178 : 0.168, 0.14, isUncle ? 0.178 : 0.168]}
            castShadow
            dispose={null}
          />
          {wearsTrousers && (
            <>
              {/* Leather belt around trouser waist */}
              <mesh
                geometry={res.geo.unitCyl}
                material={res.chairTeakDark}
                position={[0, 0.068, 0]}
                scale={[0.181, 0.028, 0.16]}
                dispose={null}
              />
              {/* Articulated full-length trousers (ဘောင်းဘီရှည်) + sneakers */}
              {([-1, 1] as const).map((side) => (
                <group
                  key={`trouser-leg-${side}`}
                  name={side < 0 ? 'elder-trousers-left' : 'elder-trousers-right'}
                  ref={setHandle(side < 0 ? 'leftThigh' : 'rightThigh')}
                  position={[side * 0.088, 0, 0]}
                >
                  {/* Upper trouser thigh */}
                  <mesh
                    geometry={res.geo.unitCyl}
                    material={res.trousersDark}
                    position={[0, -0.2, 0]}
                    scale={[0.068, 0.4, 0.068]}
                    castShadow
                    dispose={null}
                  />
                  {/* Knee & lower trouser leg */}
                  <group
                    ref={setHandle(side < 0 ? 'leftShin' : 'rightShin')}
                    position={[0, -0.4, 0]}
                  >
                    <mesh
                      geometry={npcCalfGeometry}
                      material={res.trousersDark}
                      position={[0, 0, 0]}
                      scale={[1.24, 1.46, 1.24]}
                      castShadow
                      dispose={null}
                    />
                    {/* Casual sneaker touching exact floor y = -0.44 */}
                    <mesh
                      geometry={npcShoeGeometry}
                      material={res.sneakerWhite}
                      position={[0, -0.44, 0]}
                      scale={[0.96, 1, 1.02]}
                      castShadow
                      dispose={null}
                    />
                    <mesh
                      geometry={res.geo.unitSphere}
                      material={outfit.outerGarment}
                      position={[0, -0.386, 0.043]}
                      scale={[0.038, 0.008, 0.026]}
                      dispose={null}
                    />
                  </group>
                </group>
              ))}
            </>
          )}

          {/* Continuous Seated Longyi / Htamein Drape */}
          {!wearsTrousers && (
            <group ref={setHandle('sitLongyi')} visible={false}>
              <mesh
                geometry={res.geo.unitCyl}
                material={outfit.longyi}
                position={[0, -0.005, 0.175]}
                scale={[isUncle ? 0.182 : 0.168, 0.4, 0.122]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                dispose={null}
              />
              <mesh
                geometry={res.geo.unitSphere}
                material={outfit.longyi}
                position={[0, -0.02, 0.35]}
                scale={[isUncle ? 0.176 : 0.163, 0.109, 0.099]}
                castShadow
                dispose={null}
              />
              <mesh
                geometry={res.geo.unitCyl}
                material={outfit.longyi}
                position={[0, -0.195, 0.345]}
                scale={[isUncle ? 0.182 : 0.168, 0.35, 0.108]}
                castShadow
                dispose={null}
              />
              {!isUncle && (
                <mesh
                  geometry={res.geo.unitCyl}
                  material={outfit.longyiBand}
                  position={[0, -0.33, 0.345]}
                  scale={[0.178, 0.065, 0.114]}
                  dispose={null}
                />
              )}
            </group>
          )}

          {/* Upper Body / Tailored Traditional Clothes */}
          <group ref={setHandle('torso')} position={[0, 0.06, 0]}>
            {isUncle ? (
              <group name="uncle-taikpon-clothes">
                <mesh
                  geometry={res.geo.uncleTorso}
                  material={outfit.outerGarment}
                  castShadow
                  receiveShadow
                  dispose={null}
                />
                <mesh
                  geometry={res.geo.unitSphere}
                  material={outfit.outerGarment}
                  position={[0, 0.455, 0]}
                  scale={[0.218, 0.074, 0.129]}
                  castShadow
                  dispose={null}
                />
                {/* Crisp white inner shirt collar */}
                <mesh
                  geometry={res.geo.unitCyl}
                  material={outfit.innerShirt}
                  position={[0, 0.515, 0.005]}
                  scale={[0.086, 0.062, 0.086]}
                  dispose={null}
                />
                <mesh
                  geometry={res.geo.unitBox}
                  material={outfit.innerShirt}
                  position={[0, 0.455, 0.118]}
                  rotation={[-0.24, 0, 0]}
                  scale={[0.065, 0.095, 0.022]}
                  dispose={null}
                />
                {/* Center Taikpon front placket seam */}
                <mesh
                  geometry={res.geo.unitBox}
                  material={outfit.trim}
                  position={[0, 0.21, 0.138]}
                  scale={[0.024, 0.43, 0.012]}
                  dispose={null}
                />
                {/* 5 Traditional Burmese Taikpon knotted buttons */}
                {[0.38, 0.3, 0.22, 0.14, 0.06].map((by) => (
                  <group key={`btn-${by}`} position={[0, by, 0.146]}>
                    <mesh
                      geometry={res.geo.unitBox}
                      material={outfit.trim}
                      scale={[0.044, 0.008, 0.008]}
                      dispose={null}
                    />
                    <mesh
                      geometry={res.geo.unitSphere}
                      material={res.goldAccent}
                      scale={0.008}
                      dispose={null}
                    />
                  </group>
                ))}
                {/* 2 Tailored lower Taikpon patch pockets (omitted for casual belted-trouser shirt) */}
                {!wearsTrousers &&
                  [-0.092, 0.092].map((px) => (
                    <group
                      key={`pocket-${px}`}
                      position={[px, 0.08, 0.125]}
                      rotation={[0, px > 0 ? 0.38 : -0.38, 0]}
                    >
                      <mesh
                        geometry={res.geo.unitBox}
                        material={outfit.trim}
                        scale={[0.086, 0.092, 0.012]}
                        dispose={null}
                      />
                      <mesh
                        geometry={res.geo.unitBox}
                        material={outfit.outerGarment}
                        position={[0, 0.042, 0.004]}
                        scale={[0.088, 0.014, 0.01]}
                        dispose={null}
                      />
                    </group>
                  ))}
              </group>
            ) : (
              <group name="auntie-yinbone-clothes">
                <mesh
                  geometry={res.geo.auntieTorso}
                  material={outfit.outerGarment}
                  castShadow
                  receiveShadow
                  dispose={null}
                />
                <mesh
                  geometry={res.geo.unitSphere}
                  material={outfit.outerGarment}
                  position={[0, 0.455, 0]}
                  scale={[0.175, 0.063, 0.109]}
                  castShadow
                  dispose={null}
                />
                <mesh
                  geometry={res.geo.unitCyl}
                  material={outfit.innerShirt}
                  position={[0, 0.505, 0.006]}
                  scale={[0.078, 0.042, 0.078]}
                  dispose={null}
                />
                <mesh
                  geometry={res.geo.unitBox}
                  material={outfit.innerShirt}
                  position={[0.042, 0.36, 0.126]}
                  rotation={[0, 0.22, -0.45]}
                  scale={[0.016, 0.2, 0.012]}
                  dispose={null}
                />
                {[0.4, 0.33, 0.26].map((by, idx) => (
                  <mesh
                    key={by}
                    geometry={res.geo.unitSphere}
                    material={res.goldAccent}
                    position={[0.02 + idx * 0.026, by, 0.132]}
                    scale={0.008}
                    dispose={null}
                  />
                ))}
              </group>
            )}

            {/* Neck */}
            <mesh
              geometry={res.geo.unitCyl}
              material={skinMat}
              position={[0, 0.565, 0]}
              scale={[0.056, 0.09, 0.056]}
              dispose={null}
            />

            {/* Articulated Tailored Sleeves & Hands */}
            {([-1, 1] as const).map((side) => (
              <group
                key={`arm-${side}`}
                ref={setHandle(side < 0 ? 'leftArm' : 'rightArm')}
                position={[side * (isUncle ? 0.215 : 0.185), 0.455, 0]}
              >
                <mesh
                  geometry={res.geo.upperSleeve}
                  material={outfit.outerGarment}
                  castShadow
                  dispose={null}
                />
                <group
                  ref={setHandle(side < 0 ? 'leftForearm' : 'rightForearm')}
                  position={[0, -0.255, 0]}
                >
                  <mesh
                    geometry={res.geo.lowerSleeve}
                    scale={[1, isUncle ? 1.05 : 0.72, 1]}
                    material={outfit.outerGarment}
                    castShadow
                    dispose={null}
                  />
                  {isUncle && (
                    <mesh
                      geometry={res.geo.unitCyl}
                      material={outfit.innerShirt}
                      position={[0, -0.195, 0]}
                      scale={[0.039, 0.026, 0.039]}
                      dispose={null}
                    />
                  )}
                  <mesh
                    geometry={res.geo.unitCyl}
                    material={skinMat}
                    position={[0, isUncle ? -0.22 : -0.185, 0]}
                    scale={[0.032, isUncle ? 0.05 : 0.11, 0.032]}
                    castShadow
                    dispose={null}
                  />
                  <mesh
                    geometry={npcHandGeometry}
                    material={skinMat}
                    position={[0, -0.237, 0.005]}
                    scale={[side < 0 ? 0.88 : -0.88, 0.85, 0.93]}
                    dispose={null}
                  />
                </group>
              </group>
            ))}

            {/* Head & Expressive Elder Face */}
            <group ref={setHandle('head')} position={[0, 0.695, 0.008]}>
              <mesh
                geometry={res.geo.unitSphere}
                material={skinMat}
                scale={[0.125, 0.14, 0.129]}
                castShadow
                dispose={null}
              />

              {[-1, 1].map((side) => (
                <group key={`ear-${side}`} position={[side * 0.125, -0.01, -0.005]}>
                  <mesh
                    geometry={res.geo.unitSphere}
                    material={skinMat}
                    scale={[0.015, 0.028, 0.021]}
                    dispose={null}
                  />
                  {!isUncle && (
                    <mesh
                      geometry={res.geo.unitSphere}
                      material={res.goldAccent}
                      position={[0, -0.025, 0.005]}
                      scale={0.01}
                      dispose={null}
                    />
                  )}
                </group>
              ))}

              <mesh geometry={npcEyesGeometry} material={npcFaceMaterial} scale={0.85} position={[0, 0.005, -0.002]} dispose={null} />

              <mesh
                geometry={res.geo.unitSphere}
                material={skinMat}
                position={[0, -0.012, 0.132]}
                scale={[0.014, 0.019, 0.018]}
                dispose={null}
              />

              <mesh
                geometry={res.geo.unitBox}
                material={mouthMat}
                position={[0, -0.055, 0.12]}
                rotation={[0.1, 0, 0]}
                scale={[0.048, 0.01, 0.012]}
                dispose={null}
              />

              {isUncle ? (
                <group>
                  {!youthful && (
                    <mesh
                      geometry={res.geo.unitBox}
                      material={res.hairGrey}
                      position={[0, -0.036, 0.126]}
                      scale={[0.068, 0.016, 0.016]}
                      dispose={null}
                    />
                  )}
                  {!youthful && !mobileQuality && (
                    <group position={[0, 0.018, 0.134]}>
                      {[-0.046, 0.046].map((gx) => (
                        <mesh
                          key={gx}
                          geometry={res.geo.glassesLens}
                          material={res.goldAccent}
                          position={[gx, 0, 0]}
                          dispose={null}
                        />
                      ))}
                      <mesh
                        geometry={res.geo.unitBox}
                        material={res.goldAccent}
                        position={[0, 0.002, 0]}
                        scale={[0.036, 0.004, 0.004]}
                        dispose={null}
                      />
                    </group>
                  )}
                  <mesh
                    geometry={res.geo.hairCapUncle}
                    material={hairMat}
                    scale={[.87, .87, .89]}
                    castShadow
                    dispose={null}
                  />
                  {!youthful &&
                    [-1, 1].map((side) => (
                      <mesh
                        key={`temple-${side}`}
                        geometry={res.geo.unitBox}
                        material={res.hairGrey}
                        position={[side * 0.118, 0.035, 0.015]}
                        scale={[0.022, 0.045, 0.055]}
                        dispose={null}
                      />
                    ))}
                </group>
              ) : (
                <group>
                  {[-1, 1].map((side) => (
                    <mesh
                      key={`thanaka-${side}`}
                      geometry={res.geo.unitBox}
                      material={res.thanaka}
                      position={[side * 0.072, -0.022, 0.104]}
                      rotation={[0, side * 0.52, 0]}
                      scale={[0.042, 0.036, 0.006]}
                      dispose={null}
                    />
                  ))}
                  <mesh
                    geometry={res.geo.hairCapAuntie}
                    material={hairMat}
                    scale={[.87, .92, .89]}
                    castShadow
                    dispose={null}
                  />
                  {!youthful && (
                    <mesh
                      geometry={res.geo.unitSphere}
                      material={res.hairGrey}
                      position={[0, 0.133, 0.035]}
                      scale={[0.072, 0.022, 0.056]}
                      dispose={null}
                    />
                  )}
                  <mesh
                    geometry={res.geo.unitSphere}
                    material={hairMat}
                    position={[0, 0.02, -0.148]}
                    scale={[0.071, 0.063, 0.058]}
                    castShadow
                    dispose={null}
                  />
                  <mesh
                    geometry={res.geo.unitCyl}
                    material={res.goldAccent}
                    position={[0, 0.03, -0.155]}
                    rotation={[0, 0, 0.35]}
                    scale={[0.004, 0.17, 0.004]}
                    dispose={null}
                  />
                  <mesh
                    geometry={res.geo.unitSphere}
                    material={res.jasmine}
                    position={[0.058, 0.022, -0.132]}
                    scale={0.022}
                    dispose={null}
                  />
                </group>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
