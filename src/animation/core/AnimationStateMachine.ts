import type { MotionCategory, MotionId } from './MotionRegistry.ts';

export type AnimationMachineState =
  | 'IDLE'
  | 'LOCOMOTION'
  | 'SPECIAL_ACTION_LOADING'
  | 'SPECIAL_ACTION_PLAYING'
  | 'SPECIAL_ACTION_STOPPING'
  | 'VEHICLE_WAITING';

export interface AnimationStateSnapshot {
  readonly machineState: AnimationMachineState;
  readonly activeActionId: MotionId | null;
  readonly category: MotionCategory | null;
  readonly loop: boolean;
  readonly speed: number;
  readonly startedAtMs: number | null;
  readonly groupId: string | null;
  readonly error: string | null;
  readonly generation: number;
  readonly isLocomoting: boolean;
}

const INITIAL_SNAPSHOT: AnimationStateSnapshot = {
  machineState: 'IDLE',
  activeActionId: null,
  category: null,
  loop: true,
  speed: 1,
  startedAtMs: null,
  groupId: null,
  error: null,
  generation: 0,
  isLocomoting: false,
};

/**
 * Pure finite state machine governing transitions between locomotion, lazy motion loading,
 * active special-action playback, smooth blend fade-out, and vehicle waiting.
 */
export class AnimationStateMachine {
  private snapshot: AnimationStateSnapshot = INITIAL_SNAPSHOT;

  getSnapshot(): AnimationStateSnapshot {
    return this.snapshot;
  }

  private set(next: Partial<AnimationStateSnapshot>): AnimationStateSnapshot {
    const candidate = { ...this.snapshot, ...next };
    if (
      candidate.machineState === this.snapshot.machineState &&
      candidate.activeActionId === this.snapshot.activeActionId &&
      candidate.category === this.snapshot.category &&
      candidate.loop === this.snapshot.loop &&
      candidate.speed === this.snapshot.speed &&
      candidate.startedAtMs === this.snapshot.startedAtMs &&
      candidate.groupId === this.snapshot.groupId &&
      candidate.error === this.snapshot.error &&
      candidate.generation === this.snapshot.generation &&
      candidate.isLocomoting === this.snapshot.isLocomoting
    ) {
      return this.snapshot;
    }
    this.snapshot = candidate;
    return this.snapshot;
  }

  requestAction(
    id: MotionId,
    category: MotionCategory,
    opts?: {
      loop?: boolean;
      speed?: number;
      startedAtMs?: number;
      groupId?: string | null;
      restart?: boolean;
    },
  ): { changed: boolean; snapshot: AnimationStateSnapshot } {
    const loop = opts?.loop ?? true;
    const speed = opts?.speed ?? this.snapshot.speed ?? 1;
    const isAlreadyActive =
      !opts?.restart &&
      this.snapshot.activeActionId === id &&
      this.snapshot.loop === loop &&
      this.snapshot.speed === speed &&
      this.snapshot.error === null &&
      (this.snapshot.machineState === 'SPECIAL_ACTION_LOADING' ||
        this.snapshot.machineState === 'SPECIAL_ACTION_PLAYING' ||
        (category === 'interactions' && this.snapshot.machineState === 'VEHICLE_WAITING'));

    if (isAlreadyActive) {
      return { changed: false, snapshot: this.snapshot };
    }

    const snapshot = this.set({
      machineState: 'SPECIAL_ACTION_LOADING',
      activeActionId: id,
      category,
      loop,
      speed,
      startedAtMs: opts?.startedAtMs ?? Date.now(),
      groupId: opts?.groupId ?? null,
      error: null,
      generation: this.snapshot.generation + 1,
    });
    return { changed: true, snapshot };
  }

  markPlaying(id: MotionId, generation?: number): AnimationStateSnapshot {
    if (this.snapshot.activeActionId !== id) return this.snapshot;
    if (generation !== undefined && generation !== this.snapshot.generation) return this.snapshot;
    const nextState: AnimationMachineState =
      id === 'vehicle-wait' || this.snapshot.category === 'interactions'
        ? 'VEHICLE_WAITING'
        : 'SPECIAL_ACTION_PLAYING';
    return this.set({
      machineState: nextState,
      error: null,
    });
  }

  markError(id: MotionId, message: string, generation?: number): AnimationStateSnapshot {
    if (this.snapshot.activeActionId !== id) return this.snapshot;
    if (generation !== undefined && generation !== this.snapshot.generation) return this.snapshot;
    return this.set({
      machineState: this.snapshot.isLocomoting ? 'LOCOMOTION' : 'IDLE',
      activeActionId: null,
      category: null,
      startedAtMs: null,
      groupId: null,
      error: message,
      generation: this.snapshot.generation + 1,
    });
  }

  setLoop(loop: boolean): AnimationStateSnapshot {
    if (this.snapshot.loop === loop) return this.snapshot;
    return this.set({ loop });
  }

  setSpeed(speed: number): AnimationStateSnapshot {
    const clamped = Math.max(0.25, Math.min(2.5, Number.isFinite(speed) ? speed : 1));
    if (Math.abs(this.snapshot.speed - clamped) < 1e-4) return this.snapshot;
    return this.set({ speed: clamped });
  }

  stop(immediate = false): AnimationStateSnapshot {
    const hasAction =
      this.snapshot.activeActionId !== null ||
      this.snapshot.machineState === 'SPECIAL_ACTION_LOADING' ||
      this.snapshot.machineState === 'SPECIAL_ACTION_PLAYING' ||
      this.snapshot.machineState === 'VEHICLE_WAITING';

    if (!hasAction && this.snapshot.error === null && !immediate) {
      return this.snapshot;
    }

    const baseState: AnimationMachineState = this.snapshot.isLocomoting ? 'LOCOMOTION' : 'IDLE';
    const nextState: AnimationMachineState =
      !immediate &&
      (this.snapshot.machineState === 'SPECIAL_ACTION_PLAYING' ||
        this.snapshot.machineState === 'VEHICLE_WAITING')
        ? 'SPECIAL_ACTION_STOPPING'
        : baseState;

    return this.set({
      machineState: nextState,
      activeActionId: null,
      category: null,
      startedAtMs: null,
      groupId: null,
      error: null,
      generation: this.snapshot.generation + 1,
    });
  }

  finishStopping(): AnimationStateSnapshot {
    if (this.snapshot.machineState !== 'SPECIAL_ACTION_STOPPING') return this.snapshot;
    return this.set({
      machineState: this.snapshot.isLocomoting ? 'LOCOMOTION' : 'IDLE',
    });
  }

  syncLocomotion(isMoving: boolean): AnimationStateSnapshot {
    const inLocomotionMode =
      this.snapshot.machineState === 'IDLE' || this.snapshot.machineState === 'LOCOMOTION';
    if (!inLocomotionMode) {
      if (this.snapshot.isLocomoting === isMoving) return this.snapshot;
      return this.set({ isLocomoting: isMoving });
    }
    return this.set({
      isLocomoting: isMoving,
      machineState: isMoving ? 'LOCOMOTION' : 'IDLE',
    });
  }

  /** Called when player swaps character preset (`boy <-> girl`) mid-action so the new rig takes ownership cleanly. */
  notifyRigChanged(): AnimationStateSnapshot {
    if (this.snapshot.activeActionId === null) return this.snapshot;
    return this.set({
      machineState: 'SPECIAL_ACTION_LOADING',
      generation: this.snapshot.generation + 1,
    });
  }

  reset(): AnimationStateSnapshot {
    this.snapshot = { ...INITIAL_SNAPSHOT, generation: this.snapshot.generation + 1 };
    return this.snapshot;
  }
}
