import {
  LoopOnce,
  LoopRepeat,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type AnimationMixer,
  type Bone,
  type Object3D,
  type Quaternion,
} from 'three';

export interface MotionRestBoneEntry {
  readonly bone: Bone;
  readonly q: Quaternion;
}

export interface MotionPlayOptions {
  loop?: boolean;
  syncTimeSec?: number;
  crossFadeSec?: number;
  speed?: number;
}

function dampWeight(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/**
 * Per-character AnimationController sharing the rig's single `THREE.AnimationMixer`.
 * Coordinates Play, Stop, Loop, Speed, Fade In/Out, and Return-to-Idle without extra mixers
 * or per-frame heap allocations.
 */
export class AnimationController {
  private readonly mixer: AnimationMixer;
  private readonly rootObject: Object3D;
  private activeAction: AnimationAction | null = null;
  private activeLoop = true;
  private activeSpeed = 1;
  private targetActive = false;
  private blendWeight = 0;
  private onFinishedCb: (() => void) | null = null;
  private disposed = false;

  // Pre-allocated scratch vectors (zero per-frame heap allocations)
  private readonly hipsActionPos = new Vector3();
  private readonly zeroPlacementPos = new Vector3(0, 0, 0);

  private readonly handleMixerFinished = (event: { action: AnimationAction }) => {
    if (this.disposed) return;
    if (event.action === this.activeAction && !this.activeLoop) {
      this.targetActive = false;
      this.onFinishedCb?.();
    }
  };

  constructor(mixer: AnimationMixer, rootObject: Object3D) {
    this.mixer = mixer;
    this.rootObject = rootObject;
    this.mixer.addEventListener('finished', this.handleMixerFinished);
  }

  onFinished(listener: (() => void) | null): void {
    this.onFinishedCb = listener;
  }

  get blend(): number {
    return this.blendWeight;
  }

  get isActive(): boolean {
    return this.targetActive && this.activeAction !== null;
  }

  get currentClipName(): string | null {
    return this.activeAction && this.blendWeight > 0.01 ? this.activeAction.getClip().name : null;
  }

  setLoop(loop: boolean): void {
    this.activeLoop = loop;
    if (!this.activeAction) return;
    this.activeAction.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    this.activeAction.clampWhenFinished = !loop;
  }

  setSpeed(speed: number): void {
    const safeSpeed = Math.max(0.25, Math.min(2.5, Number.isFinite(speed) ? speed : 1));
    this.activeSpeed = safeSpeed;
    if (this.activeAction) {
      this.activeAction.setEffectiveTimeScale(safeSpeed);
    }
  }

  play(clip: AnimationClip | null, opts?: MotionPlayOptions): void {
    if (this.disposed) return;
    if (!clip) {
      this.stop();
      return;
    }

    const nextLoop = opts?.loop ?? true;
    const nextSpeed = opts?.speed ?? this.activeSpeed;
    const crossFadeSec = opts?.crossFadeSec ?? 0.28;
    const prevAction = this.activeAction;
    const prevClip = prevAction ? prevAction.getClip() : null;
    const nextAction = this.mixer.clipAction(clip);

    nextAction.setLoop(nextLoop ? LoopRepeat : LoopOnce, nextLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !nextLoop;
    nextAction.setEffectiveTimeScale(nextSpeed);

    if (prevAction !== nextAction || !nextAction.isRunning()) {
      if (prevAction && prevAction !== nextAction && this.blendWeight > 0.05 && prevAction.isRunning()) {
        nextAction.reset();
        nextAction.enabled = true;
        nextAction.setEffectiveWeight(1);
        nextAction.setEffectiveTimeScale(nextSpeed);
        if (opts?.syncTimeSec && clip.duration > 0) {
          nextAction.time = opts.syncTimeSec % clip.duration;
        }
        nextAction.play();
        prevAction.crossFadeTo(nextAction, crossFadeSec, false);
      } else {
        this.mixer.stopAllAction();
        if (prevClip && prevClip !== clip) {
          this.mixer.uncacheAction(prevClip, this.rootObject);
        }
        nextAction.reset();
        nextAction.enabled = true;
        nextAction.setEffectiveWeight(1);
        nextAction.setEffectiveTimeScale(nextSpeed);
        if (opts?.syncTimeSec && clip.duration > 0) {
          nextAction.time = opts.syncTimeSec % clip.duration;
        }
        nextAction.play();
      }
    } else if (!nextLoop && this.activeLoop) {
      const currentTime = nextAction.time;
      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      nextAction.setEffectiveTimeScale(nextSpeed);
      nextAction.time = currentTime;
      nextAction.play();
    }

    this.activeAction = nextAction;
    this.activeLoop = nextLoop;
    this.activeSpeed = nextSpeed;
    this.targetActive = true;
  }

  fadeIn(clip: AnimationClip, durationSec = 0.28, opts?: Omit<MotionPlayOptions, 'crossFadeSec'>): void {
    this.play(clip, { ...opts, crossFadeSec: durationSec });
  }

  stop(): void {
    this.targetActive = false;
  }

  fadeOut(immediate = false): void {
    this.targetActive = false;
    if (immediate) {
      this.blendWeight = 0;
      if (this.activeAction) {
        const clip = this.activeAction.getClip();
        this.mixer.stopAllAction();
        this.mixer.uncacheAction(clip, this.rootObject);
        this.activeAction = null;
      }
    }
  }

  returnToIdle(): void {
    this.targetActive = false;
  }

  /** Updates the blend envelope between procedural locomotion and clip playback; returns true when fully exited. */
  stepBlend(seated: boolean, interruptedByMotion: boolean, dtSec: number): boolean {
    if (seated) {
      this.fadeOut(true);
      return true;
    }
    if (interruptedByMotion) {
      this.targetActive = false;
    }

    const targetBlend = this.targetActive && this.activeAction !== null ? 1 : 0;
    if (dtSec > 0) {
      this.blendWeight = dampWeight(this.blendWeight, targetBlend, targetBlend > 0 ? 12 : 15, dtSec);
      if (Math.abs(targetBlend - this.blendWeight) < 0.002) {
        this.blendWeight = targetBlend;
      }
    } else {
      this.blendWeight = targetBlend;
    }

    if (this.blendWeight <= 0 && !this.targetActive && this.activeAction !== null) {
      const clip = this.activeAction.getClip();
      this.mixer.stopAllAction();
      this.mixer.uncacheAction(clip, this.rootObject);
      this.activeAction = null;
      return true;
    }
    return false;
  }

  /**
   * Evaluates the mixer over rest pose and smoothly slerps into the procedural locomotion pose
   * using caller-owned scratch buffers (zero allocations).
   */
  applyPose(
    dtSec: number,
    restList: readonly MotionRestBoneEntry[],
    procQuats: readonly Quaternion[],
    procPlacementPos: Vector3,
    hipsBone: Bone,
    hipsRestPos: Vector3,
    placementObj: Object3D,
  ): void {
    if (this.blendWeight <= 0 || this.activeAction === null) return;

    const isBlending = this.blendWeight < 0.999;
    if (isBlending) {
      for (let i = 0; i < restList.length; i++) {
        procQuats[i].copy(restList[i].bone.quaternion);
      }
      procPlacementPos.copy(placementObj.position);
    }

    for (let i = 0; i < restList.length; i++) {
      restList[i].bone.quaternion.copy(restList[i].q);
    }
    hipsBone.position.copy(hipsRestPos);

    this.mixer.update(dtSec);

    if (isBlending) {
      for (let i = 0; i < restList.length; i++) {
        const b = restList[i].bone;
        procQuats[i].slerp(b.quaternion, this.blendWeight);
        b.quaternion.copy(procQuats[i]);
      }
      this.hipsActionPos.copy(hipsBone.position);
      hipsBone.position.lerpVectors(hipsRestPos, this.hipsActionPos, this.blendWeight);
      placementObj.position.lerpVectors(procPlacementPos, this.zeroPlacementPos, this.blendWeight);
    } else {
      placementObj.position.copy(this.zeroPlacementPos);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener('finished', this.handleMixerFinished);
    if (this.activeAction) {
      const clip = this.activeAction.getClip();
      this.mixer.stopAllAction();
      this.mixer.uncacheAction(clip, this.rootObject);
      this.activeAction = null;
    } else {
      this.mixer.stopAllAction();
    }
    this.mixer.uncacheRoot(this.rootObject);
    this.onFinishedCb = null;
  }
}
