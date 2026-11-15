import type { AnimationClip, Object3D } from 'three';
import {
  getSpecialActionState,
  getSpecialActionSyncPhase,
  markSpecialActionError,
  markSpecialActionPlaying,
  notifyCharacterRigChanged,
  notifySpecialActionFadeOutComplete,
  playSpecialAction,
  setSpecialActionLoop,
  setSpecialActionSpeed,
  stopSpecialAction,
  subscribeSpecialAction,
  syncCharacterLocomotionState,
  toggleSpecialAction,
  triggerSpecialAction,
  useSpecialActionStore,
  type SpecialActionState,
  type SpecialActionStatus,
} from '../animation/actions/SpecialActionManager.ts';
import { isWaitingMotionId } from '../animation/actions/VehicleWaitingAction.ts';
import {
  DEFAULT_MAX_CLIP_CACHE,
  DEFAULT_MAX_RAW_CACHE,
  MotionLruCache,
  clearMotionCaches,
  getMotionCacheStats,
  type MotionCacheStats,
  type RawMotionAsset,
} from '../animation/core/MotionCache.ts';
import {
  loadRawMotionAsset,
  loadRetargetedMotionClip,
  type GlbSceneLoaderFn,
} from '../animation/core/MotionLoader.ts';
import {
  getMotion,
  getMotionCategoryGroups,
  listManualMotions,
  listMotionCategories,
  listMotionSubgroups,
  listMotions,
  listMotionsBySubgroup,
  registerMotion,
  registerMotionAlias,
  resolveMotionId,
  type MotionCategory,
  type MotionCategoryMeta,
  type MotionCategoryWithCount,
  type MotionDefinition,
  type MotionEndPose,
  type MotionId,
  type MotionInterruptibility,
  type MotionSubgroup,
  type MotionSubgroupGroup,
  type MotionSubgroupMeta,
  type UiActionCategory,
} from '../animation/core/MotionRegistry.ts';
import { normalizeBoneName } from '../animation/retargeting/BoneMapping.ts';
import {
  cloneTransformHierarchyOnly,
  retargetMotionClip,
} from '../animation/retargeting/SkeletonRetargeter.ts';

export type SpecialActionCategory = MotionCategory;
export type SpecialActionUiCategory = UiActionCategory;
export type SpecialActionSubgroup = MotionSubgroup;
export type SpecialActionInterruptibility = MotionInterruptibility;
export type SpecialActionEndPose = MotionEndPose;
export type SpecialActionCategoryMeta = MotionCategoryMeta;
export type SpecialActionCategoryWithCount = MotionCategoryWithCount;
export type SpecialActionSubgroupMeta = MotionSubgroupMeta;
export type SpecialActionSubgroupGroup = MotionSubgroupGroup;
export type SpecialActionId = MotionId;
export type SpecialActionDefinition = MotionDefinition;
export type RawAnimationAsset = RawMotionAsset;
export type SpecialActionCacheStats = MotionCacheStats;

export {
  DEFAULT_MAX_CLIP_CACHE,
  DEFAULT_MAX_RAW_CACHE,
  MotionLruCache as BoundedLruCache,
  clearMotionCaches as clearSpecialActionCache,
  cloneTransformHierarchyOnly,
  getMotion as getSpecialAction,
  getMotionCacheStats as getSpecialActionCacheStats,
  getMotionCategoryGroups as getSpecialActionCategoryGroups,
  getSpecialActionState,
  getSpecialActionSyncPhase,
  isWaitingMotionId,
  listManualMotions as listManualSpecialActions,
  listMotionCategories as listSpecialActionCategories,
  listMotionSubgroups as listSpecialActionSubgroups,
  listMotions as listSpecialActions,
  listMotionsBySubgroup as listSpecialActionsBySubgroup,
  markSpecialActionError,
  markSpecialActionPlaying,
  normalizeBoneName,
  notifyCharacterRigChanged,
  notifySpecialActionFadeOutComplete,
  playSpecialAction,
  registerMotion as registerSpecialAction,
  registerMotionAlias as registerSpecialActionAlias,
  resolveMotionId as resolveSpecialActionId,
  retargetMotionClip as retargetAnimationClipToRig,
  setSpecialActionLoop,
  setSpecialActionSpeed,
  stopSpecialAction,
  subscribeSpecialAction,
  syncCharacterLocomotionState,
  toggleSpecialAction,
  triggerSpecialAction,
  useSpecialActionStore as useSpecialAction,
  type SpecialActionState,
  type SpecialActionStatus,
};

export function loadRawSpecialActionAsset(
  id: SpecialActionId,
  loaderFn?: GlbSceneLoaderFn,
): Promise<RawAnimationAsset> {
  return loadRawMotionAsset(id, { loaderFn });
}

export function loadSpecialActionClipForRig(
  id: SpecialActionId,
  rigKey: string,
  targetRigRoot: Object3D,
  loaderFn?: GlbSceneLoaderFn,
): Promise<AnimationClip> {
  return loadRetargetedMotionClip(id, rigKey, targetRigRoot, { loaderFn });
}
