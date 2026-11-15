import { useMemo } from 'react';
import { listDanceActions, toggleDanceAction } from '../actions/DanceActions.ts';
import {
  getSpecialActionState,
  playSpecialAction,
  setSpecialActionLoop,
  setSpecialActionSpeed,
  stopSpecialAction,
  toggleSpecialAction,
  triggerSpecialAction,
  useSpecialActionStore,
} from '../actions/SpecialActionManager.ts';
import {
  getMotion,
  getMotionCategoryGroups,
  listMotionCategories,
  listMotions,
} from '../core/MotionRegistry.ts';
import { useVehicleWaiting } from '../../game/vehicleWaiting.ts';

export function useSpecialActions() {
  const actionState = useSpecialActionStore();
  const vehicleWaiting = useVehicleWaiting();

  const categories = useMemo(() => listMotionCategories(), []);
  const dances = useMemo(() => listDanceActions(), []);
  const interactions = useMemo(() => listMotions('interactions'), []);
  const activeDefinition = actionState.activeActionId
    ? getMotion(actionState.activeActionId) ?? null
    : null;

  return {
    state: actionState,
    vehicleWaiting,
    categories,
    dances,
    interactions,
    activeDefinition,
    getCategoryGroups: getMotionCategoryGroups,
    play: playSpecialAction,
    trigger: triggerSpecialAction,
    stop: stopSpecialAction,
    toggle: toggleSpecialAction,
    toggleDance: toggleDanceAction,
    setLoop: setSpecialActionLoop,
    setSpeed: setSpecialActionSpeed,
    getSnapshot: getSpecialActionState,
  };
}
