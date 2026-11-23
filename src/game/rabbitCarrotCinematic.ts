/**
 * ============================================================================
 * 5-Second Auto-Bot Rabbit Carrot-Feeding Celebration Cinematic
 * (`ကျားအားလုံး နှိမ်နင်းပြီးနောက် Auto-Bot ဖြင့် ယုန်လေးများ ခါကျက်ဥနီ/မုန်လာဥနီ စားနေသည့် 5s View`)
 * ============================================================================
 */

import { useSyncExternalStore } from 'react';

export const RABBIT_CARROT_CINEMATIC_DURATION_SEC = 5.0;
export const RABBIT_CARROT_EASE_IN_SEC = 0.35;
export const RABBIT_CARROT_RETURN_SEC = 0.75;

export interface RabbitCarrotCinematicSnapshot {
  readonly active: boolean;
  readonly phase: 'idle' | 'showcase' | 'return';
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly facingYaw: number;
  readonly elapsed: number;
  readonly durationSec: number;
  readonly seq: number;
}

export interface RabbitCarrotCameraPose {
  readonly active: boolean;
  readonly blend: number;
  readonly camX: number;
  readonly camY: number;
  readonly camZ: number;
  readonly lookX: number;
  readonly lookY: number;
  readonly lookZ: number;
  readonly fovOffsetDeg: number;
  readonly lockingMovement: boolean;
}

interface InternalState {
  active: boolean;
  phase: 'idle' | 'showcase' | 'return';
  centerX: number;
  centerY: number;
  centerZ: number;
  facingYaw: number;
  elapsed: number;
  returnElapsed: number;
  seq: number;
  lastCamX: number;
  lastCamY: number;
  lastCamZ: number;
  lastLookX: number;
  lastLookY: number;
  lastLookZ: number;
  lastFovOffsetDeg: number;
}

const st: InternalState = {
  active: false,
  phase: 'idle',
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  facingYaw: 0,
  elapsed: 0,
  returnElapsed: 0,
  seq: 0,
  lastCamX: 0,
  lastCamY: 2,
  lastCamZ: 4,
  lastLookX: 0,
  lastLookY: 0.6,
  lastLookZ: 0,
  lastFovOffsetDeg: 0,
};

let snap: RabbitCarrotCinematicSnapshot = Object.freeze({
  active: false,
  phase: 'idle',
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  facingYaw: 0,
  elapsed: 0,
  durationSec: RABBIT_CARROT_CINEMATIC_DURATION_SEC,
  seq: 0,
});

const listeners = new Set<() => void>();

function emit(): void {
  snap = Object.freeze({
    active: st.active,
    phase: st.phase,
    centerX: st.centerX,
    centerY: st.centerY,
    centerZ: st.centerZ,
    facingYaw: st.facingYaw,
    elapsed: st.elapsed,
    durationSec: RABBIT_CARROT_CINEMATIC_DURATION_SEC,
    seq: st.seq,
  });
  for (const fn of listeners) fn();
}

export function getRabbitCarrotCinematicSnapshot(): RabbitCarrotCinematicSnapshot {
  return snap;
}

export function subscribeRabbitCarrotCinematic(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRabbitCarrotCinematic(): RabbitCarrotCinematicSnapshot {
  return useSyncExternalStore(
    subscribeRabbitCarrotCinematic,
    getRabbitCarrotCinematicSnapshot,
    getRabbitCarrotCinematicSnapshot,
  );
}

/**
 * Places the Auto-Bot + Carrots + 5 Nibbling Rabbits right in front of the player
 * on the mountain meadow and starts the 5.0-second cinematic drone showcase.
 */
export function triggerRabbitCarrotCinematic(opts: {
  playerX: number;
  playerGroundY: number;
  playerZ: number;
  bodyYaw?: number;
}): void {
  const yaw = opts.bodyYaw ?? 0;
  // Place scenic feeding meadow 3.4m ahead of the player's facing direction (-Z forward convention)
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);

  st.active = true;
  st.phase = 'showcase';
  st.centerX = opts.playerX + fx * 3.4;
  st.centerY = opts.playerGroundY;
  st.centerZ = opts.playerZ + fz * 3.4;
  st.facingYaw = yaw;
  st.elapsed = 0;
  st.returnElapsed = 0;
  st.seq += 1;
  emit();
}

export function resetRabbitCarrotCinematic(): void {
  if (!st.active && st.phase === 'idle') return;
  st.active = false;
  st.phase = 'idle';
  st.elapsed = 0;
  st.returnElapsed = 0;
  emit();
}

export function isRabbitCarrotCinematicActive(): boolean {
  return st.active;
}

export function isRabbitCarrotLockingMovement(): boolean {
  return st.active && st.phase === 'showcase';
}

/**
 * Advances the 5.0-second cinematic showcase around the Auto-Bot & carrot-eating rabbits,
 * then smoothly returns (`0.75s`) to the player's normal gameplay camera.
 */
export function stepRabbitCarrotCamera(
  rawDt: number,
  groundHeightAt?: (x: number, z: number) => number,
): RabbitCarrotCameraPose | null {
  if (!st.active) return null;
  const dt = Math.max(0, Math.min(rawDt, 0.1));

  const centerGroundY = groundHeightAt ? groundHeightAt(st.centerX, st.centerZ) : st.centerY;
  st.centerY = centerGroundY;

  if (st.phase === 'return') {
    st.returnElapsed += dt;
    if (st.returnElapsed >= RABBIT_CARROT_RETURN_SEC) {
      resetRabbitCarrotCinematic();
      return null;
    }
    const v = Math.max(0, Math.min(1, st.returnElapsed / RABBIT_CARROT_RETURN_SEC));
    const blend = 1 - v * v * (3 - 2 * v);
    return {
      active: true,
      blend,
      camX: st.lastCamX,
      camY: st.lastCamY,
      camZ: st.lastCamZ,
      lookX: st.lastLookX,
      lookY: st.lastLookY,
      lookZ: st.lastLookZ,
      fovOffsetDeg: st.lastFovOffsetDeg * blend,
      lockingMovement: false,
    };
  }

  st.elapsed += dt;
  if (st.elapsed >= RABBIT_CARROT_CINEMATIC_DURATION_SEC) {
    st.phase = 'return';
    st.returnElapsed = 0;
    emit();
    return {
      active: true,
      blend: 1,
      camX: st.lastCamX,
      camY: st.lastCamY,
      camZ: st.lastCamZ,
      lookX: st.lastLookX,
      lookY: st.lastLookY,
      lookZ: st.lastLookZ,
      fovOffsetDeg: st.lastFovOffsetDeg,
      lockingMovement: false,
    };
  }

  const t = Math.max(0, Math.min(1, st.elapsed / RABBIT_CARROT_CINEMATIC_DURATION_SEC));
  const blend =
    st.elapsed < RABBIT_CARROT_EASE_IN_SEC
      ? 1 - Math.pow(1 - st.elapsed / RABBIT_CARROT_EASE_IN_SEC, 3)
      : 1;

  // Warm low-angle aerial drone sweep orbiting gently (~65 deg) around the Auto-Bot & munching rabbits
  const baseAngle = st.facingYaw + Math.PI * 0.16;
  const orbitAngle = baseAngle - 0.52 + 1.08 * t;
  const radius = 4.1 - 0.55 * Math.sin(Math.PI * t);
  const elev = 1.65 + 0.35 * Math.sin(Math.PI * t);

  const camX = st.centerX + Math.sin(orbitAngle) * radius;
  const camZ = st.centerZ + Math.cos(orbitAngle) * radius;
  const camY = centerGroundY + elev;

  const lookX = st.centerX;
  const lookZ = st.centerZ;
  const lookY = centerGroundY + 0.58;
  const fovOffsetDeg = -4.5 * blend;

  st.lastCamX = camX;
  st.lastCamY = camY;
  st.lastCamZ = camZ;
  st.lastLookX = lookX;
  st.lastLookY = lookY;
  st.lastLookZ = lookZ;
  st.lastFovOffsetDeg = fovOffsetDeg;

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
