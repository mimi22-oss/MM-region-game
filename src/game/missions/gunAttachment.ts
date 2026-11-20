import {
  Bone,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three';
import { createLimbFitter } from '../characterRig.ts';
import { getSpecialActionState } from '../specialActions.ts';
import { belongsToAvatar, findSwordHand } from './ghostSwordAttachment.ts';

export { belongsToAvatar, findSwordHand };

const LEFT_HAND_NAMES = ['mixamorigLeftHand', 'equipment-left-hand', 'Hand_L'];
const LEFT_FINGER_PREFIXES = [
  'mixamorigLeftHandIndex',
  'mixamorigLeftHandMiddle',
  'mixamorigLeftHandRing',
  'mixamorigLeftHandPinky',
];

export function findSupportHand(avatar: Object3D): Object3D | null {
  for (const name of LEFT_HAND_NAMES) {
    const hand = avatar.getObjectByName(name);
    if (hand) return hand;
  }
  return null;
}

/**
 * Calibrate once or per-frame at attachment: point the gun barrel (-Z) along the avatar's forward (-Z)
 * with the sights upright (+Y).
 */
export function gunGripRotation(hand: Object3D, avatar: Object3D): Quaternion {
  const facing = avatar.getWorldQuaternion(new Quaternion());
  return hand.getWorldQuaternion(new Quaternion()).invert().multiply(facing);
}

interface SupportIKCache {
  readonly rightArm: Bone | null;
  readonly rightForeArm: Bone | null;
  readonly rightHand: Bone | null;
  readonly fitRight: ((targetWorld: Vector3, poleWorld: Vector3) => void) | null;
  readonly leftArm: Bone;
  readonly leftForeArm: Bone;
  readonly leftHand: Bone;
  readonly leftMiddle1: Object3D | null;
  readonly fingerBones: Bone[];
  readonly fit: (targetWorld: Vector3, poleWorld: Vector3) => void;
}

const supportIkCache = new WeakMap<Object3D, SupportIKCache | null>();
const scratchTarget = new Vector3();
const scratchPalm = new Vector3();
const scratchHandWorld = new Vector3();
const scratchAvatarQuat = new Quaternion();
const scratchPole = new Vector3();
const scratchRightPole = new Vector3();
const scratchHandQuat = new Quaternion();
const scratchParentQuat = new Quaternion();
const scratchFingerCurl = new Quaternion();
const scratchRightPos = new Vector3();
const scratchLeftPos = new Vector3();

function getSupportIk(avatar: Object3D): SupportIKCache | null {
  if (supportIkCache.has(avatar)) {
    return supportIkCache.get(avatar) ?? null;
  }
  const rightArm = (avatar.getObjectByName('mixamorigRightArm') ??
    avatar.getObjectByName('UpperArm_R')) as Bone | null;
  const rightForeArm = (avatar.getObjectByName('mixamorigRightForeArm') ??
    avatar.getObjectByName('Forearm_R')) as Bone | null;
  const rightHand = (avatar.getObjectByName('mixamorigRightHand') ??
    avatar.getObjectByName('Hand_R')) as Bone | null;

  const leftArm = (avatar.getObjectByName('mixamorigLeftArm') ??
    avatar.getObjectByName('UpperArm_L')) as Bone | null;
  const leftForeArm = (avatar.getObjectByName('mixamorigLeftForeArm') ??
    avatar.getObjectByName('Forearm_L')) as Bone | null;
  const leftHand = (avatar.getObjectByName('mixamorigLeftHand') ??
    avatar.getObjectByName('Hand_L')) as Bone | null;

  if (!leftArm || !leftForeArm || !leftHand) {
    supportIkCache.set(avatar, null);
    return null;
  }

  const leftMiddle1 = avatar.getObjectByName('mixamorigLeftHandMiddle1') ?? null;
  const fingerBones: Bone[] = [];
  for (const prefix of LEFT_FINGER_PREFIXES) {
    for (const idx of ['1', '2', '3']) {
      const b = avatar.getObjectByName(`${prefix}${idx}`);
      if (b instanceof Bone) fingerBones.push(b);
    }
  }

  const entry: SupportIKCache = {
    rightArm,
    rightForeArm,
    rightHand,
    fitRight:
      rightArm && rightForeArm && rightHand
        ? createLimbFitter(rightArm, rightForeArm, rightHand)
        : null,
    leftArm,
    leftForeArm,
    leftHand,
    leftMiddle1,
    fingerBones,
    fit: createLimbFitter(leftArm, leftForeArm, leftHand),
  };
  supportIkCache.set(avatar, entry);
  return entry;
}

/**
 * Keeps the gun barrel pointing 100% straight ahead (`[0, 0, -1]` in avatar space, zero slant)
 * without altering the Right Arm's authored animation from `shooting.glb`, `gun-idle.glb`, or
 * `gun-hold-walking.glb`, and locks the Left Support Hand palm onto the gun.
 */
export function fitSupportHandToGun(avatar: Object3D, gunRoot: Object3D): boolean {
  const ik = getSupportIk(avatar);
  const foregrip = gunRoot.getObjectByName('gun-foregrip-hold');
  if (!ik || !foregrip) return false;

  avatar.getWorldQuaternion(scratchAvatarQuat);

  // 1. Keep the gun 100% straight ahead along the character's forward (-Z) direction (never slanted!)
  //    while preserving 100% of the Right Arm's authored animation from shooting.glb / gun-idle.glb.
  if (gunRoot.parent) {
    gunRoot.quaternion.copy(gunGripRotation(gunRoot.parent, avatar));
  }

  gunRoot.updateWorldMatrix(true, false);
  const isShootingClip = getSpecialActionState().activeActionId === 'shooting';
  if (isShootingClip && gunRoot.parent) {
    // In shooting.glb both arms extend forward together in a two-handed grip near the receiver/trigger
    gunRoot.parent.getWorldPosition(scratchTarget);
    scratchRightPole.set(-0.025, -0.01, -0.08).applyQuaternion(scratchAvatarQuat);
    scratchTarget.add(scratchRightPole);
  } else {
    foregrip.getWorldPosition(scratchTarget);
  }

  // If the target exceeds 95% of the left arm's reach, slide it back along the straight gun axis
  const leftShoulderPos = ik.leftArm.getWorldPosition(scratchLeftPos);
  const upperLen = leftShoulderPos.distanceTo(ik.leftForeArm.getWorldPosition(scratchHandWorld));
  const lowerLen = ik.leftForeArm
    .getWorldPosition(scratchHandWorld)
    .distanceTo(ik.leftHand.getWorldPosition(scratchRightPos));
  const maxReach = (upperLen + lowerLen) * 0.95;
  const distToForegrip = leftShoulderPos.distanceTo(scratchTarget);
  if (distToForegrip > maxReach && gunRoot.parent) {
    const gripPos = gunRoot.parent.getWorldPosition(scratchRightPos);
    const pullT = Math.min(0.9, (distToForegrip - maxReach) / Math.max(0.05, scratchTarget.distanceTo(gripPos)));
    scratchTarget.lerp(gripPos, pullT);
  }

  // 2. Account for wrist-to-palm offset after rotating the hand so the palm center (Middle1) touches the gun
  scratchHandQuat
    .copy(scratchAvatarQuat)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.35))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -1.15));

  if (ik.leftMiddle1) {
    const localMid = ik.leftHand.worldToLocal(ik.leftMiddle1.getWorldPosition(scratchPalm));
    const handScale = ik.leftHand.getWorldScale(new Vector3());
    localMid.multiply(handScale).applyQuaternion(scratchHandQuat);
    scratchTarget.sub(localMid);
  }

  scratchPole.set(-0.55, -0.75, 0.35).applyQuaternion(scratchAvatarQuat);
  ik.fit(scratchTarget, scratchPole);

  if (ik.leftHand.parent) {
    ik.leftHand.parent.getWorldQuaternion(scratchParentQuat);
    ik.leftHand.quaternion.copy(scratchParentQuat.invert().multiply(scratchHandQuat));
  }

  // 3. Curl left-hand fingers around the grip
  scratchFingerCurl.setFromAxisAngle(new Vector3(0, 0, 1), -0.52);
  for (let i = 0; i < ik.fingerBones.length; i++) {
    ik.fingerBones[i].quaternion.multiply(scratchFingerCurl);
  }

  ik.leftArm.updateMatrixWorld(true);
  return true;
}

/**
 * Builds a procedural 3D Tactical Carbine / SMG Gun model in pure Three.js code
 * with both a rear pistol grip (Right Hand) and a front handguard/foregrip (Left Hand).
 * Later a GLB can be swapped in while preserving 'gun-muzzle-tip' and 'gun-foregrip-hold'.
 */
export function createProceduralGunModel(held = true): Group {
  const root = new Group();
  root.name = 'procedural-tactical-gun';
  const scale = held ? 1.15 : 2.1;
  root.scale.setScalar(scale);

  const gripMat = new MeshStandardMaterial({
    color: '#1c1f24',
    metalness: 0.25,
    roughness: 0.78,
  });
  const gripPanelMat = new MeshStandardMaterial({
    color: '#111317',
    metalness: 0.15,
    roughness: 0.9,
  });
  const receiverMat = new MeshStandardMaterial({
    color: '#2c333f',
    metalness: 0.74,
    roughness: 0.32,
  });
  const slideMat = new MeshStandardMaterial({
    color: '#434d5e',
    metalness: 0.85,
    roughness: 0.22,
  });
  const barrelMat = new MeshStandardMaterial({
    color: '#16191f',
    metalness: 0.92,
    roughness: 0.18,
  });
  const sightMat = new MeshBasicMaterial({ color: '#22c55e' });
  const laserLensMat = new MeshBasicMaterial({ color: '#ef4444' });

  // 1. Rear Ergonomic Pistol Grip (origin is right inside the Right Hand palm)
  const gripGroup = new Group();
  gripGroup.name = 'gun-grip';
  gripGroup.position.set(0, -0.02, 0.015);
  gripGroup.rotation.x = -0.24;

  const gripCore = new Mesh(new BoxGeometry(0.036, 0.135, 0.052), gripMat);
  const gripPanels = new Mesh(new BoxGeometry(0.039, 0.105, 0.038), gripPanelMat);
  const magBase = new Mesh(new BoxGeometry(0.04, 0.016, 0.058), barrelMat);
  magBase.position.set(0, -0.072, 0.002);
  gripGroup.add(gripCore, gripPanels, magBase);
  root.add(gripGroup);

  // Rear Tactical Stock Brace
  const stockTube = new Mesh(new CylinderGeometry(0.014, 0.014, 0.12, 10), receiverMat);
  stockTube.rotation.x = Math.PI / 2;
  stockTube.position.set(0, 0.062, 0.095);
  const stockButt = new Mesh(new BoxGeometry(0.034, 0.095, 0.024), gripMat);
  stockButt.position.set(0, 0.045, 0.155);
  root.add(stockTube, stockButt);

  // 2. Lower Receiver, Magazine & Trigger Guard
  const receiver = new Mesh(new BoxGeometry(0.042, 0.04, 0.31), receiverMat);
  receiver.name = 'gun-receiver';
  receiver.position.set(0, 0.048, -0.115);
  root.add(receiver);

  const frontMag = new Mesh(new BoxGeometry(0.028, 0.13, 0.044), gripPanelMat);
  frontMag.position.set(0, -0.025, -0.115);
  frontMag.rotation.x = 0.14;
  root.add(frontMag);

  const triggerGuardBottom = new Mesh(new BoxGeometry(0.022, 0.008, 0.058), receiverMat);
  triggerGuardBottom.position.set(0, 0.004, -0.035);
  const triggerGuardFront = new Mesh(new BoxGeometry(0.022, 0.032, 0.008), receiverMat);
  triggerGuardFront.position.set(0, 0.018, -0.062);
  const trigger = new Mesh(new BoxGeometry(0.01, 0.024, 0.009), barrelMat);
  trigger.position.set(0, 0.02, -0.028);
  trigger.rotation.x = 0.35;
  root.add(triggerGuardBottom, triggerGuardFront, trigger);

  // 3. Upper Metallic Slide / Rail & Ejection Port
  const slide = new Mesh(new BoxGeometry(0.044, 0.044, 0.33), slideMat);
  slide.name = 'gun-slide';
  slide.position.set(0, 0.086, -0.122);
  root.add(slide);

  const ejectionPort = new Mesh(new BoxGeometry(0.046, 0.018, 0.052), barrelMat);
  ejectionPort.position.set(0.002, 0.091, -0.075);
  root.add(ejectionPort);

  // 4. Front Tactical Foregrip & Handguard (where the Left Support Hand holds the gun!)
  const foregrip = new Mesh(new BoxGeometry(0.032, 0.1, 0.038), gripMat);
  foregrip.name = 'gun-foregrip';
  foregrip.position.set(0, -0.012, -0.185);
  foregrip.rotation.x = -0.1;
  root.add(foregrip);

  const foregripHoldAnchor = new Group();
  foregripHoldAnchor.name = 'gun-foregrip-hold';
  foregripHoldAnchor.position.set(-0.025, -0.015, -0.165);
  root.add(foregripHoldAnchor);

  // 5. Rifled Barrel & Muzzle Compensator
  const barrel = new Mesh(new CylinderGeometry(0.013, 0.013, 0.16, 12), barrelMat);
  barrel.name = 'gun-barrel';
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.084, -0.345);
  root.add(barrel);

  const muzzleTip = new Mesh(new CylinderGeometry(0.017, 0.017, 0.038, 12), receiverMat);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.084, -0.415);
  root.add(muzzleTip);

  // 6. Under-barrel Tactical Laser Module
  const laserBox = new Mesh(new BoxGeometry(0.03, 0.024, 0.076), gripMat);
  laserBox.name = 'gun-laser-module';
  laserBox.position.set(0, 0.024, -0.255);
  const laserLens = new Mesh(new CylinderGeometry(0.006, 0.006, 0.006, 10), laserLensMat);
  laserLens.rotation.x = Math.PI / 2;
  laserLens.position.set(0, 0.024, -0.295);
  root.add(laserBox, laserLens);

  // 7. Glowing Tactical Front & Rear Sights
  const rearSightL = new Mesh(new BoxGeometry(0.008, 0.01, 0.012), sightMat);
  rearSightL.position.set(-0.011, 0.112, 0.032);
  const rearSightR = new Mesh(new BoxGeometry(0.008, 0.01, 0.012), sightMat);
  rearSightR.position.set(0.011, 0.112, 0.032);
  const frontSight = new Mesh(new BoxGeometry(0.008, 0.012, 0.014), sightMat);
  frontSight.position.set(0, 0.113, -0.265);
  root.add(rearSightL, rearSightR, frontSight);

  // 8. Muzzle Anchor for Bullet Tracers & Muzzle Fire VFX
  const muzzleAnchor = new Group();
  muzzleAnchor.name = 'gun-muzzle-tip';
  muzzleAnchor.position.set(0, 0.084, -0.44);
  root.add(muzzleAnchor);

  return root;
}
