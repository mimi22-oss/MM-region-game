import { listMotions, type MotionDefinition, type MotionId } from '../core/MotionRegistry.ts';
import {
  getSpecialActionState,
  playSpecialAction,
  stopSpecialAction,
  toggleSpecialAction,
} from './SpecialActionManager.ts';

export const DANCE_MOTION_IDS: readonly MotionId[] = [
  'dance_01',
  'dance_02',
  'dance_03',
  'dance_04',
  'dance_05',
  'dance_06',
];

export function listDanceActions(): MotionDefinition[] {
  return listMotions('dance');
}

export function playDanceAction(
  id: MotionId,
  opts?: { loop?: boolean; speed?: number; startedAtMs?: number; groupId?: string | null },
): boolean {
  return playSpecialAction(id, opts);
}

export function toggleDanceAction(id: MotionId): boolean {
  return toggleSpecialAction(id);
}

export function stopDanceAction(): void {
  const state = getSpecialActionState();
  if (state.category === 'dance') {
    stopSpecialAction();
  }
}
