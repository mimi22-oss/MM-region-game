import { useMemo } from 'react';
import { listDanceActions, toggleDanceAction } from '../actions/DanceActions.ts';
import {
  getSpecialActionState,
  playSpecialAction,
  setSpecialActionLoop,
  setSpecialActionSpeed,
  stopSpecialAction,
  toggleSpecialAction,
  useSpecialActionStore,
} from '../actions/SpecialActionManager.ts';
import { getMotion, listMotions } from '../core/MotionRegistry.ts';
import { useVehicleWaiting } from '../../game/vehicleWaiting.ts';

export function useSpecialActions() {
  const actionState = useSpecialActionStore();
  const vehicleWaiting = useVehicleWaiting();

  const dances = useMemo(() => listDanceActions(), []);
  const interactions = useMemo(() => listMotions('interactions'), []);
  const activeDefinition = actionState.activeActionId
    ? getMotion(actionState.activeActionId) ?? null
    : null;

  return {
    state: actionState,
    vehicleWaiting,
    dances,
    interactions,
    activeDefinition,
    play: playSpecialAction,
    stop: stopSpecialAction,
    toggle: toggleSpecialAction,
    toggleDance: toggleDanceAction,
    setLoop: setSpecialActionLoop,
    setSpeed: setSpecialActionSpeed,
    getSnapshot: getSpecialActionState,
  };
}
