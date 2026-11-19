import {
  getMotion,
  resolveMotionId,
  type MotionDefinition,
  type MotionId,
} from '../core/MotionRegistry.ts';
import {
  getSpecialActionState,
  playSpecialAction,
  stopSpecialAction,
} from './SpecialActionManager.ts';

export const VEHICLE_WAIT_ACTION_ID: MotionId = 'vehicle-wait';

export function getVehicleWaitingMotion(): MotionDefinition {
  return getMotion(VEHICLE_WAIT_ACTION_ID)!;
}

export function isWaitingMotionId(id: string | null | undefined): boolean {
  if (!id) return false;
  const resolved = resolveMotionId(id);
  return resolved === VEHICLE_WAIT_ACTION_ID;
}

export function startVehicleWaitingMotion(actionId: MotionId = VEHICLE_WAIT_ACTION_ID): boolean {
  const canonicalId = resolveMotionId(actionId);
  const current = getSpecialActionState();
  if (
    current.activeActionId === canonicalId &&
    current.loop &&
    current.status !== 'error'
  ) {
    return true;
  }
  return playSpecialAction(canonicalId, { loop: true, force: true });
}

export function stopVehicleWaitingMotion(): void {
  const current = getSpecialActionState();
  if (current.activeActionId && isWaitingMotionId(current.activeActionId)) {
    stopSpecialAction();
  }
}
