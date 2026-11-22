import { Vector3, type Object3D } from 'three';
import {
  GHOST_IDS,
  GROUP_SHIELD_RADIUS_M,
  SWORD_DAMAGE,
  damageMissionGhost,
  getActiveMissionWeapon,
  getThreeGhostsProgress,
  isGhostDefeated,
} from '../missions/threeGhostsMission.ts';
import { getGhostRuntime } from '../missions/ghostRuntimeRegistry.ts';
import {
  damageZombie,
  getZombieForestProgress,
} from '../missions/zombieForestMission.ts';
import { requestGhostReaction } from './GhostCombatReactions.ts';
import { clearGhostEncounterInteraction } from '../ghostConfig.ts';
import { canStand, treeBlocks } from '../collision.ts';
import { combatEffects, combatLineClear, playerCombat } from './combatRuntime.ts';
import { playSpecialAction } from '../specialActions.ts';
import { gameAudio } from '../gameAudio.ts';
import {
  WEAPON_GUNSHOT_AUDIO_FILES,
  pickCachedSfxBuffer,
  preloadSfxBuffers,
} from '../audio/sfxBufferCache.ts';

export const GUN_DAMAGE = SWORD_DAMAGE;
export const GUN_RANGE_M = 32;
export const GUN_COOLDOWN_SEC = 0.25;
/** Strict PUBG-style ray-to-body hit radii (no off-aim magic cone hits). */
export const GUN_ZOMBIE_HIT_RADIUS_M = 0.65;
export const GUN_GHOST_BASE_HIT_RADIUS_M = 0.78;
export const GUN_AIM_CONE_COS = 0.96;
export const GUN_SHOOTING_MOTION_ID = 'shooting';

export interface GunAimTarget {
  readonly id: string;
  readonly kind: 'zombie' | 'ghost';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distance: number;
}

export interface GunAimPreview {
  readonly active: boolean;
  readonly locked: boolean;
  readonly target: GunAimTarget | null;
  readonly fromX: number;
  readonly fromY: number;
  readonly fromZ: number;
  readonly pointX: number;
  readonly pointY: number;
  readonly pointZ: number;
}

export interface GunAimHudSnapshot {
  readonly locked: boolean;
  readonly kind: 'zombie' | 'ghost' | null;
}

const gunAimHudListeners = new Set<() => void>();
let gunAimHudSnapshot: GunAimHudSnapshot = Object.freeze({ locked: false, kind: null });

export function getGunAimHudSnapshot(): GunAimHudSnapshot {
  return gunAimHudSnapshot;
}

export function subscribeGunAimHud(listener: () => void): () => void {
  gunAimHudListeners.add(listener);
  return () => {
    gunAimHudListeners.delete(listener);
  };
}

function publishGunAimHud(locked: boolean, kind: 'zombie' | 'ghost' | null): void {
  if (gunAimHudSnapshot.locked === locked && gunAimHudSnapshot.kind === kind) return;
  gunAimHudSnapshot = Object.freeze({ locked, kind });
  for (const fn of gunAimHudListeners) fn();
}

export function clearGunAimHud(): void {
  publishGunAimHud(false, null);
}

let heldGun: {
  root: Object3D;
  avatar: Object3D;
  muzzle: Object3D;
} | null = null;

export function registerCombatGun(root: Object3D, avatar: Object3D): () => void {
  const muzzle = root.getObjectByName('gun-muzzle-tip') ?? root;
  const entry = { root, avatar, muzzle };
  heldGun = entry;
  // Preload real gunshot MP3 buffers so the very first shot plays crisp sampled audio
  preloadSfxBuffers(gameAudio.context, WEAPON_GUNSHOT_AUDIO_FILES);
  return () => {
    if (heldGun === entry) {
      heldGun = null;
    }
  };
}

export type GunHitKind = 'zombie' | 'ghost' | 'tree' | 'building';

export interface GunTracerEffect {
  readonly from: Vector3;
  readonly to: Vector3;
  at: number;
  hit: boolean;
  seq: number;
}

export interface GunImpactFireEffect {
  readonly position: Vector3;
  at: number;
  kind: GunHitKind;
  seq: number;
}

export const gunEffects = {
  time: 0,
  lastShotAt: -100,
  shotsFired: 0,
  tracerHead: 0,
  impactHead: 0,
  tracers: Array.from({ length: 12 }, (): GunTracerEffect => ({
    from: new Vector3(),
    to: new Vector3(),
    at: -100,
    hit: false,
    seq: 0,
  })),
  impacts: Array.from({ length: 12 }, (): GunImpactFireEffect => ({
    position: new Vector3(),
    at: -100,
    kind: 'zombie',
    seq: 0,
  })),
};

/**
 * Ray-marches along the forward shot vector `(fx, fz)` from `(startX, startZ)` to detect
 * the first solid Tree or Building impact point within `maxDistM`.
 */
export function traceGunObstacleImpact(
  startX: number,
  startZ: number,
  fx: number,
  fz: number,
  maxDistM = GUN_RANGE_M,
): { x: number; z: number; distance: number; kind: 'tree' | 'building' } | null {
  const stepM = 0.22;
  const steps = Math.max(1, Math.ceil(maxDistM / stepM));
  for (let i = 2; i <= steps; i++) {
    const dist = Math.min(maxDistM, i * stepM);
    const x = startX + fx * dist;
    const z = startZ + fz * dist;
    if (treeBlocks(x, z)) {
      return { x, z, distance: dist, kind: 'tree' };
    }
    if (!canStand(x, z, 0, true)) {
      return { x, z, distance: dist, kind: 'building' };
    }
  }
  return null;
}

/**
 * Strictly checks whether the forward gun barrel ray `(px, pz) + t*(fx, fz)` directly
 * intersects a live Zombie or active Ghost (PUBG-style pointer lock, zero off-aim auto-hit).
 */
export function resolveGunAimTarget(
  px: number,
  pz: number,
  rawFx: number,
  rawFz: number,
  maxDistM = GUN_RANGE_M,
  obstacleDistM?: number | null,
): GunAimTarget | null {
  const fLen = Math.hypot(rawFx, rawFz) || 1;
  const fx = rawFx / fLen;
  const fz = rawFz / fLen;
  const limitDist =
    typeof obstacleDistM === 'number' && Number.isFinite(obstacleDistM)
      ? Math.min(maxDistM, obstacleDistM)
      : maxDistM;

  let bestTarget: GunAimTarget | null = null;

  // 1. Check live Zombies along exact forward ray
  const zombieState = getZombieForestProgress();
  for (const z of zombieState.zombies) {
    if (!z.alive || z.hitsRemaining <= 0) continue;
    const dx = z.x - px;
    const dz = z.z - pz;
    const along = dx * fx + dz * fz;
    if (along < 0.15 || along > limitDist) continue;
    const perp = Math.abs(dx * -fz + dz * fx);
    if (perp > GUN_ZOMBIE_HIT_RADIUS_M) continue;
    if (!combatLineClear(px, pz, z.x, z.z)) continue;
    if (!bestTarget || along < bestTarget.distance) {
      bestTarget = {
        id: z.id,
        kind: 'zombie',
        x: z.x,
        y: z.clip === 'crawl' ? 0.45 : 1.15,
        z: z.z,
        distance: along,
      };
    }
  }

  // 2. Check active Ghosts along exact forward ray
  for (const id of GHOST_IDS) {
    if (isGhostDefeated(id)) continue;
    const g = getGhostRuntime(id);
    if (!g || !g.active) continue;
    const dx = g.x - px;
    const dz = g.z - pz;
    const along = dx * fx + dz * fz;
    if (along < 0.15 || along > limitDist) continue;
    const perp = Math.abs(dx * -fz + dz * fx);
    if (perp > GUN_GHOST_BASE_HIT_RADIUS_M) continue;
    if (!combatLineClear(px, pz, g.x, g.z)) continue;
    if (!bestTarget || along < bestTarget.distance) {
      bestTarget = {
        id,
        kind: 'ghost',
        x: g.x,
        y: 1.3,
        z: g.z,
        distance: along,
      };
    }
  }

  return bestTarget;
}

/**
 * Evaluates the live 3D PUBG-style aim point from the currently registered held gun
 * and publishes lock-on state for the UI fire button.
 */
export function evaluateHeldGunAimPreview(): GunAimPreview | null {
  if (!heldGun || getActiveMissionWeapon() !== 'zombie-gun') {
    clearGunAimHud();
    return null;
  }
  heldGun.avatar.updateWorldMatrix(true, false);
  heldGun.root.updateWorldMatrix(true, false);
  heldGun.avatar.getWorldPosition(scratchPlayer);
  heldGun.muzzle.getWorldPosition(scratchMuzzle);
  scratchForward.set(0, 0, -1).transformDirection(heldGun.avatar.matrixWorld);
  const fLen = Math.hypot(scratchForward.x, scratchForward.z) || 1;
  const fx = scratchForward.x / fLen;
  const fz = scratchForward.z / fLen;

  const obstacle = traceGunObstacleImpact(scratchPlayer.x, scratchPlayer.z, fx, fz, GUN_RANGE_M);
  const target = resolveGunAimTarget(
    scratchPlayer.x,
    scratchPlayer.z,
    fx,
    fz,
    GUN_RANGE_M,
    obstacle?.distance ?? null,
  );

  publishGunAimHud(Boolean(target), target?.kind ?? null);

  if (target) {
    return {
      active: true,
      locked: true,
      target,
      fromX: scratchMuzzle.x,
      fromY: scratchMuzzle.y,
      fromZ: scratchMuzzle.z,
      pointX: target.x,
      pointY: target.y,
      pointZ: target.z,
    };
  }

  const fallbackDist = obstacle ? obstacle.distance : 15;
  return {
    active: true,
    locked: false,
    target: null,
    fromX: scratchMuzzle.x,
    fromY: scratchMuzzle.y,
    fromZ: scratchMuzzle.z,
    pointX: scratchMuzzle.x + fx * fallbackDist,
    pointY: scratchMuzzle.y,
    pointZ: scratchMuzzle.z + fz * fallbackDist,
  };
}

function playGunshotSound() {
  if (typeof window === 'undefined') return;
  if (!gameAudio.isActive()) return;

  // Prefer shared gameAudio graph + cached real gunshot MP3 samples
  const sharedCtx = gameAudio.context;
  const sharedOut = gameAudio.master;
  if (sharedCtx && sharedOut && sharedCtx.state === 'running') {
    const buffer = pickCachedSfxBuffer(sharedCtx, WEAPON_GUNSHOT_AUDIO_FILES);
    if (buffer) {
      try {
        const now = sharedCtx.currentTime;
        const src = sharedCtx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = 0.96 + Math.random() * 0.09;
        const gain = sharedCtx.createGain();
        gain.gain.setValueAtTime(0.85, now);
        src.connect(gain).connect(sharedOut);
        src.onended = () => {
          try {
            src.disconnect();
            gain.disconnect();
          } catch {}
        };
        src.start(now);
        return;
      } catch {
        // Fall through to short percussive synth fallback
      }
    }
  } else {
    preloadSfxBuffers(sharedCtx, WEAPON_GUNSHOT_AUDIO_FILES);
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = sharedCtx && sharedCtx.state === 'running' ? sharedCtx : new AudioCtx();
    const shouldClose = ctx !== sharedCtx;
    const now = ctx.currentTime;

    // Short percussive noise burst fallback while MP3 buffers are still decoding
    const bufferSize = Math.floor(ctx.sampleRate * 0.11);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(0.9, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sharedOut && !shouldClose ? sharedOut : ctx.destination);
    noise.start(now);
    noise.stop(now + 0.11);
    if (shouldClose) {
      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 220);
    }
  } catch {
    // ignore audio restrictions
  }
}

export interface GunShotOptions {
  readonly playerX?: number;
  readonly playerY?: number;
  readonly playerZ?: number;
  readonly forwardX?: number;
  readonly forwardZ?: number;
  readonly nowSec?: number;
  readonly ignoreCooldown?: boolean;
}

export interface GunShotResult {
  readonly fired: boolean;
  readonly hitId: string | null;
  readonly hitKind: GunHitKind | null;
  readonly defeated: boolean;
  readonly message: string;
}

const scratchPlayer = new Vector3();
const scratchMuzzle = new Vector3();
const scratchForward = new Vector3();

/**
 * Fires the equipped procedural 3D Gun, raycasting / cone-checking against live Zombies and Ghosts.
 */
export function requestGunShot(options: GunShotOptions = {}): GunShotResult {
  if (getActiveMissionWeapon() !== 'zombie-gun') {
    return {
      fired: false,
      hitId: null,
      hitKind: null,
      defeated: false,
      message: '',
    };
  }

  const nowSec =
    typeof options.nowSec === 'number'
      ? options.nowSec
      : gunEffects.time > 0
        ? gunEffects.time
        : Date.now() * 0.001;

  if (
    !options.ignoreCooldown &&
    nowSec - gunEffects.lastShotAt < GUN_COOLDOWN_SEC
  ) {
    return {
      fired: false,
      hitId: null,
      hitKind: null,
      defeated: false,
      message: '',
    };
  }

  let px = options.playerX ?? 0;
  let py = options.playerY ?? 1.25;
  let pz = options.playerZ ?? 0;
  let fx = options.forwardX ?? 0;
  let fz = options.forwardZ ?? -1;

  if (heldGun) {
    heldGun.avatar.updateWorldMatrix(true, false);
    heldGun.root.updateWorldMatrix(true, false);
    heldGun.avatar.getWorldPosition(scratchPlayer);
    heldGun.muzzle.getWorldPosition(scratchMuzzle);
    scratchForward.set(0, 0, -1).transformDirection(heldGun.avatar.matrixWorld);
    if (options.playerX === undefined) px = scratchPlayer.x;
    if (options.playerY === undefined) py = scratchMuzzle.y;
    if (options.playerZ === undefined) pz = scratchPlayer.z;
    if (options.forwardX === undefined && options.forwardZ === undefined) {
      fx = scratchForward.x;
      fz = scratchForward.z;
    }
  } else {
    scratchMuzzle.set(px, py, pz);
  }

  const fLen = Math.hypot(fx, fz) || 1;
  fx /= fLen;
  fz /= fLen;

  gunEffects.lastShotAt = nowSec;
  gunEffects.shotsFired++;
  playSpecialAction(GUN_SHOOTING_MOTION_ID, {
    loop: false,
    force: true,
    restart: true,
  });
  playGunshotSound();

  // Strict PUBG-style aim check: hit Zombie or Ghost ONLY when the pointer ray is directly on target
  const obstacleHit = traceGunObstacleImpact(px, pz, fx, fz, GUN_RANGE_M);
  const bestTarget = resolveGunAimTarget(
    px,
    pz,
    fx,
    fz,
    GUN_RANGE_M,
    obstacleHit?.distance ?? null,
  );

  const tracer = gunEffects.tracers[gunEffects.tracerHead++ % gunEffects.tracers.length];
  if (heldGun) {
    tracer.from.copy(scratchMuzzle);
  } else {
    tracer.from.set(px + fx * 0.45, py, pz + fz * 0.45);
  }
  tracer.at = gunEffects.time;
  tracer.seq = gunEffects.shotsFired;

  if (!bestTarget) {
    // Check if the straight forward shot hits a Tree or Building
    if (obstacleHit) {
      tracer.to.set(obstacleHit.x, tracer.from.y, obstacleHit.z);
      tracer.hit = true;

      const gunImpact =
        gunEffects.impacts[gunEffects.impactHead++ % gunEffects.impacts.length];
      gunImpact.position.copy(tracer.to);
      gunImpact.at = gunEffects.time;
      gunImpact.kind = obstacleHit.kind;
      gunImpact.seq = gunEffects.shotsFired;

      const impact =
        combatEffects.impacts[combatEffects.impactHead++ % combatEffects.impacts.length];
      impact.position.copy(tracer.to);
      impact.at = combatEffects.time;
      impact.seed = gunEffects.shotsFired * 31 + combatEffects.impactHead;

      return {
        fired: true,
        hitId: null,
        hitKind: obstacleHit.kind,
        defeated: false,
        message: '',
      };
    }

    tracer.to.set(
      tracer.from.x + fx * 22,
      tracer.from.y,
      tracer.from.z + fz * 22,
    );
    tracer.hit = false;
    return {
      fired: true,
      hitId: null,
      hitKind: null,
      defeated: false,
      message: '',
    };
  }

  // Keep the visual bullet tracer shooting straight ahead along the barrel direction
  const hitDist = Math.max(
    1.2,
    Math.hypot(bestTarget.x - tracer.from.x, bestTarget.z - tracer.from.z),
  );
  tracer.to.set(
    tracer.from.x + fx * hitDist,
    bestTarget.y,
    tracer.from.z + fz * hitDist,
  );
  tracer.hit = true;

  const gunImpact =
    gunEffects.impacts[gunEffects.impactHead++ % gunEffects.impacts.length];
  gunImpact.position.set(bestTarget.x, bestTarget.y, bestTarget.z);
  gunImpact.at = gunEffects.time;
  gunImpact.kind = bestTarget.kind;
  gunImpact.seq = gunEffects.shotsFired;

  const impact =
    combatEffects.impacts[combatEffects.impactHead++ % combatEffects.impacts.length];
  impact.position.set(bestTarget.x, bestTarget.y, bestTarget.z);
  impact.at = combatEffects.time;
  impact.seed = gunEffects.shotsFired * 31 + combatEffects.impactHead;

  if (bestTarget.kind === 'zombie') {
    const res = damageZombie(bestTarget.id, 1, 'gun');
    const message = res?.message ?? '';
    if (message) playerCombat.message = message;
    return {
      fired: true,
      hitId: bestTarget.id,
      hitKind: 'zombie',
      defeated: Boolean(res?.defeated),
      message,
    };
  }

  // Ghost target hit
  let nearby = 0;
  for (const gid of GHOST_IDS) {
    const g = getGhostRuntime(gid);
    if (
      g?.active &&
      !isGhostDefeated(gid) &&
      Math.hypot(g.x - px, g.z - pz) <= GROUP_SHIELD_RADIUS_M
    ) {
      nearby++;
    }
  }
  if (nearby >= 2) {
    const msg = 'Ghost နှစ်ကောင်နီးနေသဖြင့် damage ပိတ်ထားသည်။';
    playerCombat.message = msg;
    return {
      fired: true,
      hitId: bestTarget.id,
      hitKind: 'ghost',
      defeated: false,
      message: msg,
    };
  }

  damageMissionGhost(bestTarget.id, GUN_DAMAGE);
  const dead = isGhostDefeated(bestTarget.id);
  requestGhostReaction(bestTarget.id, dead ? 'Ghost_Death' : 'Ghost_Hit');
  clearGhostEncounterInteraction(bestTarget.id);
  const hpLeft =
    getThreeGhostsProgress().hp[
      bestTarget.id as keyof ReturnType<typeof getThreeGhostsProgress>['hp']
    ];
  const msg = `🔫 ${bestTarget.id}: ${hpLeft} HP`;
  playerCombat.message = msg;
  return {
    fired: true,
    hitId: bestTarget.id,
    hitKind: 'ghost',
    defeated: dead,
    message: msg,
  };
}
