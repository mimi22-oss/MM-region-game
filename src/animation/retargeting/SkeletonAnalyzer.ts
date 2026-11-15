import {
  Bone,
  Box3,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type Object3D,
} from 'three';
import {
  CORE_HUMANOID_BONES,
  isHumanoidRigNodeName,
  normalizeBoneName,
} from './BoneMapping.ts';

export interface SkeletonAnalysis {
  readonly rigSignature: string;
  readonly jointCount: number;
  readonly boneObjectCount: number;
  readonly endEffectorNames: readonly string[];
  readonly meshCount: number;
  readonly hipsHeight: number;
  readonly bboxHeight: number;
  readonly bboxMinY: number;
  readonly leftFootY: number;
  readonly rightFootY: number;
  readonly armRestSpreadDeg: number;
  readonly boneNames: readonly string[];
}

export interface SkeletonCompatibilityReport {
  readonly compatible: boolean;
  readonly sourceJointCount: number;
  readonly targetJointCount: number;
  readonly mappedCoreBones: number;
  readonly missingCoreBones: readonly string[];
  readonly heightScaleRatio: number;
  readonly restPoseDeltaDeg: Readonly<Record<string, number>>;
}

const analysisCache = new WeakMap<Object3D, SkeletonAnalysis>();

function hashStringFNV1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function buildNormalizedBoneMap(
  root: Object3D,
  extraNames?: ReadonlySet<string>,
): Map<string, Object3D> {
  const map = new Map<string, Object3D>();
  root.traverse((obj) => {
    if (!obj.name) return;
    const norm = normalizeBoneName(obj.name);
    if (obj instanceof Bone || isHumanoidRigNodeName(norm) || extraNames?.has(norm)) {
      if (!map.has(norm)) map.set(norm, obj);
    }
  });
  return map;
}

/**
 * Inspects a character or extracted motion rig (without mutating transforms or duplicating GPU resources)
 * and derives a deterministic structural signature for retargeted clip caching.
 */
export function analyzeSkeleton(root: Object3D): SkeletonAnalysis {
  const cached = analysisCache.get(root);
  if (cached) return cached;

  root.updateMatrixWorld(true);

  let boneObjectCount = 0;
  let meshCount = 0;
  const endEffectorNames: string[] = [];
  const rigBones = new Map<string, Object3D>();

  root.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh || obj instanceof SkinnedMesh) {
      meshCount++;
    }
    if (!obj.name) return;
    const norm = normalizeBoneName(obj.name);
    if (obj instanceof Bone || isHumanoidRigNodeName(norm)) {
      rigBones.set(norm, obj);
      if (obj instanceof Bone) {
        boneObjectCount++;
      } else {
        endEffectorNames.push(norm);
      }
    }
  });

  const wp = new Vector3();
  const wpChild = new Vector3();
  const wq = new Quaternion();
  const sortedNames = Array.from(rigBones.keys()).sort();

  const hipsNode = rigBones.get('mixamorigHips');
  let hipsHeight = 0;
  if (hipsNode) {
    hipsNode.getWorldPosition(wp);
    hipsHeight = wp.y;
  }

  let leftFootY = 0;
  let rightFootY = 0;
  rigBones.get('mixamorigLeftFoot')?.getWorldPosition(wp);
  if (rigBones.has('mixamorigLeftFoot')) leftFootY = wp.y;
  rigBones.get('mixamorigRightFoot')?.getWorldPosition(wp);
  if (rigBones.has('mixamorigRightFoot')) rightFootY = wp.y;

  let armRestSpreadDeg = 0;
  const lArm = rigBones.get('mixamorigLeftArm');
  const lFore = rigBones.get('mixamorigLeftForeArm');
  if (lArm && lFore) {
    lArm.getWorldPosition(wp);
    lFore.getWorldPosition(wpChild);
    const armDir = wpChild.sub(wp).normalize();
    armRestSpreadDeg = (armDir.angleTo(new Vector3(1, 0, 0)) * 180) / Math.PI;
  }

  const bbox = new Box3().setFromObject(root);
  const bboxMinY = Number.isFinite(bbox.min.y) ? bbox.min.y : 0;
  const bboxHeight = Number.isFinite(bbox.max.y - bbox.min.y) ? bbox.max.y - bbox.min.y : hipsHeight * 2;

  const sigParts: string[] = [`n=${sortedNames.length}`, `b=${boneObjectCount}`];
  for (const name of CORE_HUMANOID_BONES) {
    const node = rigBones.get(name);
    if (!node) {
      sigParts.push(`${name}:missing`);
      continue;
    }
    node.getWorldQuaternion(wq);
    sigParts.push(
      `${name}:${Math.round(wq.x * 100)},${Math.round(wq.y * 100)},${Math.round(wq.z * 100)},${Math.round(wq.w * 100)}`,
    );
  }
  const rigSignature = `rig_${sortedNames.length}_${boneObjectCount}_${hashStringFNV1a(sigParts.join('|'))}`;

  const analysis: SkeletonAnalysis = {
    rigSignature,
    jointCount: sortedNames.length,
    boneObjectCount,
    endEffectorNames,
    meshCount,
    hipsHeight: Number(hipsHeight.toFixed(4)),
    bboxHeight: Number(bboxHeight.toFixed(4)),
    bboxMinY: Number(bboxMinY.toFixed(4)),
    leftFootY: Number(leftFootY.toFixed(4)),
    rightFootY: Number(rightFootY.toFixed(4)),
    armRestSpreadDeg: Number(armRestSpreadDeg.toFixed(2)),
    boneNames: sortedNames,
  };

  analysisCache.set(root, analysis);
  return analysis;
}

export function compareSkeletons(sourceRoot: Object3D, targetRoot: Object3D): SkeletonCompatibilityReport {
  const srcAnalysis = analyzeSkeleton(sourceRoot);
  const dstAnalysis = analyzeSkeleton(targetRoot);

  const srcMap = buildNormalizedBoneMap(sourceRoot);
  const dstMap = buildNormalizedBoneMap(targetRoot);

  const missingCoreBones: string[] = [];
  const restPoseDeltaDeg: Record<string, number> = {};
  const qs = new Quaternion();
  const qt = new Quaternion();

  for (const boneName of CORE_HUMANOID_BONES) {
    const sNode = srcMap.get(boneName);
    const dNode = dstMap.get(boneName);
    if (!sNode || !dNode) {
      missingCoreBones.push(boneName);
      continue;
    }
    sNode.getWorldQuaternion(qs);
    dNode.getWorldQuaternion(qt);
    const deg = (2 * Math.acos(Math.min(1, Math.abs(qs.dot(qt)))) * 180) / Math.PI;
    restPoseDeltaDeg[boneName] = Number(deg.toFixed(2));
  }

  return {
    compatible: missingCoreBones.length === 0,
    sourceJointCount: srcAnalysis.jointCount,
    targetJointCount: dstAnalysis.jointCount,
    mappedCoreBones: CORE_HUMANOID_BONES.length - missingCoreBones.length,
    missingCoreBones,
    heightScaleRatio: Number(
      (dstAnalysis.hipsHeight / Math.max(0.001, srcAnalysis.hipsHeight)).toFixed(4),
    ),
    restPoseDeltaDeg,
  };
}
