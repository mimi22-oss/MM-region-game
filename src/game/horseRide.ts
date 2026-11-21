/**
 * ============================================================================
 * Horse Riding Physics, Mounting State Machine & Nearby Horse Registry
 * ============================================================================
 * Supports riding BOTH:
 * 1. The saddled Myothar village riding horse parked near the farmhouse yard.
 * 2. Any paddy-field horse from `FieldLivestockBots` across the entire map.
 *
 * Mounting walks the rider to the near side before playing the stirrup climb.
 *
 * Riding controls (`phase = 'riding'`):
 * - 360° joystick & WASD/Arrows: walk in any direction (N/S/E/W)
 * - Sprint / Shift: fast gallop (`ပြေး`)
 * - Jump / Space: athletic horse jump (`ခုန်`)
 * - Horse icon / E: clean dismount onto clear ground
 */

import { horseStrideLength, planHorseMountApproach, type HorseMountApproach } from './horseAnimation.ts';
import { isHorseRidingUnlocked } from './missions/zombieForestMission.ts';

export const HORSE_LOCKED_MESSAGE = 'Zombie Mission ကို ပြီးအောင် လုပ်ပါ';

export type HorseRidePhase = 'idle' | 'mounting' | 'riding';

export interface HorseRideStatus {
  readonly phase: HorseRidePhase;
  readonly near: boolean;
  readonly nearHorseId: string | null;
  readonly speedKmh: number;
  readonly galloping: boolean;
  readonly airborne: boolean;
  readonly lockedNoticeSeq: number;
}

export interface HorseCandidate {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Livestock/world yaw where local +Z is horse forward. */
  readonly worldYaw: number;
  readonly coatIndex: number;
  readonly scale: number;
  readonly isFieldHorse: boolean;
}

export const HORSE_MOUNT_DURATION_SEC = 1.65;
export const HORSE_INTERACT_RADIUS_M = 3.8;
export const HORSE_WALK_SPEED = 4.6;
export const HORSE_GALLOP_SPEED = 10.8;
export const HORSE_JUMP_VELOCITY = 7.4;
export const HORSE_GRAVITY = 19.5;
export const HORSE_TURN_RATE = 7.2;

export const DEFAULT_RIDING_HORSE = {
  id: 'myothar-riding-horse',
  /** Open walkable yard/roadside 10m east-northeast of player spawn (2.8m clear perimeter) */
  x: 149.1,
  z: 235.32,
  /** Avatar-convention yaw (local -Z is horse forward). */
  yaw: 1.9,
  coatIndex: 0,
  scale: 1.06,
} as const;

export const horseRide = {
  phase: 'idle' as HorseRidePhase,
  mountElapsed: 0,
  mountApproach: null as HorseMountApproach | null,
  /** World position of the active/parked saddled riding horse */
  x: DEFAULT_RIDING_HORSE.x as number,
  z: DEFAULT_RIDING_HORSE.z as number,
  groundY: 0,
  /** Vertical height offset above ground during horse jumps */
  jumpY: 0,
  vy: 0,
  airborne: false,
  /** Avatar-convention yaw where local -Z is horse forward */
  yaw: DEFAULT_RIDING_HORSE.yaw as number,
  pitch: 0,
  speed: 0,
  galloping: false,
  stridePhase: 0,
  steerYaw: 0,
  coatIndex: DEFAULT_RIDING_HORSE.coatIndex as number,
  scale: DEFAULT_RIDING_HORSE.scale as number,
  /** If player mounted a FieldLivestockBots horse, its id is stored here so the bot stays hidden */
  mountedFieldHorseId: null as string | null,
  /** Pending mount/dismount requests triggered by UI button */
  mountRequested: false,
  dismountRequested: false,
  /** Nearest mountable horse candidate when player is on foot */
  nearHorse: null as HorseCandidate | null,
  cooldown: 0,
  lockedNoticeSeq: 0,
};

const fieldHorseCandidates = new Map<string, HorseCandidate>();
const statusListeners = new Set<() => void>();
let statusSnapshot: HorseRideStatus = Object.freeze({
  phase: 'idle',
  near: false,
  nearHorseId: null,
  speedKmh: 0,
  galloping: false,
  airborne: false,
  lockedNoticeSeq: 0,
});

function publishStatus(): void {
  const speedKmh = Math.round(horseRide.speed * 3.6);
  const near = horseRide.phase === 'idle' && horseRide.nearHorse !== null;
  const nearHorseId = near ? horseRide.nearHorse!.id : null;
  if (
    statusSnapshot.phase === horseRide.phase &&
    statusSnapshot.near === near &&
    statusSnapshot.nearHorseId === nearHorseId &&
    statusSnapshot.speedKmh === speedKmh &&
    statusSnapshot.galloping === horseRide.galloping &&
    statusSnapshot.airborne === horseRide.airborne &&
    statusSnapshot.lockedNoticeSeq === horseRide.lockedNoticeSeq
  ) {
    return;
  }
  statusSnapshot = Object.freeze({
    phase: horseRide.phase,
    near,
    nearHorseId,
    speedKmh,
    galloping: horseRide.galloping,
    airborne: horseRide.airborne,
    lockedNoticeSeq: horseRide.lockedNoticeSeq,
  });
  for (const fn of statusListeners) fn();
}

export function getHorseRideStatusSnapshot(): HorseRideStatus {
  return statusSnapshot;
}

export function subscribeHorseRide(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function isRidingOrMountingHorse(): boolean {
  return horseRide.phase === 'mounting' || horseRide.phase === 'riding';
}

export function getMountedFieldHorseId(): string | null {
  return horseRide.mountedFieldHorseId;
}

export function registerFieldHorseCandidate(
  id: string,
  x: number,
  z: number,
  worldYaw: number,
  coatIndex: number,
  scale: number,
): void {
  fieldHorseCandidates.set(id, {
    id,
    x,
    z,
    worldYaw,
    coatIndex,
    scale,
    isFieldHorse: true,
  });
}

export function unregisterFieldHorseCandidate(id: string): void {
  fieldHorseCandidates.delete(id);
}

export function clearFieldHorseCandidates(): void {
  fieldHorseCandidates.clear();
}

export function triggerHorseMountButton(): void {
  if (horseRide.phase === 'idle' && horseRide.nearHorse) {
    if (!isHorseRidingUnlocked()) {
      horseRide.lockedNoticeSeq += 1;
      publishStatus();
      return;
    }
    horseRide.mountRequested = true;
  }
}

export function triggerHorseDismountButton(): void {
  if (horseRide.phase === 'riding' || horseRide.phase === 'mounting') {
    horseRide.dismountRequested = true;
  }
}

export function resetHorseRide(resetPosition = false): void {
  horseRide.phase = 'idle';
  horseRide.mountElapsed = 0;
  horseRide.mountApproach = null;
  horseRide.stridePhase = 0;
  horseRide.speed = 0;
  horseRide.vy = 0;
  horseRide.jumpY = 0;
  horseRide.airborne = false;
  horseRide.galloping = false;
  horseRide.pitch = 0;
  horseRide.steerYaw = 0;
  horseRide.mountRequested = false;
  horseRide.dismountRequested = false;
  horseRide.cooldown = 0.6;
  if (resetPosition) {
    horseRide.x = DEFAULT_RIDING_HORSE.x;
    horseRide.z = DEFAULT_RIDING_HORSE.z;
    horseRide.yaw = DEFAULT_RIDING_HORSE.yaw;
    horseRide.coatIndex = DEFAULT_RIDING_HORSE.coatIndex;
    horseRide.scale = DEFAULT_RIDING_HORSE.scale;
    horseRide.mountedFieldHorseId = null;
  }
  publishStatus();
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function horseFootprintClear(
  x: number,
  z: number,
  yaw: number,
  clear: (x: number, z: number) => boolean,
): boolean {
  const dx = -Math.sin(yaw) * 0.72;
  const dz = -Math.cos(yaw) * 0.72;
  return clear(x, z) && clear(x + dx, z + dz) && clear(x - dx, z - dz);
}

export function updateHorseProximity(
  playerX: number,
  playerZ: number,
  eligible: boolean,
): HorseCandidate | null {
  if (!eligible || horseRide.phase !== 'idle' || horseRide.cooldown > 0) {
    if (horseRide.nearHorse !== null) {
      horseRide.nearHorse = null;
      publishStatus();
    }
    return null;
  }

  let best: HorseCandidate | null = null;
  let bestDist = HORSE_INTERACT_RADIUS_M;

  // 1. Check the parked saddled riding horse
  const dParked = Math.hypot(playerX - horseRide.x, playerZ - horseRide.z);
  if (dParked <= bestDist) {
    bestDist = dParked;
    best = {
      id: DEFAULT_RIDING_HORSE.id,
      x: horseRide.x,
      z: horseRide.z,
      worldYaw: normalizeAngle(horseRide.yaw + Math.PI),
      coatIndex: horseRide.coatIndex,
      scale: horseRide.scale,
      isFieldHorse: false,
    };
  }

  // 2. Check all nearby paddy-field horses
  for (const cand of fieldHorseCandidates.values()) {
    if (cand.id === horseRide.mountedFieldHorseId) continue;
    const d = Math.hypot(playerX - cand.x, playerZ - cand.z);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }

  horseRide.nearHorse = best;
  publishStatus();
  return best;
}

export function startMountingHorse(
  playerX: number,
  playerZ: number,
  clear: (x: number, z: number) => boolean,
  playerYaw = horseRide.yaw,
): boolean {
  if (!isHorseRidingUnlocked()) {
    horseRide.lockedNoticeSeq += 1;
    publishStatus();
    return false;
  }
  const cand = horseRide.nearHorse ?? updateHorseProximity(playerX, playerZ, true);
  if (!cand || horseRide.phase !== 'idle') return false;

  // Convert horse +Z forward yaw to avatar -Z forward yaw
  const avatarYaw = cand.isFieldHorse ? normalizeAngle(cand.worldYaw + Math.PI) : horseRide.yaw;
  if (!horseFootprintClear(cand.x, cand.z, avatarYaw, clear) && !clear(cand.x, cand.z)) {
    return false;
  }
  const cos = Math.cos(avatarYaw);
  const sin = Math.sin(avatarYaw);
  const dx = playerX - cand.x;
  const dz = playerZ - cand.z;
  const approach = planHorseMountApproach(
    dx * cos - dz * sin, dx * sin + dz * cos, normalizeAngle(playerYaw - avatarYaw), cand.scale,
    (x, z) => clear(cand.x + x * cos + z * sin, cand.z - x * sin + z * cos),
  );
  if (!approach) return false;

  horseRide.x = cand.x;
  horseRide.z = cand.z;
  horseRide.yaw = avatarYaw;
  horseRide.coatIndex = cand.coatIndex;
  horseRide.scale = cand.scale;
  if (cand.isFieldHorse) {
    horseRide.mountedFieldHorseId = cand.id;
  }
  horseRide.phase = 'mounting';
  horseRide.mountElapsed = 0;
  horseRide.mountApproach = approach;
  horseRide.stridePhase = 0;
  horseRide.pitch = 0;
  horseRide.speed = 0;
  horseRide.vy = 0;
  horseRide.jumpY = 0;
  horseRide.airborne = false;
  horseRide.galloping = false;
  horseRide.steerYaw = 0;
  horseRide.mountRequested = false;
  horseRide.dismountRequested = false;
  horseRide.nearHorse = null;
  publishStatus();
  return true;
}

export function dismountHorseSpot(
  clear: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  // Prefer left side (traditional equestrian dismount side) first, then right/rear/front
  for (const radius of [1.28, 1.65, 2.15]) {
    for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI, 0, Math.PI / 4, -Math.PI / 4]) {
      const nx = horseRide.x - Math.sin(horseRide.yaw + offset) * radius;
      const nz = horseRide.z - Math.cos(horseRide.yaw + offset) * radius;
      if (clear(nx, nz)) return { x: nx, z: nz };
    }
  }
  return clear(horseRide.x, horseRide.z) ? { x: horseRide.x, z: horseRide.z } : null;
}

export function completeHorseDismount(
  clear: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  if (horseRide.phase === 'idle') return null;
  if (horseRide.airborne) return null;
  const spot = dismountHorseSpot(clear);
  if (!spot) return null;
  horseRide.phase = 'idle';
  horseRide.mountElapsed = 0;
  horseRide.mountApproach = null;
  horseRide.speed = 0;
  horseRide.vy = 0;
  horseRide.jumpY = 0;
  horseRide.airborne = false;
  horseRide.galloping = false;
  horseRide.steerYaw = 0;
  horseRide.dismountRequested = false;
  horseRide.cooldown = 0.7;
  publishStatus();
  return spot;
}

export interface HorseRideStepInput {
  readonly forward: number;
  readonly right: number;
  readonly camYaw: number;
  readonly sprint: boolean;
  readonly jump: boolean;
  readonly speedScale?: number;
}

/**
 * Advances mounting animation or full 360° riding physics (walk / gallop / jump).
 */
export function stepHorseRide(
  rawDt: number,
  input: HorseRideStepInput,
  paused: boolean,
  height: (x: number, z: number) => number,
  clear: (x: number, z: number) => boolean,
): void {
  const dt = Math.min(0.05, Math.max(0, rawDt));
  if (horseRide.cooldown > 0) {
    horseRide.cooldown = Math.max(0, horseRide.cooldown - dt);
  }
  if (dt <= 0) return;

  if (horseRide.phase === 'idle') {
    horseRide.groundY = height(horseRide.x, horseRide.z);
    return;
  }

  if (paused) {
    horseRide.speed *= Math.max(0, 1 - dt * 8);
    publishStatus();
    return;
  }

  if (horseRide.phase === 'mounting') {
    horseRide.groundY = height(horseRide.x, horseRide.z);
    horseRide.jumpY = 0;
    horseRide.speed = 0;
    horseRide.mountElapsed += dt;
    if (horseRide.mountElapsed >= (horseRide.mountApproach?.seconds ?? 0) + HORSE_MOUNT_DURATION_SEC) {
      horseRide.phase = 'riding';
      horseRide.mountApproach = null;
    }
    publishStatus();
    return;
  }

  // Phase 2: Full riding (all-direction 360° walk, gallop/sprint, jump)
  const dirX = -Math.sin(input.camYaw) * input.forward + Math.cos(input.camYaw) * input.right;
  const dirZ = -Math.cos(input.camYaw) * input.forward - Math.sin(input.camYaw) * input.right;
  const inputMag = Math.min(1, Math.hypot(dirX, dirZ));

  const scaleMult = Math.max(0.75, Math.min(1.5, input.speedScale ?? 1));
  const targetMaxSpeed = input.sprint ? HORSE_GALLOP_SPEED : HORSE_WALK_SPEED * scaleMult;
  const desiredSpeed = inputMag > 0.08 ? targetMaxSpeed * inputMag : 0;

  if (desiredSpeed > horseRide.speed) {
    const accel = input.sprint ? 11.5 : 8.0;
    horseRide.speed = Math.min(desiredSpeed, horseRide.speed + accel * dt);
  } else {
    const decel = inputMag > 0.08 ? 6.5 : 10.5;
    horseRide.speed = Math.max(desiredSpeed, horseRide.speed - decel * dt);
  }
  horseRide.galloping = horseRide.speed > HORSE_WALK_SPEED * 1.18;

  // Smoothly turn horse toward requested North/South/East/West or 360° joystick direction
  if (inputMag > 0.08) {
    const targetYaw = Math.atan2(-dirX, -dirZ);
    const diff = normalizeAngle(targetYaw - horseRide.yaw);
    const maxTurn = (horseRide.airborne ? HORSE_TURN_RATE * 0.45 : HORSE_TURN_RATE) * dt;
    const step = Math.max(-maxTurn, Math.min(maxTurn, diff));
    horseRide.yaw = normalizeAngle(horseRide.yaw + step);
    const targetSteer = Math.max(-0.55, Math.min(0.55, diff * 0.75));
    horseRide.steerYaw += (targetSteer - horseRide.steerYaw) * Math.min(1, dt * 10);
  } else {
    horseRide.steerYaw *= Math.max(0, 1 - dt * 8);
  }

  // Trigger Jump (ခုန်)
  if (input.jump && !horseRide.airborne) {
    horseRide.airborne = true;
    horseRide.vy = HORSE_JUMP_VELOCITY;
    // Slight forward athletic surge on takeoff when moving
    if (horseRide.speed > 0.4) {
      horseRide.speed = Math.min(HORSE_GALLOP_SPEED * 1.05, horseRide.speed + 1.4);
    }
  }

  // Advance horizontal movement with swept collision steps
  const moveDist = horseRide.speed * dt;
  const strideLength = horseStrideLength(horseRide.speed, horseRide.scale);
  let distance = 0;
  if (moveDist > 1e-4) {
    const steps = Math.max(1, Math.ceil(moveDist / 0.14));
    const stepD = moveDist / steps;
    const fx = -Math.sin(horseRide.yaw);
    const fz = -Math.cos(horseRide.yaw);
    for (let i = 0; i < steps; i++) {
      const nx = horseRide.x + fx * stepD;
      const nz = horseRide.z + fz * stepD;
      if (horseFootprintClear(nx, nz, horseRide.yaw, clear)) {
        horseRide.x = nx;
        horseRide.z = nz;
        distance += stepD;
      } else {
        // Try sliding along X or Z axis smoothly before stopping
        if (horseFootprintClear(nx, horseRide.z, horseRide.yaw, clear)) {
          horseRide.x = nx;
          distance += Math.abs(fx * stepD);
        } else if (horseFootprintClear(horseRide.x, nz, horseRide.yaw, clear)) {
          horseRide.z = nz;
          distance += Math.abs(fz * stepD);
        } else {
          horseRide.speed = 0;
          break;
        }
      }
    }
  }
  if (!horseRide.airborne) horseRide.stridePhase = (horseRide.stridePhase + distance / strideLength) % 1;

  // Vertical jump arc & ground slope pitch
  const groundHere = height(horseRide.x, horseRide.z);
  horseRide.groundY = groundHere;
  if (horseRide.airborne) {
    horseRide.jumpY += horseRide.vy * dt;
    horseRide.vy -= HORSE_GRAVITY * dt;
    if (horseRide.jumpY <= 0) {
      horseRide.jumpY = 0;
      horseRide.vy = 0;
      horseRide.airborne = false;
    }
    const jumpPitch = Math.max(-0.26, Math.min(0.32, horseRide.vy * 0.042));
    horseRide.pitch += (jumpPitch - horseRide.pitch) * Math.min(1, dt * 12);
  } else {
    const fx = -Math.sin(horseRide.yaw) * 0.85;
    const fz = -Math.cos(horseRide.yaw) * 0.85;
    const frontH = height(horseRide.x + fx, horseRide.z + fz);
    const rearH = height(horseRide.x - fx, horseRide.z - fz);
    const slopePitch = Math.atan2(frontH - rearH, 1.7);
    horseRide.pitch += (slopePitch - horseRide.pitch) * Math.min(1, dt * 10);
  }

  publishStatus();
}
