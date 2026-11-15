/**
 * Canonical bone mapping and hierarchical limb definitions for shared humanoid motions.
 * Handles Mixamo prefix variants (`mixamorig:`, `mixamorig9:`, `Armature|`) and end effectors
 * across rigs with differing joint subsets (e.g. 65-joint Boy vs 54-joint + 11-end-node Girl).
 */

export const CANONICAL_BONE_PREFIX = 'mixamorig';

export const MIXAMO_ROOT_BONE = 'mixamorigHips';

/** Ordered parent -> child directional chains used for top-down rest-pose alignment. */
export const HIERARCHICAL_LIMB_CHAINS: ReadonlyArray<ReadonlyArray<string>> = [
  // Torso & head axis
  ['mixamorigSpine', 'mixamorigSpine1'],
  ['mixamorigSpine1', 'mixamorigSpine2'],
  ['mixamorigSpine2', 'mixamorigNeck'],
  ['mixamorigNeck', 'mixamorigHead'],
  ['mixamorigHead', 'mixamorigHeadTop_End'],

  // Left arm & wrist
  ['mixamorigLeftShoulder', 'mixamorigLeftArm'],
  ['mixamorigLeftArm', 'mixamorigLeftForeArm'],
  ['mixamorigLeftForeArm', 'mixamorigLeftHand'],
  ['mixamorigLeftHand', 'mixamorigLeftHandMiddle1'],

  // Right arm & wrist
  ['mixamorigRightShoulder', 'mixamorigRightArm'],
  ['mixamorigRightArm', 'mixamorigRightForeArm'],
  ['mixamorigRightForeArm', 'mixamorigRightHand'],
  ['mixamorigRightHand', 'mixamorigRightHandMiddle1'],

  // Left leg & foot
  ['mixamorigLeftUpLeg', 'mixamorigLeftLeg'],
  ['mixamorigLeftLeg', 'mixamorigLeftFoot'],
  ['mixamorigLeftFoot', 'mixamorigLeftToeBase'],
  ['mixamorigLeftToeBase', 'mixamorigLeftToe_End'],

  // Right leg & foot
  ['mixamorigRightUpLeg', 'mixamorigRightLeg'],
  ['mixamorigRightLeg', 'mixamorigRightFoot'],
  ['mixamorigRightFoot', 'mixamorigRightToeBase'],
  ['mixamorigRightToeBase', 'mixamorigRightToe_End'],

  // Left fingers
  ['mixamorigLeftHandThumb1', 'mixamorigLeftHandThumb2'],
  ['mixamorigLeftHandThumb2', 'mixamorigLeftHandThumb3'],
  ['mixamorigLeftHandThumb3', 'mixamorigLeftHandThumb4'],
  ['mixamorigLeftHandIndex1', 'mixamorigLeftHandIndex2'],
  ['mixamorigLeftHandIndex2', 'mixamorigLeftHandIndex3'],
  ['mixamorigLeftHandIndex3', 'mixamorigLeftHandIndex4'],
  ['mixamorigLeftHandMiddle1', 'mixamorigLeftHandMiddle2'],
  ['mixamorigLeftHandMiddle2', 'mixamorigLeftHandMiddle3'],
  ['mixamorigLeftHandMiddle3', 'mixamorigLeftHandMiddle4'],
  ['mixamorigLeftHandRing1', 'mixamorigLeftHandRing2'],
  ['mixamorigLeftHandRing2', 'mixamorigLeftHandRing3'],
  ['mixamorigLeftHandRing3', 'mixamorigLeftHandRing4'],
  ['mixamorigLeftHandPinky1', 'mixamorigLeftHandPinky2'],
  ['mixamorigLeftHandPinky2', 'mixamorigLeftHandPinky3'],
  ['mixamorigLeftHandPinky3', 'mixamorigLeftHandPinky4'],

  // Right fingers
  ['mixamorigRightHandThumb1', 'mixamorigRightHandThumb2'],
  ['mixamorigRightHandThumb2', 'mixamorigRightHandThumb3'],
  ['mixamorigRightHandThumb3', 'mixamorigRightHandThumb4'],
  ['mixamorigRightHandIndex1', 'mixamorigRightHandIndex2'],
  ['mixamorigRightHandIndex2', 'mixamorigRightHandIndex3'],
  ['mixamorigRightHandIndex3', 'mixamorigRightHandIndex4'],
  ['mixamorigRightHandMiddle1', 'mixamorigRightHandMiddle2'],
  ['mixamorigRightHandMiddle2', 'mixamorigRightHandMiddle3'],
  ['mixamorigRightHandMiddle3', 'mixamorigRightHandMiddle4'],
  ['mixamorigRightHandRing1', 'mixamorigRightHandRing2'],
  ['mixamorigRightHandRing2', 'mixamorigRightHandRing3'],
  ['mixamorigRightHandRing3', 'mixamorigRightHandRing4'],
  ['mixamorigRightHandPinky1', 'mixamorigRightHandPinky2'],
  ['mixamorigRightHandPinky2', 'mixamorigRightHandPinky3'],
  ['mixamorigRightHandPinky3', 'mixamorigRightHandPinky4'],
];

/** Core anatomical joints required for clean full-body retargeting. */
export const CORE_HUMANOID_BONES: readonly string[] = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
  'mixamorigLeftUpLeg',
  'mixamorigLeftLeg',
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightUpLeg',
  'mixamorigRightLeg',
  'mixamorigRightFoot',
  'mixamorigRightToeBase',
];

const BONE_SYNONYMS: Readonly<Record<string, string>> = {
  Hips: 'mixamorigHips',
  Pelvis: 'mixamorigHips',
  Spine: 'mixamorigSpine',
  Spine1: 'mixamorigSpine1',
  Spine2: 'mixamorigSpine2',
  Chest: 'mixamorigSpine2',
  Neck: 'mixamorigNeck',
  Head: 'mixamorigHead',
  HeadTop_End: 'mixamorigHeadTop_End',
  LeftShoulder: 'mixamorigLeftShoulder',
  LeftUpperArm: 'mixamorigLeftArm',
  LeftArm: 'mixamorigLeftArm',
  LeftForeArm: 'mixamorigLeftForeArm',
  LeftLowerArm: 'mixamorigLeftForeArm',
  LeftHand: 'mixamorigLeftHand',
  RightShoulder: 'mixamorigRightShoulder',
  RightUpperArm: 'mixamorigRightArm',
  RightArm: 'mixamorigRightArm',
  RightForeArm: 'mixamorigRightForeArm',
  RightLowerArm: 'mixamorigRightForeArm',
  RightHand: 'mixamorigRightHand',
  LeftUpLeg: 'mixamorigLeftUpLeg',
  LeftThigh: 'mixamorigLeftUpLeg',
  LeftLeg: 'mixamorigLeftLeg',
  LeftShin: 'mixamorigLeftLeg',
  LeftFoot: 'mixamorigLeftFoot',
  LeftToeBase: 'mixamorigLeftToeBase',
  LeftToe_End: 'mixamorigLeftToe_End',
  RightUpLeg: 'mixamorigRightUpLeg',
  RightThigh: 'mixamorigRightUpLeg',
  RightLeg: 'mixamorigRightLeg',
  RightShin: 'mixamorigRightLeg',
  RightFoot: 'mixamorigRightFoot',
  RightToeBase: 'mixamorigRightToeBase',
  RightToe_End: 'mixamorigRightToe_End',
};

/** Normalizes rig joint/track names across prefix (`mixamorig:`), Pipe (`Armature|`), or dot-suffix conventions. */
export function normalizeBoneName(rawName: string): string {
  const leafName = rawName.includes('|') ? rawName.slice(rawName.lastIndexOf('|') + 1) : rawName;
  const stripped = leafName
    .replace(/^mixamorig\d*[:_]?/i, CANONICAL_BONE_PREFIX)
    .replaceAll(':', '');
  return BONE_SYNONYMS[stripped] ?? stripped;
}

export function isHumanoidRigNodeName(normalizedName: string): boolean {
  return normalizedName.startsWith(CANONICAL_BONE_PREFIX);
}
