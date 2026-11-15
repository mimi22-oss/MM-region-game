import {
  AnimationClip,
  AnimationMixer,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import {
  HIERARCHICAL_LIMB_CHAINS,
  MIXAMO_ROOT_BONE,
  isHumanoidRigNodeName,
  normalizeBoneName,
} from './BoneMapping.ts';
import { buildNormalizedBoneMap } from './SkeletonAnalyzer.ts';

export type RootMotionMode = 'in-place' | 'preserve';

export interface RetargetOptions {
  /** Whether horizontal hips displacement is anchored in-place (`'in-place'`) or scaled (`'preserve'`). */
  rootMotion?: RootMotionMode;
}

/** Clones only lightweight `Object3D` transform hierarchy without cloning meshes, geometries, or textures. */
export function cloneTransformHierarchyOnly(source: Object3D): Object3D {
  const clone = new Object3D();
  clone.name = source.name;
  clone.position.copy(source.position);
  clone.quaternion.copy(source.quaternion);
  clone.scale.copy(source.scale);
  clone.matrixAutoUpdate = source.matrixAutoUpdate;

  for (const child of source.children) {
    if ((child as { isMesh?: boolean }).isMesh) continue;
    clone.add(cloneTransformHierarchyOnly(child));
  }
  return clone;
}

function getNodeDepth(node: Object3D): number {
  let depth = 0;
  let cur = node.parent;
  while (cur) {
    depth++;
    cur = cur.parent;
  }
  return depth;
}

/**
 * Aligns target limb chains (spine/neck/head, shoulders/arms/forearms/hands, thighs/shins/feet/toes, fingers)
 * top-down to match the source rest pose using minimum-arc world swing rotations (zero artificial twist).
 * Eliminates A-pose vs T-pose elbow, shoulder, spine, thigh, and shin directional mismatches on Girl.
 */
export function alignRigHierarchyToSource(dstRoot: Object3D, srcRoot: Object3D): void {
  srcRoot.updateMatrixWorld(true);
  dstRoot.updateMatrixWorld(true);

  const srcByNorm = buildNormalizedBoneMap(srcRoot);
  const dstByNorm = buildNormalizedBoneMap(dstRoot);

  const srcPos = new Vector3();
  const srcChildPos = new Vector3();
  const dstPos = new Vector3();
  const dstChildPos = new Vector3();
  const vSrc = new Vector3();
  const vDst = new Vector3();
  const deltaWorld = new Quaternion();
  const parentWQ = new Quaternion();
  const parentWQInv = new Quaternion();
  const deltaLocal = new Quaternion();

  for (const [parentName, childName] of HIERARCHICAL_LIMB_CHAINS) {
    const sb = srcByNorm.get(parentName);
    const sc = srcByNorm.get(childName);
    const db = dstByNorm.get(parentName);
    const dc = dstByNorm.get(childName);
    if (!sb || !sc || !db || !dc || !db.parent) continue;

    sb.getWorldPosition(srcPos);
    sc.getWorldPosition(srcChildPos);
    db.getWorldPosition(dstPos);
    dc.getWorldPosition(dstChildPos);

    vSrc.subVectors(srcChildPos, srcPos);
    vDst.subVectors(dstChildPos, dstPos);
    if (vSrc.lengthSq() < 1e-8 || vDst.lengthSq() < 1e-8) continue;

    vSrc.normalize();
    vDst.normalize();
    if (vSrc.angleTo(vDst) < 0.002) continue;

    deltaWorld.setFromUnitVectors(vDst, vSrc);
    db.parent.getWorldQuaternion(parentWQ);
    parentWQInv.copy(parentWQ).invert();
    deltaLocal.copy(parentWQInv).multiply(deltaWorld).multiply(parentWQ);
    db.quaternion.premultiply(deltaLocal).normalize();
    db.updateWorldMatrix(false, true);
  }
}

function collectSampleTimes(clip: AnimationClip): Float32Array {
  const timesSet = new Set<number>([0]);
  if (clip.duration > 0) timesSet.add(clip.duration);

  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion') && !track.name.endsWith('.position')) continue;
    const tArr = track.times;
    for (let i = 0; i < tArr.length; i++) {
      timesSet.add(tArr[i]);
    }
  }

  const sorted = Array.from(timesSet).sort((a, b) => a - b);
  const deduped: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (deduped.length === 0 || sorted[i] - deduped[deduped.length - 1] > 1e-4) {
      deduped.push(sorted[i]);
    }
  }
  return new Float32Array(deduped);
}

/**
 * Retargets any extracted motion clip onto any target humanoid rig (`boy.glb`, `girl.glb`, `girl (1).glb`, etc.)
 * via hierarchical rest-pose calibration, world-space quaternion delta transfer, and hips height scaling.
 */
export function retargetMotionClip(
  srcClip: AnimationClip,
  srcRoot: Object3D,
  dstRoot: Object3D,
  options?: RetargetOptions,
): AnimationClip {
  const rootMotionMode = options?.rootMotion ?? 'in-place';
  const srcRef = cloneTransformHierarchyOnly(srcRoot);
  const dstRef = cloneTransformHierarchyOnly(dstRoot);
  alignRigHierarchyToSource(dstRef, srcRef);

  srcRef.updateMatrixWorld(true);
  dstRef.updateMatrixWorld(true);

  const trackedNormNames = new Set<string>([MIXAMO_ROOT_BONE]);
  for (const t of srcClip.tracks) {
    const dot = t.name.lastIndexOf('.');
    if (dot > 0) trackedNormNames.add(normalizeBoneName(t.name.slice(0, dot)));
  }

  const srcBones = new Map<string, Object3D>();
  const dstBones = new Map<string, Object3D>();
  const srcWorldRestInv = new Map<string, Quaternion>();
  const dstWorldRest = new Map<string, Quaternion>();

  srcRef.traverse((obj) => {
    if (!obj.name) return;
    const key = normalizeBoneName(obj.name);
    if (isHumanoidRigNodeName(key) || trackedNormNames.has(key)) {
      srcBones.set(key, obj);
      srcWorldRestInv.set(key, obj.getWorldQuaternion(new Quaternion()).invert());
    }
  });

  dstRef.traverse((obj) => {
    if (!obj.name) return;
    const key = normalizeBoneName(obj.name);
    if (isHumanoidRigNodeName(key) || trackedNormNames.has(key)) {
      dstBones.set(key, obj);
      dstWorldRest.set(key, obj.getWorldQuaternion(new Quaternion()));
    }
  });

  const quatTracks = srcClip.tracks.filter((t) => t.name.endsWith('.quaternion'));
  if (quatTracks.length === 0) {
    return srcClip.clone();
  }

  const sharedTimes = collectSampleTimes(srcClip);
  const numFrames = sharedTimes.length;

  const srcHips = srcBones.get(MIXAMO_ROOT_BONE);
  const dstHips = dstBones.get(MIXAMO_ROOT_BONE);
  const hipsPosTrack = srcClip.tracks.find(
    (t) =>
      t.name.endsWith('.position') &&
      normalizeBoneName(t.name.slice(0, -'.position'.length)) === MIXAMO_ROOT_BONE,
  );

  const srcHipsRestWPos = new Vector3();
  const dstHipsRestWPos = new Vector3();
  let heightRatio = 1;
  if (srcHips && dstHips) {
    srcHips.getWorldPosition(srcHipsRestWPos);
    dstHips.getWorldPosition(dstHipsRestWPos);
    heightRatio = dstHipsRestWPos.y / Math.max(0.001, srcHipsRestWPos.y);
  }

  const targetEntries: {
    normName: string;
    dstTrackName: string;
    srcBone: Object3D;
    dstBone: Object3D;
    srcRestInv: Quaternion;
    dstRest: Quaternion;
    values: Float32Array;
    prevQ: Quaternion | null;
  }[] = [];

  for (const track of quatTracks) {
    const rawBoneName = track.name.slice(0, -'.quaternion'.length);
    const normName = normalizeBoneName(rawBoneName);
    const srcBone = srcBones.get(normName);
    const dstBone = dstBones.get(normName);
    const srcRestInv = srcWorldRestInv.get(normName);
    const dstRest = dstWorldRest.get(normName);
    if (!srcBone || !dstBone || !srcRestInv || !dstRest) continue;

    targetEntries.push({
      normName,
      dstTrackName: `${dstBone.name}.quaternion`,
      srcBone,
      dstBone,
      srcRestInv,
      dstRest,
      values: new Float32Array(numFrames * 4),
      prevQ: null,
    });
  }

  targetEntries.sort((a, b) => getNodeDepth(a.dstBone) - getNodeDepth(b.dstBone));

  const hipsPosValues = hipsPosTrack && srcHips && dstHips?.parent ? new Float32Array(numFrames * 3) : null;

  const mixer = new AnimationMixer(srcRef);
  const action = mixer.clipAction(srcClip);
  action.play();

  const wSrcAnim = new Quaternion();
  const wDstAnim = new Quaternion();
  const wDstParentAnim = new Quaternion();
  const localQ = new Quaternion();
  const srcWPos = new Vector3();
  const dstWPos = new Vector3();
  const srcFrame0XZ = new Vector3();
  let hasFrame0XZ = false;

  try {
    for (let f = 0; f < numFrames; f++) {
      mixer.setTime(sharedTimes[f]);
      srcRef.updateMatrixWorld(true);

      if (hipsPosValues && srcHips && dstHips?.parent) {
        srcHips.getWorldPosition(srcWPos);
        if (!hasFrame0XZ) {
          srcFrame0XZ.set(srcWPos.x, srcHipsRestWPos.y, srcWPos.z);
          hasFrame0XZ = true;
        }
        if (rootMotionMode === 'in-place') {
          dstWPos.set(
            dstHipsRestWPos.x,
            (srcWPos.y - srcHipsRestWPos.y) * heightRatio + dstHipsRestWPos.y,
            dstHipsRestWPos.z,
          );
        } else {
          dstWPos
            .copy(srcWPos)
            .sub(srcHipsRestWPos)
            .multiplyScalar(heightRatio)
            .add(dstHipsRestWPos);
        }
        dstHips.parent.worldToLocal(dstWPos);
        hipsPosValues[f * 3] = dstWPos.x;
        hipsPosValues[f * 3 + 1] = dstWPos.y;
        hipsPosValues[f * 3 + 2] = dstWPos.z;
      }

      for (let bi = 0; bi < targetEntries.length; bi++) {
        const entry = targetEntries[bi];
        entry.srcBone.getWorldQuaternion(wSrcAnim);
        wDstAnim.copy(wSrcAnim).multiply(entry.srcRestInv).multiply(entry.dstRest);
        if (entry.dstBone.parent) {
          entry.dstBone.parent.getWorldQuaternion(wDstParentAnim);
          localQ.copy(wDstParentAnim).invert().multiply(wDstAnim).normalize();
        } else {
          localQ.copy(wDstAnim).normalize();
        }

        if (entry.prevQ && entry.prevQ.dot(localQ) < 0) {
          localQ.set(-localQ.x, -localQ.y, -localQ.z, -localQ.w);
        }
        if (!entry.prevQ) entry.prevQ = new Quaternion();
        entry.prevQ.copy(localQ);

        entry.dstBone.quaternion.copy(localQ);
        entry.dstBone.updateWorldMatrix(false, true);

        entry.values[f * 4] = localQ.x;
        entry.values[f * 4 + 1] = localQ.y;
        entry.values[f * 4 + 2] = localQ.z;
        entry.values[f * 4 + 3] = localQ.w;
      }
    }
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(srcRef);
  }

  const outTracks: (VectorKeyframeTrack | QuaternionKeyframeTrack)[] = [];
  if (hipsPosValues && dstHips) {
    outTracks.push(new VectorKeyframeTrack(`${dstHips.name}.position`, sharedTimes, hipsPosValues));
  }
  for (const entry of targetEntries) {
    outTracks.push(new QuaternionKeyframeTrack(entry.dstTrackName, sharedTimes, entry.values));
  }

  return new AnimationClip(srcClip.name, srcClip.duration, outTracks);
}
