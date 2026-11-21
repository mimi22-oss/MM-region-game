import {
  localToWorld,
  type FootballMatchState,
} from './footballMatch.ts';

/**
 * ============================================================================
 * TV-Broadcast Auto Camera for Live Football Matches ("Football View")
 * ============================================================================
 * Automatically frames:
 * - The ball carrier + 4–5 surrounding contesting players (Red vs Green)
 * - Shots flying into the goal mouth & goalkeeper diving catches/saves
 * - Sideline ball pickups, overhead throw-ins, and goal celebrations
 *
 * Supports 3 live-switchable broadcast camera angles:
 * - 'tv'          : Elevated sideline TV gantry view (classic stadium broadcast)
 * - 'close'       : Low pitchside action camera following the ball & nearby players
 * - 'goal-behind' : Behind-the-goal angle looking over the defending goalkeeper
 */

export type FootballCameraPreset = 'tv' | 'close' | 'goal-behind';

export interface FootballViewState {
  readonly active: boolean;
  readonly pitchId: string | null;
  readonly preset: FootballCameraPreset;
}

export const FOOTBALL_CAMERA_PRESETS: readonly {
  readonly id: FootballCameraPreset;
  readonly label: string;
}[] = [
  { id: 'tv', label: '📺 TV View' },
  { id: 'close', label: '🎥 Action Cam' },
  { id: 'goal-behind', label: '🥅 Goal Cam' },
];

const listeners = new Set<() => void>();
let viewState: FootballViewState = Object.freeze({
  active: false,
  pitchId: null,
  preset: 'tv',
});

function emit(): void {
  for (const listener of listeners) listener();
}

export function getFootballViewState(): FootballViewState {
  return viewState;
}

export function isFootballViewActive(): boolean {
  return viewState.active && viewState.pitchId !== null;
}

export function subscribeFootballView(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function enterFootballView(
  pitchId: string,
  preset: FootballCameraPreset = viewState.preset,
): void {
  if (viewState.active && viewState.pitchId === pitchId && viewState.preset === preset) return;
  viewState = Object.freeze({ active: true, pitchId, preset });
  emit();
}

export function exitFootballView(): void {
  if (!viewState.active && viewState.pitchId === null) return;
  viewState = Object.freeze({ active: false, pitchId: null, preset: viewState.preset });
  emit();
}

export function cycleFootballViewPreset(): FootballCameraPreset {
  const idx = FOOTBALL_CAMERA_PRESETS.findIndex((p) => p.id === viewState.preset);
  const next = FOOTBALL_CAMERA_PRESETS[(idx + 1) % FOOTBALL_CAMERA_PRESETS.length].id;
  viewState = Object.freeze({ ...viewState, preset: next });
  emit();
  return next;
}

export interface FootballCameraPose {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute target TV-broadcast camera position & look-at point in world space
 * for the current moment of a football match.
 */
export function computeFootballBroadcastTarget(
  match: FootballMatchState,
  preset: FootballCameraPreset,
): FootballCameraPose {
  const spec = match.spec;
  const b = match.ball;
  const pitchScale = clamp(spec.halfLength / 36, 0.34, 1.15);

  // 1. Compute centroid of the 4–5 closest outfield players around the ball
  let sumX = b.x * 2.4;
  let sumZ = b.z * 2.4;
  let weightTotal = 2.4;
  const nearby = match.players
    .map((p) => ({ p, d: Math.hypot(p.x - b.x, p.z - b.z) }))
    .sort((a, c) => a.d - c.d);

  const clusterCount = Math.min(5, nearby.length);
  for (let i = 0; i < clusterCount; i++) {
    const { p, d } = nearby[i];
    if (d > 18 * pitchScale + 5) break;
    const w = 1 / (1 + d * 0.18);
    sumX += p.x * w;
    sumZ += p.z * w;
    weightTotal += w;
  }

  let focusLocalX = sumX / weightTotal;
  let focusLocalZ = sumZ / weightTotal;
  let focusLocalY = 0.85 + Math.min(1.6, b.y * 0.45);
  let zoomTighten = 1.0;

  // Lead slightly in direction of ball velocity so viewers see incoming defenders & passes
  const ballSpeed = Math.hypot(b.vx, b.vz);
  if (ballSpeed > 1.2) {
    const lead = Math.min(3.4 * pitchScale, ballSpeed * 0.22);
    focusLocalX += (b.vx / ballSpeed) * lead * 0.6;
    focusLocalZ += (b.vz / ballSpeed) * lead;
  }

  // Dramatic goal-mouth framing when a shot is flying toward goal!
  if (b.isShot && b.shotTargetTeam) {
    const targetGoalZ = b.shotTargetTeam === 'red' ? -spec.halfLength : spec.halfLength;
    focusLocalX = b.x * 0.62;
    focusLocalZ = b.z * 0.56 + targetGoalZ * 0.44;
    focusLocalY = Math.max(1.15, Math.min(spec.goalHeight, b.y * 0.7 + 0.65));
    zoomTighten = 0.76;
  } else if (match.phase === 'goal-celebration') {
    // Zoom cleanly on the goal & celebrating scorers
    const scoredGoalZ = match.scoringTeam === 'red' ? spec.halfLength : -spec.halfLength;
    focusLocalX = b.x * 0.5;
    focusLocalZ = b.z * 0.4 + scoredGoalZ * 0.6;
    focusLocalY = 1.25;
    zoomTighten = 0.68;
  } else if (match.phase === 'gk-hold' || match.phase === 'gk-throw' || match.phase === 'gk-pickup') {
    const gk = match.players.find((p) => p.id === match.actingPlayerId);
    if (gk) {
      focusLocalX = gk.x * 0.8 + b.x * 0.2;
      focusLocalZ = gk.z * 0.8 + b.z * 0.2;
      focusLocalY = 1.25;
      zoomTighten = 0.78;
    }
  } else if (match.phase === 'throw-in-pickup' || match.phase === 'throw-in') {
    const taker = match.players.find((p) => p.id === match.actingPlayerId);
    if (taker) {
      focusLocalX = taker.x * 0.78;
      focusLocalZ = taker.z * 0.82 + b.z * 0.18;
      focusLocalY = 1.1;
      zoomTighten = 0.76;
    }
  }

  focusLocalX = clamp(focusLocalX, -spec.halfWidth - 1.5, spec.halfWidth + 1.5);
  focusLocalZ = clamp(focusLocalZ, -spec.halfLength - 1.5, spec.halfLength + 1.5);

  let camLocalX = 0;
  let camLocalZ = 0;
  let camLocalY = 8;

  if (preset === 'tv') {
    // Classic elevated sideline TV broadcast camera:
    // Frames 4–6 players around the ball and zooms smoothly into goalmouth shots/saves!
    const sideDist = clamp((13.5 + spec.halfWidth * 0.34) * zoomTighten, 7.8, 22.5);
    camLocalX = clamp(focusLocalX + sideDist, spec.halfWidth * 0.45 + 6.5, spec.halfWidth + 13.5);
    // Keep camera slightly trailing along Z like a real stadium TV camera on the halfway gantry
    camLocalZ = clamp(focusLocalZ * 0.74, -spec.halfLength * 0.82, spec.halfLength * 0.82);
    camLocalY = clamp((6.8 + spec.halfWidth * 0.16) * (0.85 + 0.15 * zoomTighten), 4.6, 12.2);
  } else if (preset === 'close') {
    // Dynamic pitchside sports cameraman tracking close to the 4–5 contesting players
    const dist = clamp((8.8 + 4.2 * pitchScale) * zoomTighten, 6.2, 13.5);
    const sideSign = focusLocalX > spec.halfWidth * 0.45 ? -1 : 1;
    camLocalX = clamp(focusLocalX + sideSign * dist * 0.85, -spec.halfWidth - 8, spec.halfWidth + 8);
    camLocalZ = clamp(focusLocalZ - Math.sign(focusLocalZ || 1) * dist * 0.48, -spec.halfLength - 6, spec.halfLength + 6);
    camLocalY = clamp((3.4 + 2.2 * pitchScale) * zoomTighten, 2.7, 6.2);
  } else {
    // Behind-the-goal TV camera: sits behind the goal currently under attack!
    const attackingPlusZ =
      b.shotTargetTeam === 'green' ||
      (b.shotTargetTeam !== 'red' && (b.z >= 0 || b.lastTouchTeam === 'red'));
    const endSign = attackingPlusZ ? 1 : -1;
    const behindOffset = clamp(7.2 + 5.5 * pitchScale, 5.8, 12.5);
    camLocalX = clamp(focusLocalX * 0.42, -spec.goalHalfWidth * 2.2, spec.goalHalfWidth * 2.2);
    camLocalZ = endSign * (spec.halfLength + behindOffset);
    camLocalY = clamp(4.2 + 2.8 * pitchScale, 3.6, 7.6);
  }

  const camW = localToWorld(spec, camLocalX, camLocalZ);
  const lookW = localToWorld(spec, focusLocalX, focusLocalZ);

  return {
    camX: camW.x,
    camY: spec.surfaceY + camLocalY,
    camZ: camW.z,
    lookX: lookW.x,
    lookY: spec.surfaceY + focusLocalY,
    lookZ: lookW.z,
  };
}

/**
 * Smoothly damp the broadcast camera pose toward the target pose each frame.
 */
export function stepFootballBroadcastPose(
  current: FootballCameraPose | null,
  target: FootballCameraPose,
  dt: number,
  isFastAction: boolean,
): FootballCameraPose {
  if (!current || dt <= 0) {
    return { ...target };
  }
  const safeDt = Math.min(dt, 0.1);
  const posAlpha = 1 - Math.exp(-(isFastAction ? 5.2 : 3.2) * safeDt);
  const lookAlpha = 1 - Math.exp(-(isFastAction ? 7.8 : 5.0) * safeDt);

  return {
    camX: current.camX + (target.camX - current.camX) * posAlpha,
    camY: current.camY + (target.camY - current.camY) * posAlpha,
    camZ: current.camZ + (target.camZ - current.camZ) * posAlpha,
    lookX: current.lookX + (target.lookX - current.lookX) * lookAlpha,
    lookY: current.lookY + (target.lookY - current.lookY) * lookAlpha,
    lookZ: current.lookZ + (target.lookZ - current.lookZ) * lookAlpha,
  };
}
