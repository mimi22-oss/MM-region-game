import type { Group } from 'three';
import {
  BOT_COUNTER_ATTACK_META,
  getBotCombatReaction,
  getBotFightingState,
} from './botFighting.ts';
import { getSampledBotGlbPose } from './botGlbMotionPlayer.ts';
import type { WeipulaVillagerKind } from './weipulaVillagers.ts';

export interface ChinCombatRigHandles {
  root: Group | null;
  body?: Group | null;
  head: Group | null;
  leftArm: Group | null;
  rightArm: Group | null;
  leftLeg: Group | null;
  rightLeg: Group | null;
}

/** Maps a Chin villager kind to the standard npcRole consumed by `Player.tsx` & `botFighting.ts`. */
export function chinKindToNpcRole(
  kind: WeipulaVillagerKind,
  slotIndex = 0,
): 'uncle' | 'auntie' | 'boy' | 'girl' {
  if (kind === 'chin-kid') return slotIndex % 2 === 0 ? 'boy' : 'girl';
  if (kind === 'chin-woman' || kind === 'nurse') return 'auntie';
  return 'uncle';
}

/**
 * Shared zero-allocation combat pose applicator for articulated Chin villager rigs.
 * Reuses the existing `botFighting.ts` + `botGlbMotion.ts` state directly — ZERO duplicated
 * fighting, HP, chase, combo, or collision logic!
 *
 * Returns `true` if the bot is currently in combat (and its transform/pose was driven here).
 */
export function applyChinBotCombatPose(
  handles: ChinCombatRigHandles,
  botId: string,
  groundY: number,
): boolean {
  const root = handles.root;
  if (!root) return false;

  const reaction = getBotCombatReaction(botId);
  if (
    !reaction ||
    !(
      reaction.engaged ||
      reaction.hitTime > 0 ||
      reaction.knockoutTime > 0 ||
      reaction.attackMove !== null ||
      reaction.celebrateTime > 0
    )
  ) {
    if (handles.body) {
      handles.body.position.set(0, 0, 0);
      handles.body.rotation.set(0, 0, 0);
    }
    if (handles.leftArm) handles.leftArm.rotation.y = 0;
    if (handles.rightArm) handles.rightArm.rotation.y = 0;
    return false;
  }

  root.visible = true;
  if (reaction.hasWorldPos) {
    root.position.set(reaction.worldX, groundY, reaction.worldZ);
  }
  root.rotation.y = reaction.chasing ? reaction.chaseYaw : reaction.facePlayerYaw;

  const body = handles.body ?? null;
  if (body) {
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
  }

  const fight = getBotFightingState();
  const sharePrimaryGlb =
    fight.active &&
    (fight.targetBotId === botId ||
      (reaction.celebrateTime > 0 && fight.botActiveGlbMotion === 'victory'));
  const glbPose = sharePrimaryGlb ? getSampledBotGlbPose() : null;

  if (reaction.chasing) {
    const phase = reaction.walkDistance * 5.2;
    const swing = Math.sin(phase);
    const lift = Math.abs(swing);
    root.position.y = groundY + lift * 0.045;
    if (body) body.rotation.set(0.18, -swing * 0.14, swing * 0.04);
    if (handles.head) handles.head.rotation.set(-0.1, 0, 0);
    if (handles.leftArm) handles.leftArm.rotation.set(-0.65 - swing * 0.95, 0, 0.16);
    if (handles.rightArm) handles.rightArm.rotation.set(-0.65 + swing * 0.95, 0, -0.16);
    if (handles.leftLeg) handles.leftLeg.rotation.x = swing * 0.85;
    if (handles.rightLeg) handles.rightLeg.rotation.x = -swing * 0.85;
  } else if (glbPose && glbPose.valid) {
    // Apply the exact same sampled GLB combat transforms (box_01/02/03, front_kick_01/02, warm_up, victory, hit, defeat)
    const pelvisOffset = glbPose.pelvisY - 0.84;
    if (body) {
      body.position.set(0, pelvisOffset, glbPose.pelvisZ);
      body.rotation.set(glbPose.torsoPitch, glbPose.torsoYaw, glbPose.pelvisRoll + glbPose.torsoRoll);
    } else {
      root.position.y = groundY + pelvisOffset;
    }
    if (handles.head) handles.head.rotation.set(glbPose.headPitch, glbPose.headYaw, 0);
    if (handles.leftArm) handles.leftArm.rotation.set(glbPose.leftArmX, glbPose.leftArmY, glbPose.leftArmZ);
    if (handles.rightArm) handles.rightArm.rotation.set(glbPose.rightArmX, glbPose.rightArmY, glbPose.rightArmZ);
    if (handles.leftLeg) handles.leftLeg.rotation.set(glbPose.leftThighX, 0, glbPose.leftThighZ);
    if (handles.rightLeg) handles.rightLeg.rotation.set(glbPose.rightThighX, 0, glbPose.rightThighZ);
  } else if (reaction.knockoutTime > 0) {
    if (body) {
      body.position.set(0, -0.52, -0.18);
      body.rotation.set(-1.15, 0, 0.22);
    } else {
      root.position.y = groundY - 0.3;
    }
    if (handles.head) handles.head.rotation.set(-0.35, 0, 0);
    if (handles.leftArm) handles.leftArm.rotation.set(-0.35, 0, 0.65);
    if (handles.rightArm) handles.rightArm.rotation.set(-0.35, 0, -0.65);
    if (handles.leftLeg) handles.leftLeg.rotation.x = 0.25;
    if (handles.rightLeg) handles.rightLeg.rotation.x = -0.15;
  } else if (reaction.hitTime > 0) {
    const t = reaction.hitTime / Math.max(0.05, reaction.hitDuration);
    const snap = Math.sin(t * Math.PI) * reaction.hitStrength;
    if (body) {
      body.position.set(0, 0, -0.14 * snap);
      body.rotation.set(
        (reaction.hitKind === 'kick' ? 0.42 : -0.38) * snap,
        0,
        (reaction.hitKind === 'kick' ? 0.14 : -0.12) * snap,
      );
    }
    if (handles.head) handles.head.rotation.set(-0.35 * snap, 0.32 * snap, 0);
    if (handles.leftArm) handles.leftArm.rotation.set(-0.5 - 0.35 * snap, 0, 0.45 * snap + 0.15);
    if (handles.rightArm) handles.rightArm.rotation.set(-0.5 - 0.35 * snap, 0, -0.45 * snap - 0.15);
  } else if (reaction.attackMove) {
    const atkMeta = BOT_COUNTER_ATTACK_META[reaction.attackMove];
    const p = Math.min(1, reaction.attackElapsed / Math.max(0.08, reaction.attackDuration));
    const snap = Math.sin(p * Math.PI);
    if (atkMeta.kind === 'kick') {
      if (body) body.rotation.set(-0.22 * snap, 0.25 * snap, 0);
      if (handles.leftArm) handles.leftArm.rotation.set(-0.95, 0, 0.35);
      if (handles.rightArm) handles.rightArm.rotation.set(-0.95, 0, -0.35);
      if (handles.rightLeg) handles.rightLeg.rotation.set(-1.35 * snap, 0, 0);
      if (handles.leftLeg) handles.leftLeg.rotation.set(0.15 * snap, 0, 0);
    } else {
      const rightLead = reaction.attackMove !== 'box_03';
      if (body) body.rotation.set(0.18 * snap, (rightLead ? -0.55 : 0.55) * snap, 0);
      if (handles.leftArm) handles.leftArm.rotation.set(rightLead ? -0.85 : -1.62 * snap - 0.4, 0, 0.18);
      if (handles.rightArm) handles.rightArm.rotation.set(rightLead ? -1.62 * snap - 0.4 : -0.85, 0, -0.18);
    }
  } else if (reaction.engaged) {
    const bob = Math.sin(reaction.elapsed * 7.2) * 0.025;
    root.position.y = groundY + bob;
    if (body) body.rotation.set(0.08, 0, 0);
    if (handles.leftArm) handles.leftArm.rotation.set(-0.92 + bob * 3, 0, 0.18);
    if (handles.rightArm) handles.rightArm.rotation.set(-0.98 - bob * 3, 0, -0.18);
    if (handles.leftLeg) handles.leftLeg.rotation.x = 0.12;
    if (handles.rightLeg) handles.rightLeg.rotation.x = -0.12;
  }

  return true;
}
