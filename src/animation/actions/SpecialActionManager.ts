import { useSyncExternalStore } from 'react';
import {
  AnimationStateMachine,
  type AnimationMachineState,
} from '../core/AnimationStateMachine.ts';
import {
  getMotion,
  resolveMotionId,
  type MotionCategory,
  type MotionId,
} from '../core/MotionRegistry.ts';

export type SpecialActionStatus = 'idle' | 'loading' | 'playing' | 'stopping' | 'error';

export interface SpecialActionState {
  readonly activeActionId: MotionId | null;
  readonly category: MotionCategory | null;
  readonly status: SpecialActionStatus;
  readonly machineState: AnimationMachineState;
  readonly loop: boolean;
  readonly speed: number;
  readonly startedAtMs: number | null;
  readonly groupId: string | null;
  readonly error: string | null;
  readonly generation: number;
}

const stateMachine = new AnimationStateMachine();
const listeners = new Set<() => void>();
let lastErrorMsg: string | null = null;
let lastFailedAction: { id: MotionId; loop: boolean; speed: number } | null = null;
let stopConfirmTimer: ReturnType<typeof setTimeout> | null = null;

function mapMachineToStatus(machineState: AnimationMachineState, error: string | null): SpecialActionStatus {
  if (error !== null) return 'error';
  switch (machineState) {
    case 'SPECIAL_ACTION_LOADING':
      return 'loading';
    case 'SPECIAL_ACTION_PLAYING':
    case 'VEHICLE_WAITING':
      return 'playing';
    case 'SPECIAL_ACTION_STOPPING':
      return 'stopping';
    case 'IDLE':
    case 'LOCOMOTION':
    default:
      return 'idle';
  }
}

function buildPublicState(): SpecialActionState {
  const snap = stateMachine.getSnapshot();
  const error = snap.error ?? lastErrorMsg;
  return {
    activeActionId: snap.activeActionId,
    category: snap.category,
    status: mapMachineToStatus(snap.machineState, error),
    machineState: snap.machineState,
    loop: snap.loop,
    speed: snap.speed,
    startedAtMs: snap.startedAtMs,
    groupId: snap.groupId,
    error,
    generation: snap.generation,
  };
}

let cachedPublicState: SpecialActionState = buildPublicState();

function emitIfChanged(): void {
  const next = buildPublicState();
  if (
    next.activeActionId === cachedPublicState.activeActionId &&
    next.category === cachedPublicState.category &&
    next.status === cachedPublicState.status &&
    next.machineState === cachedPublicState.machineState &&
    next.loop === cachedPublicState.loop &&
    next.speed === cachedPublicState.speed &&
    next.startedAtMs === cachedPublicState.startedAtMs &&
    next.groupId === cachedPublicState.groupId &&
    next.error === cachedPublicState.error &&
    next.generation === cachedPublicState.generation
  ) {
    return;
  }
  cachedPublicState = next;
  for (const listener of listeners) listener();
}

export function getSpecialActionState(): SpecialActionState {
  return cachedPublicState;
}

export function subscribeSpecialAction(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSpecialActionStore(): SpecialActionState {
  return useSyncExternalStore(
    subscribeSpecialAction,
    getSpecialActionState,
    getSpecialActionState,
  );
}

/**
 * Triggers a registered special action (`dance_01`..`dance_06`, `vehicle-wait`, etc.).
 * Duplicate calls for the same action/loop are ignored; lower-priority actions yield cleanly
 * to higher-priority actions unless `force: true` is passed.
 */
export function playSpecialAction(
  id: MotionId,
  opts?: {
    loop?: boolean;
    speed?: number;
    startedAtMs?: number;
    groupId?: string | null;
    force?: boolean;
    restart?: boolean;
  },
): boolean {
  const canonicalId = resolveMotionId(id);
  const def = getMotion(canonicalId);
  if (!def) return false;

  const snap = stateMachine.getSnapshot();
  if (!opts?.force && snap.activeActionId && snap.activeActionId !== canonicalId) {
    const activeDef = getMotion(snap.activeActionId);
    if (
      activeDef &&
      (activeDef.interruptibility === 'vehicle-only' || activeDef.priority > def.priority)
    ) {
      return false;
    }
  }

  lastErrorMsg = null;
  lastFailedAction = null;
  if (stopConfirmTimer) {
    clearTimeout(stopConfirmTimer);
    stopConfirmTimer = null;
  }

  const loop = opts?.loop ?? def.defaultLoop;
  const speed = opts?.speed ?? def.defaultSpeed;
  const { changed } = stateMachine.requestAction(canonicalId, def.category, {
    loop,
    speed,
    startedAtMs: opts?.startedAtMs,
    groupId: opts?.groupId ?? null,
    restart: opts?.restart,
  });

  if (changed) emitIfChanged();
  return true;
}

/**
 * Triggers a manual UI action according to its registry metadata:
 * one-shot retriggerable actions (boxing, kicking, reactions, movement) replay immediately on tap,
 * while toggleable looping actions (dances, exercises) toggle cleanly.
 */
export function triggerSpecialAction(
  id: MotionId,
  opts?: { loop?: boolean; speed?: number },
): boolean {
  const canonicalId = resolveMotionId(id);
  const def = getMotion(canonicalId);
  if (!def || def.autoTriggeredOnly) return false;

  const snap = stateMachine.getSnapshot();
  if (snap.activeActionId === canonicalId) {
    if (def.allowRetrigger) {
      return playSpecialAction(canonicalId, { ...opts, restart: true });
    }
    stopSpecialAction();
    return false;
  }
  return playSpecialAction(canonicalId, opts);
}

export function markSpecialActionPlaying(id: MotionId, generation?: number): void {
  const canonicalId = resolveMotionId(id);
  lastErrorMsg = null;
  stateMachine.markPlaying(canonicalId, generation);
  emitIfChanged();
}

export function markSpecialActionError(id: MotionId, message: string, generation?: number): void {
  const canonicalId = resolveMotionId(id);
  const snap = stateMachine.getSnapshot();
  if (snap.activeActionId !== canonicalId) return;
  if (generation !== undefined && generation !== snap.generation) return;
  lastErrorMsg = message;
  lastFailedAction = { id: canonicalId, loop: snap.loop, speed: snap.speed };
  stateMachine.markError(canonicalId, message, generation);
  emitIfChanged();
}

export function retryLastSpecialAction(): boolean {
  if (!lastFailedAction) return false;
  const { id, loop, speed } = lastFailedAction;
  return playSpecialAction(id, { loop, speed, force: true });
}

export function stopSpecialAction(immediate = false): void {
  lastErrorMsg = null;
  lastFailedAction = null;
  if (stopConfirmTimer) {
    clearTimeout(stopConfirmTimer);
    stopConfirmTimer = null;
  }
  stateMachine.stop(immediate);
  emitIfChanged();
}

export function notifySpecialActionFadeOutComplete(): void {
  if (stopConfirmTimer) {
    clearTimeout(stopConfirmTimer);
    stopConfirmTimer = null;
  }
  stateMachine.finishStopping();
  emitIfChanged();
}

export function syncCharacterLocomotionState(isMoving: boolean): void {
  stateMachine.syncLocomotion(isMoving);
  emitIfChanged();
}

export function notifyCharacterRigChanged(): void {
  stateMachine.notifyRigChanged();
  emitIfChanged();
}

export function setSpecialActionLoop(loop: boolean): void {
  stateMachine.setLoop(loop);
  emitIfChanged();
}

export function setSpecialActionSpeed(speed: number): void {
  stateMachine.setSpeed(speed);
  emitIfChanged();
}

export function toggleSpecialAction(id: MotionId): boolean {
  const canonicalId = resolveMotionId(id);
  const snap = stateMachine.getSnapshot();
  if (snap.activeActionId === canonicalId) {
    stopSpecialAction();
    return false;
  }
  return playSpecialAction(canonicalId);
}

/**
 * Computes synchronized playback offset so players starting or joining a group dance
 * stay phase-locked across multiplayer or character swaps.
 */
export function getSpecialActionSyncPhase(
  startedAtMs: number | null,
  durationSec: number,
  loop: boolean,
  nowMs = Date.now(),
): number {
  if (!startedAtMs || durationSec <= 0) return 0;
  const elapsedSec = Math.max(0, (nowMs - startedAtMs) / 1000);
  if (loop) return elapsedSec % durationSec;
  return Math.min(elapsedSec, durationSec);
}
