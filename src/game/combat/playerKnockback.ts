/**
 * Smooth collision-safe knockback trajectory & cinematic drone tracking camera
 * for Ghost strikes using `flying-back-away.glb`.
 *
 * Exact knockback distances per Ghost tier:
 * - `ghost-1`: 4.0m
 * - `ghost-2`: 6.0m
 * - `ghost-3`: 10.0m
 */

export const GHOST_KNOCKBACK_DIST_M: Readonly<Record<string, number>> = {
  'ghost-1': 4.0,
  'ghost-2': 6.0,
  'ghost-3': 10.0,
};

export function getGhostKnockbackDistance(ghostId: string): number {
  return GHOST_KNOCKBACK_DIST_M[ghostId] ?? 4.0;
}

export interface PlayerKnockbackLaunch {
  readonly distance: number;
  readonly durationSec: number;
  readonly arcHeightM: number;
  readonly playbackSpeed: number;
}

export interface PlayerKnockbackDroneCameraPose {
  readonly active: boolean;
  /** Smooth [0, 1] blend between normal gameplay camera and elevated cinematic drone shot. */
  readonly blend: number;
  readonly camX: number;
  readonly camY: number;
  readonly camZ: number;
  readonly lookX: number;
  readonly lookY: number;
  readonly lookZ: number;
  /** Extra wide-angle FOV boost in degrees during impact & flight. */
  readonly fovBoostDeg: number;
}

interface InternalKnockbackState {
  active: boolean;
  cameraActive: boolean;
  originX: number;
  originZ: number;
  ghostX: number;
  ghostZ: number;
  dirX: number;
  dirZ: number;
  sideSign: 1 | -1;
  faceYaw: number;
  totalDist: number;
  movedDist: number;
  elapsed: number;
  durationSec: number;
  arcHeightM: number;
  liftY: number;
  camElapsed: number;
  droneHoldSec: number;
  droneReturnSec: number;
  seq: number;
}

const kb: InternalKnockbackState = {
  active: false,
  cameraActive: false,
  originX: 0,
  originZ: 0,
  ghostX: 0,
  ghostZ: 0,
  dirX: 0,
  dirZ: 1,
  sideSign: 1,
  faceYaw: 0,
  totalDist: 0,
  movedDist: 0,
  elapsed: 0,
  durationSec: 0.8,
  arcHeightM: 0.7,
  liftY: 0,
  camElapsed: 0,
  droneHoldSec: 0.4,
  droneReturnSec: 0.55,
  seq: 0,
};

const MAX_COLLISION_SUBSTEP_M = 0.22;
const DRONE_EASE_IN_SEC = 0.18;
export const DEATH_DRONE_VIEW_SEC = 5.4;

/**
 * Ensures an elevated cinematic drone orbit is active for non-knockback deaths
 * (e.g. unarmed neck-grab, bot-fight KO, or bridge fall) during the 5s pre-Game-Over window.
 */
export function ensureDeathDroneCamera(opts: {
  playerX: number;
  playerZ: number;
  cameraX?: number;
  cameraZ?: number;
}): void {
  if (kb.cameraActive) return;
  const dx = typeof opts.cameraX === 'number' ? opts.playerX - opts.cameraX : 0;
  const dz = typeof opts.cameraZ === 'number' ? opts.playerZ - opts.cameraZ : 1;
  const len = Math.hypot(dx, dz);
  kb.active = false;
  kb.cameraActive = true;
  kb.originX = opts.playerX;
  kb.originZ = opts.playerZ;
  kb.ghostX = opts.playerX;
  kb.ghostZ = opts.playerZ;
  kb.dirX = len > 0.001 ? dx / len : 0;
  kb.dirZ = len > 0.001 ? dz / len : 1;
  kb.sideSign = 1;
  kb.totalDist = 4.0;
  kb.movedDist = 0;
  kb.elapsed = 0;
  kb.durationSec = 0.01;
  kb.arcHeightM = 0;
  kb.liftY = 0;
  kb.camElapsed = 0;
  kb.droneHoldSec = DEATH_DRONE_VIEW_SEC;
  kb.droneReturnSec = 0.5;
}

/** Launches the player flying backward away from a striking ghost and starts the cinematic drone view. */
export function triggerPlayerKnockback(opts: {
  ghostId: string;
  ghostX: number;
  ghostZ: number;
  playerX: number;
  playerZ: number;
  cameraX?: number;
  cameraZ?: number;
}): PlayerKnockbackLaunch {
  const distance = getGhostKnockbackDistance(opts.ghostId);
  const dx = opts.playerX - opts.ghostX;
  const dz = opts.playerZ - opts.ghostZ;
  const len = Math.hypot(dx, dz);
  const dirX = len > 0.001 ? dx / len : 0;
  const dirZ = len > 0.001 ? dz / len : 1;

  // Choose the lateral drone side closest to the current camera so the transition never whips 180° through the player
  const rightX = -dirZ;
  const rightZ = dirX;
  let sideSign: 1 | -1 = kb.seq % 2 === 0 ? 1 : -1;
  if (typeof opts.cameraX === 'number' && typeof opts.cameraZ === 'number') {
    const camDot = (opts.cameraX - opts.playerX) * rightX + (opts.cameraZ - opts.playerZ) * rightZ;
    if (Math.abs(camDot) > 0.15) {
      sideSign = camDot >= 0 ? 1 : -1;
    }
  }

  // Flight duration, parabolic airborne lift, and animation speed scale dramatically with 4m / 6m / 10m launch
  const durationSec = distance >= 8.5 ? 1.28 : distance >= 5.5 ? 1.0 : 0.8;
  const arcHeightM = distance >= 8.5 ? 1.65 : distance >= 5.5 ? 1.1 : 0.7;
  const playbackSpeed = distance >= 8.5 ? 1.08 : distance >= 5.5 ? 1.32 : 1.55;
  const droneHoldSec = distance >= 8.5 ? 0.55 : distance >= 5.5 ? 0.45 : 0.4;
  const droneReturnSec = distance >= 8.5 ? 0.65 : distance >= 5.5 ? 0.6 : 0.55;

  kb.active = true;
  kb.cameraActive = true;
  kb.originX = opts.playerX;
  kb.originZ = opts.playerZ;
  kb.ghostX = opts.ghostX;
  kb.ghostZ = opts.ghostZ;
  kb.dirX = dirX;
  kb.dirZ = dirZ;
  kb.sideSign = sideSign;
  // Keep avatar facing the ghost while flying backward away from it (-Z forward convention in Player.tsx)
  kb.faceYaw = Math.atan2(dirX, dirZ);
  kb.totalDist = distance;
  kb.movedDist = 0;
  kb.elapsed = 0;
  kb.durationSec = durationSec;
  kb.arcHeightM = arcHeightM;
  kb.liftY = 0;
  kb.camElapsed = 0;
  kb.droneHoldSec = droneHoldSec;
  kb.droneReturnSec = droneReturnSec;
  kb.seq += 1;

  return { distance, durationSec, arcHeightM, playbackSpeed };
}

export function isPlayerKnockbackActive(): boolean {
  return kb.active;
}

export function isPlayerKnockbackCameraActive(): boolean {
  return kb.cameraActive;
}

export function resetPlayerKnockback(): void {
  kb.active = false;
  kb.cameraActive = false;
  kb.movedDist = 0;
  kb.elapsed = 0;
  kb.totalDist = 0;
  kb.liftY = 0;
  kb.camElapsed = 0;
}

/**
 * Advances active knockback displacement along an ease-out trajectory (`1 - (1 - t)^2`)
 * with parabolic airborne lift (`sin(pi * t)`) and collision-safe substeps via `canMoveTo`.
 */
export function stepPlayerKnockback(
  rawDt: number,
  pos: { x: number; z: number },
  canMoveTo?: (x: number, z: number) => boolean,
): { active: boolean; moved: number; faceYaw: number | null; liftY: number } {
  if (!kb.active) return { active: false, moved: 0, faceYaw: null, liftY: 0 };
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return { active: true, moved: 0, faceYaw: kb.faceYaw, liftY: kb.liftY };

  kb.elapsed = Math.min(kb.durationSec, kb.elapsed + dt);
  const t = kb.durationSec > 0 ? kb.elapsed / kb.durationSec : 1;
  const eased = 1 - (1 - t) * (1 - t);
  const targetDist = kb.totalDist * eased;
  const deltaDist = Math.max(0, targetDist - kb.movedDist);

  let moved = 0;
  if (deltaDist > 0.0001) {
    const substeps = Math.max(1, Math.ceil(deltaDist / MAX_COLLISION_SUBSTEP_M));
    const stepLen = deltaDist / substeps;
    for (let i = 0; i < substeps; i++) {
      const nx = pos.x + kb.dirX * stepLen;
      const nz = pos.z + kb.dirZ * stepLen;
      if (!canMoveTo || canMoveTo(nx, nz)) {
        pos.x = nx;
        pos.z = nz;
        moved += stepLen;
      } else if (canMoveTo(nx, pos.z)) {
        moved += Math.abs(nx - pos.x);
        pos.x = nx;
      } else if (canMoveTo(pos.x, nz)) {
        moved += Math.abs(nz - pos.z);
        pos.z = nz;
      } else {
        break;
      }
    }
    kb.movedDist = targetDist;
  }

  const liftY = t >= 1 ? 0 : Math.sin(Math.PI * t) * kb.arcHeightM;
  kb.liftY = liftY;

  const faceYaw = kb.faceYaw;
  if (kb.elapsed >= kb.durationSec) {
    kb.active = false;
    kb.liftY = 0;
  }
  return { active: kb.active || moved > 0, moved, faceYaw, liftY };
}

/**
 * Advances and computes an elevated 3/4 cinematic drone tracking shot that frames
 * the strike, airborne knockback arc (4m / 6m / 10m), brief landing hold, and smooth camera return.
 * When `opts.fatalHold` is true (player died), keeps orbiting in a slow dramatic aerial drone view
 * for the full 5-second pre-Game-Over showcase instead of snapping back early.
 */
export function stepPlayerKnockbackCamera(
  rawDt: number,
  playerX: number,
  playerGroundY: number,
  playerZ: number,
  opts?: { fatalHold?: boolean },
): PlayerKnockbackDroneCameraPose | null {
  if (!kb.cameraActive) return null;
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  kb.camElapsed += dt;

  const fatalHold = Boolean(opts?.fatalHold);
  const holdEnd = fatalHold
    ? Math.max(kb.durationSec + kb.droneHoldSec, DEATH_DRONE_VIEW_SEC)
    : kb.durationSec + kb.droneHoldSec;
  const totalCamSec = holdEnd + kb.droneReturnSec;

  if (!fatalHold && kb.camElapsed >= totalCamSec) {
    kb.cameraActive = false;
    return null;
  }

  // Smooth ease-in on impact, steady hold through flight & landing beat (or full 5s death orbit), smoothstep return
  let blend = 1;
  if (kb.camElapsed < DRONE_EASE_IN_SEC) {
    const u = Math.max(0, Math.min(1, kb.camElapsed / DRONE_EASE_IN_SEC));
    blend = 1 - (1 - u) * (1 - u) * (1 - u);
  } else if (!fatalHold && kb.camElapsed > holdEnd) {
    const v = Math.max(0, Math.min(1, (kb.camElapsed - holdEnd) / Math.max(0.01, kb.droneReturnSec)));
    blend = 1 - v * v * (3 - 2 * v);
  }

  const flightT = kb.durationSec > 0 ? Math.max(0, Math.min(1, kb.camElapsed / kb.durationSec)) : 1;
  const easedFlight = 1 - (1 - flightT) * (1 - flightT);
  const postLandingSec = Math.max(0, kb.camElapsed - kb.durationSec);
  const settleT = Math.max(0, Math.min(1, postLandingSec / Math.max(0.01, kb.droneHoldSec + kb.droneReturnSec)));

  // Scale aerial drone framing to comfortably showcase 4m / 6m / 10m knockbacks
  const lateralDist = kb.totalDist >= 8.5 ? 8.2 : kb.totalDist >= 5.5 ? 6.6 : 5.4;
  const baseElevation = kb.totalDist >= 8.5 ? 5.4 : kb.totalDist >= 5.5 ? 4.3 : 3.4;
  const peakRise = (kb.totalDist >= 8.5 ? 1.15 : 0.75) * Math.sin(Math.PI * Math.min(1, flightT * 0.92));

  // Track between impact origin and the player's actual world position (respects wall stops cleanly)
  const trackFrac = 0.28 + 0.68 * easedFlight;
  const trackX = kb.originX + (playerX - kb.originX) * trackFrac;
  const trackZ = kb.originZ + (playerZ - kb.originZ) * trackFrac;

  // Dynamic drone sweep: starts slightly behind the strike and arcs alongside/ahead of landing
  const alongSweep = -1.75 + 3.15 * easedFlight + 0.45 * settleT;
  const lateralSweep = lateralDist * (0.86 + 0.22 * Math.sin(Math.PI * flightT));

  const sideX = -kb.dirZ * kb.sideSign;
  const sideZ = kb.dirX * kb.sideSign;

  // Brief high-energy impact micro-shake during first 0.32s
  const shakeDecay = kb.camElapsed < 0.35 ? Math.exp(-kb.camElapsed * 11) : 0;
  const shakeAmp = (kb.totalDist >= 8.5 ? 0.26 : kb.totalDist >= 5.5 ? 0.19 : 0.13) * shakeDecay;
  const shakeX = Math.sin(kb.camElapsed * 58) * shakeAmp;
  const shakeY = Math.cos(kb.camElapsed * 47) * shakeAmp * 0.65;
  const shakeZ = Math.sin(kb.camElapsed * 63 + 1.2) * shakeAmp;

  let offsetX = sideX * lateralSweep + kb.dirX * alongSweep;
  let offsetZ = sideZ * lateralSweep + kb.dirZ * alongSweep;
  let deathRise = 0;

  // During 5s fatal death showcase, slowly orbit & gently pull up around the fallen hero
  if (fatalHold && postLandingSec > 0) {
    const orbitRad = postLandingSec * 0.36 * kb.sideSign;
    const cosO = Math.cos(orbitRad);
    const sinO = Math.sin(orbitRad);
    const pullScale = 1 + Math.min(0.28, postLandingSec * 0.065);
    const rx = (offsetX * cosO - offsetZ * sinO) * pullScale;
    const rz = (offsetX * sinO + offsetZ * cosO) * pullScale;
    offsetX = rx;
    offsetZ = rz;
    deathRise = Math.min(1.4, postLandingSec * 0.32);
  }

  const camX = trackX + offsetX + shakeX;
  const camZ = trackZ + offsetZ + shakeZ;
  const camY = playerGroundY + baseElevation + peakRise + deathRise + shakeY;

  // Look target locks onto flying hero while keeping the ghost impact in frame at launch
  const ghostWeight = 0.16 * (1 - easedFlight);
  const lookX = playerX * (1 - ghostWeight) + kb.ghostX * ghostWeight;
  const lookZ = playerZ * (1 - ghostWeight) + kb.ghostZ * ghostWeight;
  const lookY = playerGroundY + kb.liftY * 0.85 + (fatalHold && postLandingSec > 0.3 ? 0.72 : 1.05);

  const maxFovBoost = kb.totalDist >= 8.5 ? 10 : kb.totalDist >= 5.5 ? 7.5 : 5.5;
  const fovBoostDeg = maxFovBoost * blend * (1 - 0.35 * settleT);

  return {
    active: true,
    blend,
    camX,
    camY,
    camZ,
    lookX,
    lookY,
    lookZ,
    fovBoostDeg,
  };
}
