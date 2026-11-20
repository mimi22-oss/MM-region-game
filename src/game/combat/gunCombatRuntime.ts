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
import { combatEffects, combatLineClear, playerCombat } from './combatRuntime.ts';
import { playSpecialAction } from '../specialActions.ts';

export const GUN_DAMAGE = SWORD_DAMAGE;
export const GUN_RANGE_M = 32;
export const GUN_COOLDOWN_SEC = 0.25;
export const GUN_AIM_CONE_COS = 0.42;
export const GUN_SHOOTING_MOTION_ID = 'shooting';

let heldGun: {
  root: Object3D;
  avatar: Object3D;
  muzzle: Object3D;
} | null = null;

export function registerCombatGun(root: Object3D, avatar: Object3D): () => void {
  const muzzle = root.getObjectByName('gun-muzzle-tip') ?? root;
  const entry = { root, avatar, muzzle };
  heldGun = entry;
  return () => {
    if (heldGun === entry) {
      heldGun = null;
    }
  };
}

export interface GunTracerEffect {
  readonly from: Vector3;
  readonly to: Vector3;
  at: number;
  hit: boolean;
  seq: number;
}

export const gunEffects = {
  time: 0,
  lastShotAt: -100,
  shotsFired: 0,
  tracerHead: 0,
  tracers: Array.from({ length: 12 }, (): GunTracerEffect => ({
    from: new Vector3(),
    to: new Vector3(),
    at: -100,
    hit: false,
    seq: 0,
  })),
};

function playSynthesizedGunshot() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Short percussive noise burst + low punch oscillator
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
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.11);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 220);
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
  readonly hitKind: 'zombie' | 'ghost' | null;
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
  playSynthesizedGunshot();

  // Find best target (Zombies + active Ghosts) inside forward aiming cone
  let bestTarget: {
    id: string;
    kind: 'zombie' | 'ghost';
    x: number;
    y: number;
    z: number;
    score: number;
  } | null = null;

  // 1. Check live Zombies
  const zombieState = getZombieForestProgress();
  for (const z of zombieState.zombies) {
    if (!z.alive || z.hitsRemaining <= 0) continue;
    const dx = z.x - px;
    const dz = z.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > GUN_RANGE_M) continue;
    const cos = dist < 0.25 ? 1 : (dx * fx + dz * fz) / dist;
    if (cos < GUN_AIM_CONE_COS) continue;
    if (!combatLineClear(px, pz, z.x, z.z)) continue;
    // Prefer closest & most centered target
    const score = dist / Math.max(0.25, cos);
    if (!bestTarget || score < bestTarget.score) {
      bestTarget = {
        id: z.id,
        kind: 'zombie',
        x: z.x,
        y: z.clip === 'crawl' ? 0.45 : 1.15,
        z: z.z,
        score,
      };
    }
  }

  // 2. Check active Ghosts
  for (const id of GHOST_IDS) {
    if (isGhostDefeated(id)) continue;
    const g = getGhostRuntime(id);
    if (!g || !g.active) continue;
    const dx = g.x - px;
    const dz = g.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > GUN_RANGE_M) continue;
    const cos = dist < 0.25 ? 1 : (dx * fx + dz * fz) / dist;
    if (cos < GUN_AIM_CONE_COS) continue;
    if (!combatLineClear(px, pz, g.x, g.z)) continue;
    const score = dist / Math.max(0.25, cos);
    if (!bestTarget || score < bestTarget.score) {
      bestTarget = {
        id,
        kind: 'ghost',
        x: g.x,
        y: 1.3,
        z: g.z,
        score,
      };
    }
  }

  const tracer = gunEffects.tracers[gunEffects.tracerHead++ % gunEffects.tracers.length];
  if (heldGun) {
    tracer.from.copy(scratchMuzzle);
  } else {
    tracer.from.set(px + fx * 0.45, py, pz + fz * 0.45);
  }
  tracer.at = gunEffects.time;
  tracer.seq = gunEffects.shotsFired;

  if (!bestTarget) {
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

  const impact =
    combatEffects.impacts[combatEffects.impactHead++ % combatEffects.impacts.length];
  impact.position.copy(tracer.to);
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
