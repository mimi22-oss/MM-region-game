/**
 * Singleton GLB Motion Player for Engaged Fighting Bots.
 *
 * Plays the REAL Mixamo GLB clips (`/motions/training/box_01.glb`, `box_02.glb`, `box_03.glb`,
 * `front_kick_01.glb`, `front_kick_02.glb`, `warm_up.glb`, `press_up.glb`, plus hit/defeat GLBs)
 * using Three.js `AnimationMixer` on the cached transform-only reference skeleton from `MotionLoader`,
 * then samples exact world-space bone directions into a reusable zero-allocation pose struct
 * consumed by `ElderBotRig`, `KidBotRig`, and `RobotBots`.
 *
 * Memory profile:
 * - 1 shared AnimationMixer (only for the 1 currently fighting bot)
 * - 0 new BufferGeometries, 0 new Materials, 0 new Textures (reuses `rawMotionCache`)
 * - 0 per-frame heap allocations inside `sampleBotGlbPose`
 */

import {
  AnimationAction,
  AnimationMixer,
  Euler,
  type Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { loadRawMotionAsset } from '../animation/core/MotionLoader.ts';
import type { MotionId } from '../animation/core/MotionRegistry.ts';

export const BOT_GLB_TRAINING_MOTIONS: readonly MotionId[] = [
  'box_01',
  'box_02',
  'box_03',
  'front_kick_01',
  'front_kick_02',
  'warm_up',
  'press_up',
];

export const BOT_GLB_REACTION_MOTIONS: readonly MotionId[] = [
  'hit_to_body_01',
  'hit_to_stomach',
  'defeat_02',
  'fall',
  'victory',
];

export interface SampledBotGlbPose {
  valid: boolean;
  motionId: MotionId | null;
  /** Pelvis world Y in bot local meters (rest ≈ 0.84m). */
  pelvisY: number;
  pelvisZ: number;
  pelvisRoll: number;
  /** Torso Euler angles (rad). */
  torsoPitch: number;
  torsoYaw: number;
  torsoRoll: number;
  /** Head Euler angles (rad). */
  headPitch: number;
  headYaw: number;
  /** Left & Right upper arm Euler XYZ (rad, rest = hanging down along -Y). */
  leftArmX: number;
  leftArmY: number;
  leftArmZ: number;
  rightArmX: number;
  rightArmY: number;
  rightArmZ: number;
  /** Elbow flexion (rad, negative = natural forward bend). */
  leftForearmX: number;
  rightForearmX: number;
  /** Thigh Euler XYZ (rad, rest = hanging down along -Y). */
  leftThighX: number;
  leftThighZ: number;
  rightThighX: number;
  rightThighZ: number;
  /** Knee flexion (rad, positive = natural backward bend). */
  leftShinX: number;
  rightShinX: number;
  /** Foot offsets for longyi/dress rigs (meters relative to standing rest). */
  leftFootY: number;
  leftFootZ: number;
  rightFootY: number;
  rightFootZ: number;
  /** Proneness factor (0 = standing, 1 = push-up / knocked down). */
  proneFactor: number;
}

interface JointSet {
  hips: Object3D | null;
  spine2: Object3D | null;
  head: Object3D | null;
  lArm: Object3D | null;
  lFore: Object3D | null;
  lHand: Object3D | null;
  rArm: Object3D | null;
  rFore: Object3D | null;
  rHand: Object3D | null;
  lUpLeg: Object3D | null;
  lLeg: Object3D | null;
  lFoot: Object3D | null;
  rUpLeg: Object3D | null;
  rLeg: Object3D | null;
  rFoot: Object3D | null;
  restHipsY: number;
  restHipsZ: number;
  restLFootY: number;
  restLFootZ: number;
  restRFootY: number;
  restRFootZ: number;
}

interface ActiveSlot {
  motionId: MotionId;
  root: Object3D;
  mixer: AnimationMixer;
  action: AnimationAction;
  joints: JointSet;
}

const slots = new Map<MotionId, ActiveSlot>();
const loading = new Set<MotionId>();
let currentSlot: ActiveSlot | null = null;
let currentClipKey = '';
let preloaded = false;

// Reusable scratch math objects (zero per-frame allocations)
const vHips = new Vector3();
const vSpine2 = new Vector3();
const vHead = new Vector3();
const vLArm = new Vector3();
const vLFore = new Vector3();
const vLHand = new Vector3();
const vRArm = new Vector3();
const vRFore = new Vector3();
const vRHand = new Vector3();
const vLUpLeg = new Vector3();
const vLLeg = new Vector3();
const vLFoot = new Vector3();
const vRUpLeg = new Vector3();
const vRLeg = new Vector3();
const vRFoot = new Vector3();
const vDirA = new Vector3();
const vDirB = new Vector3();
const vDirLocal = new Vector3();
const vShoulderAxis = new Vector3();
const qTorso = new Quaternion();
const qInvTorso = new Quaternion();
const qLimb = new Quaternion();
const eTmp = new Euler(0, 0, 0, 'XYZ');
const DOWN = new Vector3(0, -1, 0);

const sampledPose: SampledBotGlbPose = {
  valid: false,
  motionId: null,
  pelvisY: 0.84,
  pelvisZ: 0,
  pelvisRoll: 0,
  torsoPitch: 0,
  torsoYaw: 0,
  torsoRoll: 0,
  headPitch: 0,
  headYaw: 0,
  leftArmX: 0,
  leftArmY: 0,
  leftArmZ: 0.1,
  rightArmX: 0,
  rightArmY: 0,
  rightArmZ: -0.1,
  leftForearmX: -0.2,
  rightForearmX: -0.2,
  leftThighX: 0,
  leftThighZ: 0,
  rightThighX: 0,
  rightThighZ: 0,
  leftShinX: 0,
  rightShinX: 0,
  leftFootY: 0,
  leftFootZ: 0,
  rightFootY: 0,
  rightFootZ: 0,
  proneFactor: 0,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mirrorX(v: Vector3): Vector3 {
  v.x = -v.x;
  return v;
}

function readWorldMirrored(node: Object3D | null, out: Vector3): boolean {
  if (!node) return false;
  node.getWorldPosition(out);
  mirrorX(out);
  return true;
}

function resolveJoints(root: Object3D): JointSet {
  const nodes: Object3D[] = [];
  root.traverse((o) => {
    if (o.name) nodes.push(o);
  });
  const find = (re: RegExp) => nodes.find((n) => re.test(n.name)) ?? null;
  root.updateMatrixWorld(true);

  const hips = find(/hips$/i);
  const spine2 = find(/spine2$/i) ?? find(/spine1$/i) ?? find(/spine$/i);
  const head = find(/head$/i);
  const lArm = find(/leftarm$/i);
  const lFore = find(/leftforearm$/i);
  const lHand = find(/lefthand$/i);
  const rArm = find(/rightarm$/i);
  const rFore = find(/rightforearm$/i);
  const rHand = find(/righthand$/i);
  const lUpLeg = find(/leftupleg$/i);
  const lLeg = find(/leftleg$/i);
  const lFoot = find(/leftfoot$/i);
  const rUpLeg = find(/rightupleg$/i);
  const rLeg = find(/rightleg$/i);
  const rFoot = find(/rightfoot$/i);

  const tmp = new Vector3();
  const restHipsY = hips ? Math.max(0.25, hips.getWorldPosition(tmp).y) : 0.47;
  const restHipsZ = hips ? hips.getWorldPosition(tmp).z : 0;
  const restLFootY = lFoot ? lFoot.getWorldPosition(tmp).y : 0.068;
  const restLFootZ = lFoot ? lFoot.getWorldPosition(tmp).z : 0;
  const restRFootY = rFoot ? rFoot.getWorldPosition(tmp).y : 0.068;
  const restRFootZ = rFoot ? rFoot.getWorldPosition(tmp).z : 0;

  return {
    hips,
    spine2,
    head,
    lArm,
    lFore,
    lHand,
    rArm,
    rFore,
    rHand,
    lUpLeg,
    lLeg,
    lFoot,
    rUpLeg,
    rLeg,
    rFoot,
    restHipsY,
    restHipsZ,
    restLFootY,
    restLFootZ,
    restRFootY,
    restRFootZ,
  };
}

function ensureMotionLoaded(motionId: MotionId): ActiveSlot | null {
  const existing = slots.get(motionId);
  if (existing) return existing;
  if (loading.has(motionId)) return null;

  loading.add(motionId);
  loadRawMotionAsset(motionId)
    .then((asset) => {
      // Clone transform-only lightweight skeleton so each cached clip has its own clean rest pose
      const root = asset.scene.clone(true);
      const joints = resolveJoints(root);
      const mixer = new AnimationMixer(root);
      const action = mixer.clipAction(asset.clip);
      action.enabled = true;
      action.play();
      slots.set(motionId, { motionId, root, mixer, action, joints });
    })
    .catch((err) => {
      console.warn(`[BotGlbMotionPlayer] Failed to load ${motionId}:`, err);
    })
    .finally(() => {
      loading.delete(motionId);
    });
  return null;
}

/** Lazily preloads all 7 training GLBs + reaction GLBs once the first bot fight starts. */
export function preloadBotGlbMotions(): void {
  if (preloaded) return;
  preloaded = true;
  for (const id of BOT_GLB_TRAINING_MOTIONS) ensureMotionLoaded(id);
  for (const id of BOT_GLB_REACTION_MOTIONS) ensureMotionLoaded(id);
}

/**
 * Evaluates a GLB motion clip at `(timeSec, speed, loop)` and populates the singleton
 * `SampledBotGlbPose` directly from the GLB's animated Mixamo bones.
 */
export function stepBotGlbMotionPlayer(
  motionId: MotionId | null,
  clipSeq: number,
  dt: number,
  speed = 2.0,
  loop = false,
): SampledBotGlbPose {
  if (!motionId) {
    sampledPose.valid = false;
    sampledPose.motionId = null;
    currentSlot = null;
    currentClipKey = '';
    return sampledPose;
  }

  preloadBotGlbMotions();
  const slot = ensureMotionLoaded(motionId);
  if (!slot) {
    sampledPose.valid = false;
    sampledPose.motionId = null;
    return sampledPose;
  }

  const clipKey = `${motionId}:${clipSeq}`;
  if (clipKey !== currentClipKey || currentSlot !== slot) {
    currentClipKey = clipKey;
    currentSlot = slot;
    slot.action.reset();
    slot.action.setLoop(loop ? 2201 /* LoopRepeat */ : 2200 /* LoopOnce */, loop ? Infinity : 1);
    slot.action.clampWhenFinished = !loop;
    slot.action.timeScale = speed;
    slot.action.play();
    slot.mixer.update(0.001);
  } else {
    slot.action.timeScale = speed;
    slot.mixer.update(Math.max(0, Math.min(dt, 0.08)));
  }

  slot.root.updateMatrixWorld(true);
  extractPoseFromJoints(slot.joints, motionId, sampledPose);
  return sampledPose;
}

/**
 * Extracts exact joint Euler angles & foot offsets from the animated Mixamo skeleton.
 * Exported for unit tests so GLB bone sampling can be verified deterministically in Node.
 */
export function extractPoseFromJoints(
  j: JointSet,
  motionId: MotionId,
  out: SampledBotGlbPose,
): void {
  if (!readWorldMirrored(j.hips, vHips)) {
    out.valid = false;
    return;
  }

  const scale = 0.84 / j.restHipsY;
  out.valid = true;
  out.motionId = motionId;
  out.pelvisY = clamp(vHips.y * scale, 0.16, 1.06);
  out.pelvisZ = clamp((vHips.z - j.restHipsZ) * scale, -0.35, 0.35);

  // Spine / Torso vector (hips -> spine2)
  let torsoPitch = 0;
  let torsoRoll = 0;
  let torsoYaw = 0;
  if (readWorldMirrored(j.spine2, vSpine2)) {
    vDirA.subVectors(vSpine2, vHips).normalize();
    torsoPitch = Math.atan2(vDirA.z, Math.max(0.05, vDirA.y));
    torsoRoll = -Math.atan2(vDirA.x, Math.hypot(vDirA.y, vDirA.z));
  }

  // Shoulder twist (leftArm -> rightArm after X mirror: rightArm is +X, leftArm is -X)
  const hasLArm = readWorldMirrored(j.lArm, vLArm);
  const hasRArm = readWorldMirrored(j.rArm, vRArm);
  if (hasLArm && hasRArm) {
    vShoulderAxis.subVectors(vRArm, vLArm);
    const planar = Math.hypot(vShoulderAxis.x, vShoulderAxis.z);
    if (planar > 0.01) {
      torsoYaw = clamp(Math.atan2(-vShoulderAxis.z, Math.max(0.02, vShoulderAxis.x)), -0.95, 0.95);
    }
  }

  // Detect push-up / prone pose from low hip height & horizontal spine
  const prone = clamp((0.52 - out.pelvisY) / 0.28, 0, 1);
  out.proneFactor = prone;
  out.pelvisRoll = clamp(torsoRoll * 0.45, -0.45, 0.45);
  out.torsoPitch = clamp(torsoPitch, -0.75, 1.45);
  out.torsoYaw = torsoYaw;
  out.torsoRoll = clamp(torsoRoll * 0.65, -0.55, 0.55);

  // Head look relative to torso
  if (readWorldMirrored(j.head, vHead) && j.spine2) {
    vDirA.subVectors(vHead, vSpine2).normalize();
    out.headPitch = clamp(Math.atan2(vDirA.z, Math.max(0.05, vDirA.y)) - out.torsoPitch * 0.65, -0.55, 0.55);
    out.headYaw = clamp(-out.torsoYaw * 0.5, -0.5, 0.5);
  } else {
    out.headPitch = 0;
    out.headYaw = 0;
  }

  // Inverse torso quaternion to compute torso-local arm directions cleanly
  eTmp.set(out.torsoPitch, out.torsoYaw, out.torsoRoll, 'XYZ');
  qTorso.setFromEuler(eTmp);
  qInvTorso.copy(qTorso).invert();

  // Left arm & forearm
  if (hasLArm && readWorldMirrored(j.lFore, vLFore)) {
    vDirA.subVectors(vLFore, vLArm).normalize();
    vDirLocal.copy(vDirA).applyQuaternion(qInvTorso).normalize();
    qLimb.setFromUnitVectors(DOWN, vDirLocal);
    eTmp.setFromQuaternion(qLimb, 'XYZ');
    out.leftArmX = clamp(eTmp.x, -2.6, 1.6);
    out.leftArmY = clamp(eTmp.y, -1.2, 1.2);
    out.leftArmZ = clamp(eTmp.z, -1.2, 1.4);

    if (readWorldMirrored(j.lHand, vLHand)) {
      vDirB.subVectors(vLHand, vLFore).normalize();
      const bend = Math.acos(clamp(vDirA.dot(vDirB), -1, 1));
      out.leftForearmX = clamp(-bend, -2.2, -0.05);
    } else {
      out.leftForearmX = -0.35;
    }
  }

  // Right arm & forearm
  if (hasRArm && readWorldMirrored(j.rFore, vRFore)) {
    vDirA.subVectors(vRFore, vRArm).normalize();
    vDirLocal.copy(vDirA).applyQuaternion(qInvTorso).normalize();
    qLimb.setFromUnitVectors(DOWN, vDirLocal);
    eTmp.setFromQuaternion(qLimb, 'XYZ');
    out.rightArmX = clamp(eTmp.x, -2.6, 1.6);
    out.rightArmY = clamp(eTmp.y, -1.2, 1.2);
    out.rightArmZ = clamp(eTmp.z, -1.4, 1.2);

    if (readWorldMirrored(j.rHand, vRHand)) {
      vDirB.subVectors(vRHand, vRFore).normalize();
      const bend = Math.acos(clamp(vDirA.dot(vDirB), -1, 1));
      out.rightForearmX = clamp(-bend, -2.2, -0.05);
    } else {
      out.rightForearmX = -0.35;
    }
  }

  // Left thigh, shin & foot
  if (readWorldMirrored(j.lUpLeg, vLUpLeg) && readWorldMirrored(j.lLeg, vLLeg)) {
    vDirA.subVectors(vLLeg, vLUpLeg).normalize();
    qLimb.setFromUnitVectors(DOWN, vDirA);
    eTmp.setFromQuaternion(qLimb, 'XYZ');
    out.leftThighX = clamp(eTmp.x, -2.15, 1.2);
    out.leftThighZ = clamp(eTmp.z, -0.75, 0.75);
    if (readWorldMirrored(j.lFoot, vLFoot)) {
      vDirB.subVectors(vLFoot, vLLeg).normalize();
      out.leftShinX = clamp(Math.acos(clamp(vDirA.dot(vDirB), -1, 1)), 0, 2.25);
      out.leftFootY = clamp((vLFoot.y - j.restLFootY) * scale, 0, 1.15);
      out.leftFootZ = clamp((vLFoot.z - j.restLFootZ) * scale, -0.5, 0.95);
    }
  }

  // Right thigh, shin & foot
  if (readWorldMirrored(j.rUpLeg, vRUpLeg) && readWorldMirrored(j.rLeg, vRLeg)) {
    vDirA.subVectors(vRLeg, vRUpLeg).normalize();
    qLimb.setFromUnitVectors(DOWN, vDirA);
    eTmp.setFromQuaternion(qLimb, 'XYZ');
    out.rightThighX = clamp(eTmp.x, -2.15, 1.2);
    out.rightThighZ = clamp(eTmp.z, -0.75, 0.75);
    if (readWorldMirrored(j.rFoot, vRFoot)) {
      vDirB.subVectors(vRFoot, vRLeg).normalize();
      out.rightShinX = clamp(Math.acos(clamp(vDirA.dot(vDirB), -1, 1)), 0, 2.25);
      out.rightFootY = clamp((vRFoot.y - j.restRFootY) * scale, 0, 1.15);
      out.rightFootZ = clamp((vRFoot.z - j.restRFootZ) * scale, -0.5, 0.95);
    }
  }
}

export function getSampledBotGlbPose(): SampledBotGlbPose {
  return sampledPose;
}

/** Helper used by tests to inspect/resolve joints from a raw GLTF scene. */
export function buildJointSetForTesting(root: Object3D): JointSet {
  return resolveJoints(root);
}
