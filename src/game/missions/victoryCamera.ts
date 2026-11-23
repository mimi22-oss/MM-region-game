/**
 * Cinematic front-facing drone orbit camera for Mission Victory celebrations
 * (Ghost Mission 3/3 Victory & Zombie Forest 13/13 Victory).
 *
 * Sweeps smoothly in an elevated aerial arc from the player's current camera angle
 * right around to directly face the character's front/face (`-sin(bodyYaw), -cos(bodyYaw)`),
 * framing the `victory.glb` celebration head-on, then gently hovers until dismissed and
 * glides smoothly back to the gameplay camera.
 */

import type { VictoryMissionKind } from './missionVictory.ts';

export interface VictoryDroneCameraPose {
  readonly active: boolean;
  /** Smooth [0, 1] blend between normal gameplay camera and victory drone view. */
  readonly blend: number;
  readonly camX: number;
  readonly camY: number;
  readonly camZ: number;
  readonly lookX: number;
  readonly lookY: number;
  readonly lookZ: number;
  /** Subtle hero portrait FOV shift (degrees, negative = slight telephoto portrait framing). */
  readonly fovOffsetDeg: number;
  /** True while sweeping/holding in front of the character (before smooth return starts). */
  readonly lockingMovement: boolean;
}

export const VICTORY_DRONE_SWEEP_SEC = 2.05;
export const VICTORY_DRONE_EASE_IN_SEC = 0.28;
export const VICTORY_DRONE_RETURN_SEC = 0.75;
export const VICTORY_POPUP_DELAY_MS = 3800;

interface InternalVictoryCamState {
  active: boolean;
  phase: 'idle' | 'sweep' | 'hold' | 'return';
  mission: VictoryMissionKind | null;
  elapsed: number;
  holdElapsed: number;
  returnElapsed: number;
  startAngleCaptured: boolean;
  startAngleRad: number;
  sweepDeltaRad: number;
  startRadiusM: number;
  startHeightOffsetM: number;
  lastCamX: number;
  lastCamY: number;
  lastCamZ: number;
  lastLookX: number;
  lastLookY: number;
  lastLookZ: number;
  lastFovOffsetDeg: number;
}

const state: InternalVictoryCamState = {
  active: false,
  phase: 'idle',
  mission: null,
  elapsed: 0,
  holdElapsed: 0,
  returnElapsed: 0,
  startAngleCaptured: false,
  startAngleRad: 0,
  sweepDeltaRad: Math.PI,
  startRadiusM: 5.5,
  startHeightOffsetM: 2.2,
  lastCamX: 0,
  lastCamY: 2,
  lastCamZ: 0,
  lastLookX: 0,
  lastLookY: 1.4,
  lastLookZ: 0,
  lastFovOffsetDeg: 0,
};

function wrapAngleRad(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Starts the cinematic victory drone orbit that swings around to face the character head-on. */
export function triggerVictoryDroneCamera(mission: VictoryMissionKind): void {
  state.active = true;
  state.phase = 'sweep';
  state.mission = mission;
  state.elapsed = 0;
  state.holdElapsed = 0;
  state.returnElapsed = 0;
  state.startAngleCaptured = false;
  state.startAngleRad = 0;
  state.sweepDeltaRad = Math.PI;
  state.startRadiusM = 5.5;
  state.startHeightOffsetM = 2.2;
}

/** Begins the smooth return transition back to normal gameplay camera (e.g. when closing Victory Dialog). */
export function dismissVictoryDroneCamera(): void {
  if (!state.active) return;
  if (state.phase === 'return') return;
  state.phase = 'return';
  state.returnElapsed = 0;
}

/** Immediately clears the victory drone camera (e.g. on mission reset or teleport). */
export function resetVictoryDroneCamera(): void {
  state.active = false;
  state.phase = 'idle';
  state.mission = null;
  state.elapsed = 0;
  state.holdElapsed = 0;
  state.returnElapsed = 0;
  state.startAngleCaptured = false;
}

export function isVictoryDroneCameraActive(): boolean {
  return state.active;
}

export function isVictoryDroneLockingMovement(): boolean {
  return state.active && (state.phase === 'sweep' || state.phase === 'hold');
}

/**
 * Advances and computes the front-facing victory drone camera pose.
 *
 * Avatar facing convention in `Player.tsx` / `avatarHeading.ts`:
 * - Face forward vector is `(-Math.sin(bodyYaw), -Math.cos(bodyYaw))`.
 * - Placing the camera along that vector looking back at the character shows their face straight-on.
 */
export function stepVictoryDroneCamera(
  rawDt: number,
  opts: {
    playerX: number;
    playerGroundY: number;
    playerZ: number;
    bodyYaw: number;
    bodyScale?: number;
    currentCamX?: number;
    currentCamY?: number;
    currentCamZ?: number;
  },
): VictoryDroneCameraPose | null {
  if (!state.active) return null;

  const dt = Math.max(0, Math.min(rawDt, 0.1));
  const scale = opts.bodyScale ?? 1;

  // Front-of-face unit vector for -Z-forward avatar convention
  const frontX = -Math.sin(opts.bodyYaw);
  const frontZ = -Math.cos(opts.bodyYaw);
  const frontAngle = Math.atan2(frontX, frontZ);

  // Capture initial orbit angle from the player's current camera on the first frame so the sweep starts seamlessly
  if (!state.startAngleCaptured) {
    state.startAngleCaptured = true;
    const dx = typeof opts.currentCamX === 'number' ? opts.currentCamX - opts.playerX : -frontX * 5.2;
    const dz = typeof opts.currentCamZ === 'number' ? opts.currentCamZ - opts.playerZ : -frontZ * 5.2;
    const horizDist = Math.hypot(dx, dz);
    if (horizDist > 0.25) {
      state.startAngleRad = Math.atan2(dx, dz);
      state.startRadiusM = Math.max(3.4, Math.min(7.2, horizDist));
    } else {
      // First-person or zero-offset camera: sweep smoothly from behind-right around to front face
      state.startAngleRad = wrapAngleRad(frontAngle + Math.PI * 0.85);
      state.startRadiusM = 4.6;
    }
    if (typeof opts.currentCamY === 'number') {
      state.startHeightOffsetM = Math.max(1.5, Math.min(4.5, opts.currentCamY - opts.playerGroundY));
    } else {
      state.startHeightOffsetM = 2.2;
    }

    let delta = wrapAngleRad(frontAngle - state.startAngleRad);
    // If camera is already nearly in front, give a stylish ~42° drone curve into center-face
    if (Math.abs(delta) < 0.35) {
      delta = delta >= 0 ? 0.72 : -0.72;
      state.startAngleRad = wrapAngleRad(frontAngle - delta);
    }
    state.sweepDeltaRad = delta;
  }

  if (state.phase === 'return') {
    state.returnElapsed += dt;
    if (state.returnElapsed >= VICTORY_DRONE_RETURN_SEC) {
      resetVictoryDroneCamera();
      return null;
    }
    const v = Math.max(0, Math.min(1, state.returnElapsed / VICTORY_DRONE_RETURN_SEC));
    const blend = 1 - v * v * (3 - 2 * v);
    return {
      active: true,
      blend,
      camX: state.lastCamX,
      camY: state.lastCamY,
      camZ: state.lastCamZ,
      lookX: state.lastLookX,
      lookY: state.lastLookY,
      lookZ: state.lastLookZ,
      fovOffsetDeg: state.lastFovOffsetDeg * blend,
      lockingMovement: false,
    };
  }

  state.elapsed += dt;
  const sweepT = Math.max(0, Math.min(1, state.elapsed / VICTORY_DRONE_SWEEP_SEC));
  if (sweepT >= 1) {
    state.phase = 'hold';
    state.holdElapsed += dt;
  }

  // Snappy ease-in on blend so camera transitions cleanly from behind into the elevated drone orbit
  const blend =
    state.elapsed < VICTORY_DRONE_EASE_IN_SEC
      ? 1 - Math.pow(1 - state.elapsed / VICTORY_DRONE_EASE_IN_SEC, 3)
      : 1;

  // Cubic ease-out around the character, finishing straight in front of their face
  const sweepEase = 1 - Math.pow(1 - sweepT, 3);
  // Subtle gentle floating drone sway (±6°) once facing the hero's face
  const hoverSway = state.phase === 'hold' ? Math.sin(state.holdElapsed * 0.65) * 0.105 : 0;
  const angle = state.startAngleRad + state.sweepDeltaRad * sweepEase + hoverSway;

  // Aerial drone arc: pulls slightly wider & higher mid-sweep, then glides into a crisp front-face hero shot
  const finalRadius = 2.95 * Math.max(0.92, Math.min(1.12, scale));
  const sweepArcPull = 1.15 * Math.sin(Math.PI * sweepT);
  const hoverBreath = state.phase === 'hold' ? Math.sin(state.holdElapsed * 0.85) * 0.12 : 0;
  const radius = state.startRadiusM + (finalRadius - state.startRadiusM) * sweepEase + sweepArcPull + hoverBreath;

  const finalHeight = 1.72 * scale;
  const dronePeakLift = 1.45 * Math.sin(Math.PI * sweepT);
  const hoverBob = state.phase === 'hold' ? Math.sin(state.holdElapsed * 0.9 + 0.6) * 0.07 : 0;
  const heightOffset = state.startHeightOffsetM + (finalHeight - state.startHeightOffsetM) * sweepEase + dronePeakLift + hoverBob;

  const camX = opts.playerX + Math.sin(angle) * radius;
  const camZ = opts.playerZ + Math.cos(angle) * radius;
  const camY = opts.playerGroundY + heightOffset;

  // Frame the character's face & upper celebrating torso squarely in center screen
  const lookX = opts.playerX;
  const lookZ = opts.playerZ;
  const lookY = opts.playerGroundY + (1.36 + 0.08 * sweepEase) * scale;

  // Slight cinematic telephoto compression (-4 deg) as the drone settles in front of the face
  const fovOffsetDeg = -4.0 * sweepEase * blend;

  state.lastCamX = camX;
  state.lastCamY = camY;
  state.lastCamZ = camZ;
  state.lastLookX = lookX;
  state.lastLookY = lookY;
  state.lastLookZ = lookZ;
  state.lastFovOffsetDeg = fovOffsetDeg;

  return {
    active: true,
    blend,
    camX,
    camY,
    camZ,
    lookX,
    lookY,
    lookZ,
    fovOffsetDeg,
    lockingMovement: true,
  };
}
