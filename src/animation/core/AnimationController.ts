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
  readonly isLowerBodyLeg?: boolean;
}

export interface MotionPlayOptions {
  loop?: boolean;
  syncTimeSec?: number;
  crossFadeSec?: number;
  fadeOutSec?: number;
  endHoldSec?: number;
  speed?: number;
  restart?: boolean;
  allowWhileMoving?: boolean;
}

function dampWeight(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/**
 * Per-character AnimationController sharing the rig's single `THREE.AnimationMixer`.
 * Coordinates Play, Stop, Loop, Speed, Fade In/Out, ground-pose settle holds, and Return-to-Idle
 * without extra mixers or per-frame heap allocations.
 */
export class AnimationController {
  private readonly mixer: AnimationMixer;
  private readonly rootObject: Object3D;
  private activeAction: AnimationAction | null = null;
  private activeLoop = true;
  private activeAllowWhileMoving = false;
  private activeSpeed = 1;
  private activeFadeOutSec = 0.28;
  private activeEndHoldSec = 0;
  private holdingAtEnd = false;
  private endHoldRemainingSec = 0;
  private fadeOutElapsedSec = 0;
  private fadeOutStartWeight = 0;
  private usingSmoothFadeOut = false;
  private targetActive = false;
  private blendWeight = 0;
  private onFinishedCb: (() => void) | null = null;
  private disposed = false;

  // Bounded scratch tracking of previous crossfade source clips so finished sources are uncached cleanly
  private readonly retiredClips = new Set<AnimationClip>();
  private crossFadeRemainingSec = 0;

  // Pre-allocated scratch vectors (zero per-frame heap allocations)
  private readonly hipsActionPos = new Vector3();
  private readonly zeroPlacementPos = new Vector3(0, 0, 0);

  private readonly handleMixerFinished = (event: { action: AnimationAction }) => {
    if (this.disposed) return;
    if (event.action === this.activeAction && !this.activeLoop) {
      if (this.activeEndHoldSec > 0) {
        this.holdingAtEnd = true;
        this.endHoldRemainingSec = this.activeEndHoldSec;
      } else {
        this.beginFadeOut(false);
        this.onFinishedCb?.();
      }
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
    return (this.targetActive || this.holdingAtEnd) && this.activeAction !== null;
  }

  get allowsMovement(): boolean {
    return this.activeAllowWhileMoving;
  }

  get currentClipName(): string | null {
    return this.activeAction && this.blendWeight > 0.01 ? this.activeAction.getClip().name : null;
  }

  private beginFadeOut(interruptedByMotion: boolean): void {
    if (!this.targetActive && !this.holdingAtEnd) {
      if (interruptedByMotion && this.usingSmoothFadeOut) {
        this.usingSmoothFadeOut = false;
      }
      return;
    }
    this.holdingAtEnd = false;
    this.endHoldRemainingSec = 0;
    this.targetActive = false;
    if (!interruptedByMotion && this.activeFadeOutSec > 0.35 && this.blendWeight > 0.01) {
      this.usingSmoothFadeOut = true;
      this.fadeOutElapsedSec = 0;
      this.fadeOutStartWeight = this.blendWeight;
    } else {
      this.usingSmoothFadeOut = false;
    }
  }

  private flushRetiredClips(exceptClip?: AnimationClip): void {
    for (const clip of this.retiredClips) {
      if (clip === exceptClip) continue;
      this.mixer.uncacheAction(clip, this.rootObject);
      this.retiredClips.delete(clip);
    }
  }

  setLoop(loop: boolean): void {
    this.activeLoop = loop;
    if (!this.activeAction) return;
    this.activeAction.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    this.activeAction.clampWhenFinished = !loop;
    if (loop && (this.holdingAtEnd || this.activeAction.paused)) {
      this.holdingAtEnd = false;
      this.endHoldRemainingSec = 0;
      this.usingSmoothFadeOut = false;
      this.activeAction.paused = false;
      this.targetActive = true;
      this.activeAction.play();
    }
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

    this.holdingAtEnd = false;
    this.endHoldRemainingSec = 0;
    this.usingSmoothFadeOut = false;
    this.activeFadeOutSec = opts?.fadeOutSec ?? 0.28;
    this.activeEndHoldSec = opts?.endHoldSec ?? 0;

    nextAction.setLoop(nextLoop ? LoopRepeat : LoopOnce, nextLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !nextLoop;
    nextAction.setEffectiveTimeScale(nextSpeed);

    const sameAction = prevAction === nextAction;
    const shouldStartFresh = !sameAction || !nextAction.isRunning() || opts?.restart === true;

    if (shouldStartFresh) {
      if (!sameAction && prevAction && this.blendWeight > 0.05 && prevAction.enabled) {
        if (prevClip && prevClip !== clip) {
          this.retiredClips.add(prevClip);
        }
        nextAction.reset();
        nextAction.enabled = true;
        nextAction.setEffectiveWeight(1);
        nextAction.setEffectiveTimeScale(nextSpeed);
        if (opts?.syncTimeSec && clip.duration > 0) {
          nextAction.time = opts.syncTimeSec % clip.duration;
        }
        nextAction.play();
        prevAction.crossFadeTo(nextAction, crossFadeSec, false);
        this.crossFadeRemainingSec = Math.max(0, crossFadeSec);
      } else {
        this.crossFadeRemainingSec = 0;
        this.mixer.stopAllAction();
        this.flushRetiredClips(clip);
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
    this.activeAllowWhileMoving = opts?.allowWhileMoving ?? false;
    this.activeSpeed = nextSpeed;
    this.targetActive = true;
  }

  fadeIn(clip: AnimationClip, durationSec = 0.28, opts?: Omit<MotionPlayOptions, 'crossFadeSec'>): void {
    this.play(clip, { ...opts, crossFadeSec: durationSec });
  }

  stop(): void {
    this.beginFadeOut(false);
  }

  fadeOut(immediate = false): void {
    this.holdingAtEnd = false;
    this.endHoldRemainingSec = 0;
    this.targetActive = false;
    this.usingSmoothFadeOut = false;
    if (immediate) {
      this.blendWeight = 0;
      this.mixer.stopAllAction();
      this.flushRetiredClips();
      if (this.activeAction) {
        this.mixer.uncacheAction(this.activeAction.getClip(), this.rootObject);
        this.activeAction = null;
      }
    } else {
      this.beginFadeOut(false);
    }
  }

  returnToIdle(): void {
    this.beginFadeOut(false);
  }

  /** Updates the blend envelope between procedural locomotion and clip playback; returns true when fully exited. */
  stepBlend(seated: boolean, interruptedByMotion: boolean, dtSec: number): boolean {
    if (seated) {
      this.fadeOut(true);
      return true;
    }
    if (interruptedByMotion && (this.targetActive || this.holdingAtEnd || this.usingSmoothFadeOut)) {
      this.beginFadeOut(true);
    }

    if (this.holdingAtEnd && dtSec > 0) {
      this.endHoldRemainingSec -= dtSec;
      if (this.endHoldRemainingSec <= 0) {
        this.beginFadeOut(false);
        this.onFinishedCb?.();
      }
    }

    const targetBlend = (this.targetActive || this.holdingAtEnd) && this.activeAction !== null ? 1 : 0;
    if (targetBlend === 1) {
      this.usingSmoothFadeOut = false;
    }

    if (dtSec > 0) {
      if (targetBlend === 0 && this.usingSmoothFadeOut) {
        this.fadeOutElapsedSec += dtSec;
        const progress = Math.min(1, this.fadeOutElapsedSec / Math.max(0.25, this.activeFadeOutSec));
        // Raised cosine eases smoothly off floor/prone or turned end-poses instead of popping upright immediately
        const ease = 0.5 + 0.5 * Math.cos(Math.PI * progress);
        this.blendWeight = progress >= 1 ? 0 : this.fadeOutStartWeight * ease;
      } else {
        this.blendWeight = dampWeight(this.blendWeight, targetBlend, targetBlend > 0 ? 12 : 15, dtSec);
      }
      if (Math.abs(targetBlend - this.blendWeight) < 0.002) {
        this.blendWeight = targetBlend;
      }
    } else {
      this.blendWeight = targetBlend;
    }

    if (this.crossFadeRemainingSec > 0 && dtSec > 0) {
      this.crossFadeRemainingSec = Math.max(0, this.crossFadeRemainingSec - dtSec);
    }

    if (this.blendWeight >= 0.999 && this.crossFadeRemainingSec <= 0 && this.retiredClips.size > 0) {
      this.flushRetiredClips(this.activeAction?.getClip());
    }

    if (this.blendWeight <= 0 && !this.targetActive && !this.holdingAtEnd && this.activeAction !== null) {
      const clip = this.activeAction.getClip();
      this.mixer.stopAllAction();
      this.flushRetiredClips();
      this.mixer.uncacheAction(clip, this.rootObject);
      this.activeAction = null;
      this.usingSmoothFadeOut = false;
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
    locomotionMoveWeight = 0,
  ): void {
    if (this.blendWeight <= 0 || this.activeAction === null) return;

    const isBlending = this.blendWeight < 0.999;
    const preserveWalkingLegs =
      this.activeAllowWhileMoving && locomotionMoveWeight > 0.01;

    if (isBlending || preserveWalkingLegs) {
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
        const entry = restList[i];
        const b = entry.bone;
        const effectiveWeight =
          preserveWalkingLegs && entry.isLowerBodyLeg
            ? this.blendWeight * (1 - Math.min(1, locomotionMoveWeight))
            : this.blendWeight;
        procQuats[i].slerp(b.quaternion, effectiveWeight);
        b.quaternion.copy(procQuats[i]);
      }
      this.hipsActionPos.copy(hipsBone.position);
      hipsBone.position.lerpVectors(hipsRestPos, this.hipsActionPos, this.blendWeight);
      const posWeight = preserveWalkingLegs
        ? this.blendWeight * (1 - Math.min(1, locomotionMoveWeight))
        : this.blendWeight;
      placementObj.position.lerpVectors(procPlacementPos, this.zeroPlacementPos, posWeight);
    } else if (preserveWalkingLegs) {
      const legProceduralWeight = Math.min(1, locomotionMoveWeight);
      for (let i = 0; i < restList.length; i++) {
        const entry = restList[i];
        if (entry.isLowerBodyLeg) {
          entry.bone.quaternion.slerp(procQuats[i], legProceduralWeight);
        }
      }
      placementObj.position.lerpVectors(
        this.zeroPlacementPos,
        procPlacementPos,
        legProceduralWeight,
      );
    } else {
      placementObj.position.copy(this.zeroPlacementPos);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.holdingAtEnd = false;
    this.usingSmoothFadeOut = false;
    this.mixer.removeEventListener('finished', this.handleMixerFinished);
    this.mixer.stopAllAction();
    this.flushRetiredClips();
    if (this.activeAction) {
      this.mixer.uncacheAction(this.activeAction.getClip(), this.rootObject);
      this.activeAction = null;
    }
    this.mixer.uncacheRoot(this.rootObject);
    this.onFinishedCb = null;
  }
}
