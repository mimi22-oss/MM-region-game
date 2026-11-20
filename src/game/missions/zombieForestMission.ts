import { useSyncExternalStore } from 'react';
import type { AnimationClip, Object3D } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  cloneTransformHierarchyOnly,
  retargetMotionClip,
} from '../../animation/retargeting/SkeletonRetargeter.ts';
import { angle, toWorld } from '../../data/ward.ts';
import { canStand } from '../collision.ts';
import { playerCombat } from '../combat/combatRuntime.ts';
import { getPlayerDeathState, killPlayerFromGhost } from '../playerDeath.ts';
import { isPlayerHomeProtected } from '../playerHomeProtection.ts';
import { rideLife } from '../rideLife.ts';
import { playSpecialAction } from '../specialActions.ts';
import {
  getActiveMissionWeapon,
  setZombieForestSwordActive,
  setZombieGunUnlockedState,
} from './threeGhostsMission.ts';

export const ZOMBIE_FOREST_ZONE_BOUNDS = {
  uMin: -142.5,
  uMax: 142.5,
  vMin: 517,
  vMax: 706.5,
  centerU: 0,
  centerV: 611.75,
  centerX: 439.82,
  centerZ: 439.82,
} as const;

export const ZOMBIE_FOREST_MISSION_ID = 'zombie-forest-v1';
export const ZOMBIE_COUNT = 13;
export const ZOMBIE_IDS = [
  'zombie-1',
  'zombie-2',
  'zombie-3',
  'zombie-4',
  'zombie-5',
  'zombie-6',
  'zombie-7',
  'zombie-8',
  'zombie-9',
  'zombie-10',
  'zombie-11',
  'zombie-12',
  'zombie-13',
] as const;

export type ZombieId = (typeof ZOMBIE_IDS)[number];
export type ZombieAmbientClipId = 'idle' | 'crawl' | 'scream';
export type ZombieClipId = ZombieAmbientClipId | 'attack';
export type ZombieDefeatClipId = 'defeat_02' | 'defeat_03';
export type ForestQuadrantId = 'nw' | 'ne' | 'sw' | 'se';

export const ZOMBIE_AMBIENT_CLIPS: readonly ZombieAmbientClipId[] = ['idle', 'crawl', 'scream'];
export const ZOMBIE_ALL_CLIPS: readonly ZombieClipId[] = ['idle', 'crawl', 'scream', 'attack'];
export const ZOMBIE_DEFEAT_CLIPS: readonly ZombieDefeatClipId[] = ['defeat_02', 'defeat_03'];

export const ZOMBIE_DEFEAT_URLS: Record<ZombieDefeatClipId, string> = {
  defeat_02: '/motions/reactions/defeat_02.glb',
  defeat_03: '/motions/reactions/defeat_03.glb',
};

export const ZOMBIE_TWO_HIT_MIN = 4;
export const ZOMBIE_TWO_HIT_MAX = 8;
export const ZOMBIE_DEFAULT_HITS = 3;
export const ZOMBIE_HIT_DAMAGE = 10;

export const ZOMBIE_ATTACK_RANGE_M = 2.15;
export const ZOMBIE_ALERT_RANGE_M = 16.0;
export const ZOMBIE_CRAWL_SPEED_MPS = 1.25;
export const ZOMBIE_CHASE_SPEED_MPS = 1.75;
export const ZOMBIE_STAND_ATTACK_DELAY_MIN_SEC = 3.0;
export const ZOMBIE_STAND_ATTACK_DELAY_MAX_SEC = 6.0;
export const ZOMBIE_ATTACK_CLIP_DURATION_SEC = 2.667;
export const ZOMBIE_ATTACK_STRIKE_TIME_SEC = 1.05;

export function sampleStandAttackDelay(rng: () => number = Math.random): number {
  return +(
    ZOMBIE_STAND_ATTACK_DELAY_MIN_SEC +
    rng() * (ZOMBIE_STAND_ATTACK_DELAY_MAX_SEC - ZOMBIE_STAND_ATTACK_DELAY_MIN_SEC)
  ).toFixed(3);
}

export const ZOMBIE_MODEL_URL = '/models/enemies/zombie.glb';
export const ZOMBIE_MOTION_URLS: Record<ZombieClipId, string> = {
  attack: '/motions/zombie/attack.glb',
  crawl: '/motions/zombie/crawl.glb',
  idle: '/motions/zombie/idle.glb',
  scream: '/motions/zombie/scream.glb',
};

/**
 * Selects the specific clip from a zombie motion GLB (handling accumulated NLA stacks)
 * and keeps horizontal root motion in-place while preserving vertical ground height.
 */
export function prepareZombieMotionClip(
  gltf: Pick<GLTF, 'animations'>,
  clipId: ZombieClipId,
): AnimationClip {
  const raw = gltf.animations[gltf.animations.length - 1];
  if (!raw) {
    throw new Error(`Missing animation in zombie motion GLB for "${clipId}"`);
  }
  const clip = raw.clone();
  clip.name = clipId;

  // Armature in zombie.glb has +90 deg X rotation, so Hips.position.x and Hips.position.y
  // are horizontal XZ in cm, while Hips.position.z is vertical -Y height in cm.
  const hipsPos = clip.tracks.find(
    t => t.name === 'mixamorigHips.position' || t.name.endsWith('Hips.position'),
  );
  if (hipsPos && hipsPos.values.length >= 3) {
    const x0 = hipsPos.values[0];
    const y0 = hipsPos.values[1];
    for (let i = 0; i < hipsPos.values.length; i += 3) {
      hipsPos.values[i] = hipsPos.values[i] - x0;
      if (clipId === 'crawl') {
        hipsPos.values[i + 1] = 0;
      } else {
        hipsPos.values[i + 1] = hipsPos.values[i + 1] - y0;
      }
    }
  }
  return clip;
}

/**
 * Retargets shared reaction defeat clips (defeat_02.glb / defeat_03.glb) onto the zombie.glb rig.
 */
export function prepareZombieDefeatClip(
  motionGltf: Pick<GLTF, 'scene' | 'animations'>,
  zombieScene: Object3D,
  clipId: ZombieDefeatClipId,
): AnimationClip {
  const raw = motionGltf.animations[0];
  if (!raw) {
    throw new Error(`Missing animation in zombie defeat GLB for "${clipId}"`);
  }
  const sourceScene = cloneTransformHierarchyOnly(motionGltf.scene);
  const retargeted = retargetMotionClip(raw, sourceScene, zombieScene, {
    rootMotion: 'in-place',
  });
  retargeted.name = clipId;
  return retargeted;
}

const STORAGE_KEY = 'mm-region-zombie-forest-mission-v1';

interface QuadrantSpec {
  readonly id: ForestQuadrantId;
  readonly area: 'myothar-area-5' | 'tharsi';
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
  readonly colsU: readonly number[];
  readonly rowsV: readonly number[];
}

const QUADRANT_SPECS: readonly QuadrantSpec[] = [
  {
    id: 'nw',
    area: 'myothar-area-5',
    uMin: -135,
    uMax: -25,
    vMin: 524,
    vMax: 633,
    colsU: [-24, -36.5, -49, -61.5, -74, -86.5, -99, -111.5, -124, -136.5],
    rowsV: [522, 534.5, 547, 559.5, 572, 584.5, 597, 609.5, 622, 634.5],
  },
  {
    id: 'ne',
    area: 'myothar-area-5',
    uMin: 25,
    uMax: 135,
    vMin: 536,
    vMax: 645,
    colsU: [24, 36.5, 49, 61.5, 74, 86.5, 99, 111.5, 124, 136.5],
    rowsV: [534, 546.5, 559, 571.5, 584, 596.5, 609, 621.5, 634, 646.5],
  },
  {
    id: 'sw',
    area: 'tharsi',
    uMin: -135,
    uMax: -25,
    vMin: 668,
    vMax: 700,
    colsU: [-24, -36.5, -49, -61.5, -74, -86.5, -99, -111.5, -124, -136.5],
    rowsV: [667, 678.5, 690, 701.5],
  },
  {
    id: 'se',
    area: 'tharsi',
    uMin: 25,
    uMax: 135,
    vMin: 668,
    vMax: 700,
    colsU: [24, 36.5, 49, 61.5, 74, 86.5, 99, 111.5, 124, 136.5],
    rowsV: [667, 678.5, 690, 701.5],
  },
];

const invC = Math.cos(angle);
const invS = Math.sin(angle);

export function worldToForestUV(x: number, z: number): { u: number; v: number } {
  return {
    u: x * invC - z * invS,
    v: x * invS + z * invC,
  };
}

export function isPointInZombieForest(x: number, z: number, marginM = 14): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const { u, v } = worldToForestUV(x, z);
  const b = ZOMBIE_FOREST_ZONE_BOUNDS;
  return (
    u >= b.uMin - marginM &&
    u <= b.uMax + marginM &&
    v >= b.vMin - marginM &&
    v <= b.vMax + marginM
  );
}

function isNearTreeGrid(q: QuadrantSpec, u: number, v: number, clearanceM = 2.65): boolean {
  for (const colU of q.colsU) {
    if (Math.abs(u - colU) < clearanceM) {
      for (const rowV of q.rowsV) {
        if (Math.abs(v - rowV) < clearanceM) {
          return true;
        }
      }
    }
  }
  return false;
}

export interface ZombieEntityState {
  readonly id: ZombieId;
  readonly index: number;
  readonly quadrant: ForestQuadrantId;
  readonly area: 'myothar-area-5' | 'tharsi';
  x: number;
  z: number;
  u: number;
  v: number;
  spawnX: number;
  spawnZ: number;
  targetU: number;
  targetV: number;
  yaw: number;
  maxHits: 2 | 3;
  hitsRemaining: number;
  maxHp: number;
  hp: number;
  alive: boolean;
  clip: ZombieClipId;
  ambientClip: ZombieAmbientClipId;
  defeatClip: ZombieDefeatClipId;
  stateTimer: number;
  standAttackDelay: number;
  standingNearPlayer: boolean;
  attackCycleTime: number;
  attackStrikeDone: boolean;
  hitStunTimer: number;
  alerted: boolean;
  lastHitAt: number;
  defeatedAt: number;
}

export interface ZombieForestProgress {
  readonly version: 1;
  readonly waveSeed: number;
  readonly twoHitCount: number;
  readonly totalCount: number;
  readonly defeatedCount: number;
  readonly completed: boolean;
  readonly gunUnlocked: boolean;
  readonly inForest: boolean;
  readonly lastMessage: string;
  readonly zombies: readonly ZombieEntityState[];
}

function loadSavedGunUnlock(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as {
      version?: number;
      gunUnlocked?: boolean;
    } | null;
    return Boolean(raw && raw.version === 1 && raw.gunUnlocked);
  } catch {
    return false;
  }
}

function persistGunUnlock(gunUnlocked: boolean) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, gunUnlocked }),
    );
  } catch {
    // storage disabled
  }
}

function pickRandomAmbientClip(
  rng: () => number,
  exclude?: ZombieAmbientClipId,
): ZombieAmbientClipId {
  if (!exclude) {
    const idx = Math.min(
      ZOMBIE_AMBIENT_CLIPS.length - 1,
      Math.floor(rng() * ZOMBIE_AMBIENT_CLIPS.length),
    );
    return ZOMBIE_AMBIENT_CLIPS[idx];
  }
  const pool = ZOMBIE_AMBIENT_CLIPS.filter(c => c !== exclude);
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}

function sampleValidForestPoint(
  q: QuadrantSpec,
  placed: ReadonlyArray<{ x: number; z: number }>,
  rng: () => number,
  minSpacingM = 5.4,
): { u: number; v: number; x: number; z: number } {
  for (let attempt = 0; attempt < 120; attempt++) {
    const u = q.uMin + rng() * (q.uMax - q.uMin);
    const v = q.vMin + rng() * (q.vMax - q.vMin);
    if (Math.abs(u) < 19 || Math.abs(v - 658) < 7.5) continue;
    const clearance = attempt < 70 ? 2.65 : 2.1;
    if (isNearTreeGrid(q, u, v, clearance)) continue;
    const { x, z } = toWorld(u, v);
    if (!canStand(x, z)) continue;
    const spacing = attempt < 60 ? minSpacingM : attempt < 95 ? 3.5 : 2.0;
    let tooClose = false;
    for (const other of placed) {
      if (Math.hypot(x - other.x, z - other.z) < spacing) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      return { u: +u.toFixed(3), v: +v.toFixed(3), x: +x.toFixed(3), z: +z.toFixed(3) };
    }
  }
  // Fallback aisle midpoint between rows/cols guaranteed clear of tree trunks
  const aisleU = (q.colsU[2] + q.colsU[3]) * 0.5 + (rng() - 0.5) * 3.0;
  const aisleV = (q.rowsV[1] + q.rowsV[2]) * 0.5 + (rng() - 0.5) * 3.0;
  const { x: fx, z: fz } = toWorld(aisleU, aisleV);
  return {
    u: +aisleU.toFixed(3),
    v: +aisleV.toFixed(3),
    x: +fx.toFixed(3),
    z: +fz.toFixed(3),
  };
}

/**
 * Generates 13 randomized zombies across the 4 forest quadrants:
 * - Random 4..8 zombies require 2 hits to die (20 HP)
 * - Remaining 5..9 zombies require 3 hits to die (30 HP)
 * - Random initial locations and random ambient animations ('idle' | 'crawl' | 'scream')
 */
export function createRandomZombieWave(rng: () => number = Math.random): {
  waveSeed: number;
  twoHitCount: number;
  zombies: ZombieEntityState[];
} {
  // 1. Randomly choose 4..8 zombies to die in 2 hits; rest die in 3 hits
  const twoHitCount =
    ZOMBIE_TWO_HIT_MIN +
    Math.min(
      ZOMBIE_TWO_HIT_MAX - ZOMBIE_TWO_HIT_MIN,
      Math.floor(rng() * (ZOMBIE_TWO_HIT_MAX - ZOMBIE_TWO_HIT_MIN + 1)),
    );

  const hitIndices = Array.from({ length: ZOMBIE_COUNT }, (_, i) => i);
  for (let i = hitIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = hitIndices[i];
    hitIndices[i] = hitIndices[j];
    hitIndices[j] = tmp;
  }
  const twoHitSet = new Set<number>(hitIndices.slice(0, twoHitCount));

  // 2. Distribute 13 zombies across all 4 forest quadrants (4 in NW, 4 in NE, 3/2 in SW/SE, shuffled)
  const quadrantAssignments: QuadrantSpec[] = [
    QUADRANT_SPECS[0],
    QUADRANT_SPECS[0],
    QUADRANT_SPECS[0],
    QUADRANT_SPECS[0],
    QUADRANT_SPECS[1],
    QUADRANT_SPECS[1],
    QUADRANT_SPECS[1],
    QUADRANT_SPECS[1],
    QUADRANT_SPECS[2],
    QUADRANT_SPECS[2],
    QUADRANT_SPECS[3],
    QUADRANT_SPECS[3],
    rng() < 0.5 ? QUADRANT_SPECS[2] : QUADRANT_SPECS[3],
  ];
  for (let i = quadrantAssignments.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = quadrantAssignments[i];
    quadrantAssignments[i] = quadrantAssignments[j];
    quadrantAssignments[j] = tmp;
  }

  const placed: Array<{ x: number; z: number }> = [];
  const zombies: ZombieEntityState[] = ZOMBIE_IDS.map((id, index) => {
    const q = quadrantAssignments[index];
    const pos = sampleValidForestPoint(q, placed, rng);
    placed.push({ x: pos.x, z: pos.z });
    const target = sampleValidForestPoint(q, [], rng, 0);
    const maxHits: 2 | 3 = twoHitSet.has(index) ? 2 : 3;
    const maxHp = maxHits * ZOMBIE_HIT_DAMAGE;
    // Ensure all 3 ambient clips ('idle', 'crawl', 'scream') appear across the 13 zombies
    const ambientClip: ZombieAmbientClipId =
      index < 3
        ? ZOMBIE_AMBIENT_CLIPS[index]
        : pickRandomAmbientClip(rng);
    const defeatClip: ZombieDefeatClipId =
      index === 0
        ? 'defeat_02'
        : index === 1
          ? 'defeat_03'
          : rng() < 0.5
            ? 'defeat_02'
            : 'defeat_03';

    return {
      id,
      index,
      quadrant: q.id,
      area: q.area,
      x: pos.x,
      z: pos.z,
      u: pos.u,
      v: pos.v,
      spawnX: pos.x,
      spawnZ: pos.z,
      targetU: target.u,
      targetV: target.v,
      yaw: +(rng() * Math.PI * 2 - Math.PI).toFixed(4),
      maxHits,
      hitsRemaining: maxHits,
      maxHp,
      hp: maxHp,
      alive: true,
      clip: ambientClip,
      ambientClip,
      defeatClip,
      stateTimer: +(2.2 + rng() * 3.8).toFixed(3),
      standAttackDelay: sampleStandAttackDelay(rng),
      standingNearPlayer: false,
      attackCycleTime: 0,
      attackStrikeDone: false,
      hitStunTimer: 0,
      alerted: false,
      lastHitAt: -Infinity,
      defeatedAt: -Infinity,
    };
  });

  // Shuffle which indices got the guaranteed first 3 ambient clips so index 0..2 are also random
  for (let i = zombies.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const c = zombies[i].ambientClip;
    zombies[i].ambientClip = zombies[j].ambientClip;
    zombies[i].clip = zombies[i].ambientClip;
    zombies[j].ambientClip = c;
    zombies[j].clip = c;
  }

  const waveSeed = Math.floor(rng() * 0x7fffffff) + 1;
  return { waveSeed, twoHitCount, zombies };
}

function buildInitialState(rng: () => number = Math.random): ZombieForestProgress {
  const gunUnlocked = loadSavedGunUnlock();
  if (gunUnlocked) {
    setZombieGunUnlockedState(true, false);
  }
  const wave = createRandomZombieWave(rng);
  return {
    version: 1,
    waveSeed: wave.waveSeed,
    twoHitCount: wave.twoHitCount,
    totalCount: ZOMBIE_COUNT,
    defeatedCount: 0,
    completed: false,
    gunUnlocked,
    inForest: false,
    lastMessage: '',
    zombies: wave.zombies,
  };
}

let state: ZombieForestProgress = buildInitialState();
const subscribers = new Set<() => void>();

function publish(next: ZombieForestProgress) {
  state = next;
  subscribers.forEach(fn => fn());
}

export function getZombieForestProgress(): ZombieForestProgress {
  return state;
}

export function subscribeZombieForestMission(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function useZombieForestMission(): ZombieForestProgress {
  return useSyncExternalStore(
    subscribeZombieForestMission,
    getZombieForestProgress,
    getZombieForestProgress,
  );
}

export function isZombieTargetId(id: string): id is ZombieId {
  return (ZOMBIE_IDS as readonly string[]).includes(id);
}

export function getZombieById(id: string): ZombieEntityState | undefined {
  return state.zombies.find(z => z.id === id);
}

export function isZombieAlive(id: string): boolean {
  const z = getZombieById(id);
  return Boolean(z && z.alive && z.hitsRemaining > 0);
}

export function isZombieGunUnlocked(): boolean {
  return state.gunUnlocked;
}

export function rerollZombieForestWave(
  rng: () => number = Math.random,
  keepGunUnlocked = true,
): ZombieForestProgress {
  const wave = createRandomZombieWave(rng);
  const gunUnlocked = keepGunUnlocked ? state.gunUnlocked : false;
  if (!keepGunUnlocked) {
    persistGunUnlock(false);
    setZombieGunUnlockedState(false, false);
  }
  const next: ZombieForestProgress = {
    version: 1,
    waveSeed: wave.waveSeed,
    twoHitCount: wave.twoHitCount,
    totalCount: ZOMBIE_COUNT,
    defeatedCount: 0,
    completed: false,
    gunUnlocked,
    inForest: state.inForest,
    lastMessage: 'သစ်တောအုပ်ထဲတွင် Zombie ၁၃ ကောင် နေရာအသစ်များဖြင့် ပေါ်လာပါပြီ!',
    zombies: wave.zombies,
  };
  publish(next);
  return next;
}

export interface ZombieDamageResult {
  readonly id: ZombieId;
  readonly defeated: boolean;
  readonly hitsRemaining: number;
  readonly maxHits: 2 | 3;
  readonly defeatedCount: number;
  readonly missionCompletedNow: boolean;
  readonly gunRewardedNow: boolean;
  readonly message: string;
}

export function damageZombie(
  id: string,
  hits = 1,
  source: 'sword' | 'gun' = 'sword',
): ZombieDamageResult | null {
  if (!isZombieTargetId(id) || !Number.isFinite(hits) || hits <= 0) return null;
  const target = state.zombies.find(z => z.id === id);
  if (!target || !target.alive || target.hitsRemaining <= 0) return null;

  const appliedHits = Math.max(1, Math.round(hits));
  target.hitsRemaining = Math.max(0, target.hitsRemaining - appliedHits);
  target.hp = target.hitsRemaining * ZOMBIE_HIT_DAMAGE;
  target.hitStunTimer = 0.45;
  target.lastHitAt = Date.now();
  target.alerted = true;
  // Interrupt any active attack windup when the player slashes/shoots the zombie
  target.attackCycleTime = 0;
  target.attackStrikeDone = false;
  if (target.clip === 'attack') {
    target.clip = 'idle';
  }
  target.standAttackDelay = Math.max(target.standAttackDelay, 1.8);

  const defeated = target.hitsRemaining === 0;
  if (defeated) {
    target.alive = false;
    target.defeatedAt = Date.now();
  }

  const defeatedCount = state.zombies.filter(z => !z.alive).length;
  const missionCompletedNow = !state.completed && defeatedCount === ZOMBIE_COUNT;
  const gunRewardedNow = missionCompletedNow;
  const gunUnlocked = state.gunUnlocked || missionCompletedNow;

  const weaponIcon = source === 'gun' ? '🔫' : '⚔️';
  const labelNum = target.index + 1;
  const message = missionCompletedNow
    ? '🏆 Zombie ၁၃ ကောင်လုံး နှိမ်နင်းအောင်မြင်ပါပြီ! ဆုလာဘ် သေနတ် (Gun) ရရှိပြီး လက်ထဲတပ်ဆင်ပြီးပါပြီ (F နှိပ်၍ ပစ်ခတ်ပါ)!'
    : defeated
      ? `${weaponIcon} Zombie #${labelNum} သေဆုံး! (${defeatedCount}/${ZOMBIE_COUNT} နှိမ်နင်းပြီး)`
      : `${weaponIcon} Zombie #${labelNum} ထိမှန်! (${target.hitsRemaining}/${target.maxHits} ချက် ကျန်)`;

  if (missionCompletedNow) {
    persistGunUnlock(true);
    setZombieGunUnlockedState(true, true);
  }

  publish({
    ...state,
    defeatedCount,
    completed: state.completed || missionCompletedNow,
    gunUnlocked,
    lastMessage: message,
    zombies: [...state.zombies],
  });

  return {
    id,
    defeated,
    hitsRemaining: target.hitsRemaining,
    maxHits: target.maxHits,
    defeatedCount,
    missionCompletedNow,
    gunRewardedNow,
    message,
  };
}

export interface ZombieAiStepResult {
  readonly inForest: boolean;
  readonly activeAttacks: ZombieId[];
  readonly strikeZombieId: ZombieId | null;
}

/**
 * Advances all 13 zombies' AI state machine:
 * - Close range (<= ZOMBIE_ATTACK_RANGE_M): plays 'attack' (attack.glb) and strikes player
 * - Medium range (<= ZOMBIE_ALERT_RANGE_M): screams once ('scream') then crawls ('crawl') toward player
 * - Ambient (> ZOMBIE_ALERT_RANGE_M): randomly cycles 'idle', 'crawl', and 'scream'
 */
export function stepZombieForestAi(
  dt: number,
  playerX: number,
  playerZ: number,
  playerOnFoot = true,
  playerAlive = true,
  playerProtected = false,
  rng: () => number = Math.random,
): ZombieAiStepResult {
  const clampedDt = Math.max(0, Math.min(dt, 0.25));
  if (knifeGuardTimerSec > 0) {
    knifeGuardTimerSec = Math.max(0, knifeGuardTimerSec - clampedDt);
  }
  if (
    playerCombat.phase === 'BLOCK' ||
    playerCombat.phase === 'PARRY' ||
    playerCombat.phase === 'DODGE' ||
    playerCombat.defend() !== 'none'
  ) {
    knifeGuardTimerSec = Math.max(knifeGuardTimerSec, 2.0);
  }
  const inForest = isPointInZombieForest(playerX, playerZ, 18);

  if (inForest !== state.inForest) {
    if (inForest && playerOnFoot && !state.gunUnlocked) {
      setZombieForestSwordActive(true);
    } else if (!inForest) {
      setZombieForestSwordActive(false);
    }
    publish({ ...state, inForest });
  }

  const activeAttacks: ZombieId[] = [];
  let strikeZombieId: ZombieId | null = null;
  const canEngagePlayer =
    playerOnFoot &&
    playerAlive &&
    !playerProtected &&
    Number.isFinite(playerX) &&
    Number.isFinite(playerZ);

  for (const z of state.zombies) {
    if (!z.alive) continue;
    if (z.hitStunTimer > 0) {
      z.hitStunTimer = Math.max(0, z.hitStunTimer - clampedDt);
    }

    const q = QUADRANT_SPECS.find(s => s.id === z.quadrant) ?? QUADRANT_SPECS[0];
    const dxToPlayer = canEngagePlayer ? playerX - z.x : Infinity;
    const dzToPlayer = canEngagePlayer ? playerZ - z.z : Infinity;
    const distToPlayer = canEngagePlayer ? Math.hypot(dxToPlayer, dzToPlayer) : Infinity;

    // 1. Close-range melee encounter:
    // When a zombie finishes crawling up and rises near the player, it waits a random 3..6 seconds
    // before launching its attack.glb strike so the player has a fair window to defeat it.
    if (canEngagePlayer && distToPlayer <= ZOMBIE_ATTACK_RANGE_M) {
      if (distToPlayer > 0.01) {
        z.yaw = Math.atan2(dxToPlayer, dzToPlayer);
      }
      if (!z.standingNearPlayer) {
        z.standingNearPlayer = true;
        z.standAttackDelay = sampleStandAttackDelay(rng);
        z.ambientClip = rng() < 0.5 ? 'idle' : 'scream';
        z.clip = z.ambientClip;
        z.attackCycleTime = 0;
        z.attackStrikeDone = false;
      }
      if (z.standAttackDelay > 0) {
        z.standAttackDelay = Math.max(0, z.standAttackDelay - clampedDt);
        if (z.standAttackDelay > 0) {
          z.clip = z.ambientClip === 'crawl' ? 'idle' : z.ambientClip;
          continue;
        }
      }
      activeAttacks.push(z.id);
      if (z.clip !== 'attack') {
        z.clip = 'attack';
        z.attackCycleTime = 0;
        z.attackStrikeDone = false;
      } else {
        z.attackCycleTime += clampedDt;
        if (
          !z.attackStrikeDone &&
          z.attackCycleTime >= ZOMBIE_ATTACK_STRIKE_TIME_SEC
        ) {
          z.attackStrikeDone = true;
          if (!strikeZombieId) strikeZombieId = z.id;
        }
        if (z.attackCycleTime >= ZOMBIE_ATTACK_CLIP_DURATION_SEC) {
          z.attackCycleTime = 0;
          z.attackStrikeDone = false;
          z.standAttackDelay = sampleStandAttackDelay(rng);
          z.ambientClip = 'idle';
          z.clip = 'idle';
        }
      }
      continue;
    }

    if (z.standingNearPlayer) {
      z.standingNearPlayer = false;
      z.standAttackDelay = sampleStandAttackDelay(rng);
    }
    z.attackCycleTime = 0;
    z.attackStrikeDone = false;

    // 2. Alert range -> scream.glb on sight, then crawl.glb toward player
    if (canEngagePlayer && distToPlayer <= ZOMBIE_ALERT_RANGE_M) {
      if (distToPlayer > 0.01) {
        z.yaw = Math.atan2(dxToPlayer, dzToPlayer);
      }
      if (!z.alerted) {
        z.alerted = true;
        z.ambientClip = 'scream';
        z.clip = 'scream';
        z.stateTimer = 1.45;
        continue;
      }
      if (z.clip === 'scream' && z.stateTimer > 0) {
        z.stateTimer -= clampedDt;
        if (z.stateTimer <= 0) {
          z.ambientClip = 'crawl';
          z.clip = 'crawl';
          z.stateTimer = 3.2;
        }
        continue;
      }
      z.ambientClip = 'crawl';
      z.clip = 'crawl';
      if (distToPlayer > ZOMBIE_ATTACK_RANGE_M * 0.85 && z.hitStunTimer <= 0) {
        const step = Math.min(distToPlayer - 1.1, ZOMBIE_CHASE_SPEED_MPS * clampedDt);
        if (step > 0.001) {
          const nx = z.x + (dxToPlayer / distToPlayer) * step;
          const nz = z.z + (dzToPlayer / distToPlayer) * step;
          const nuv = worldToForestUV(nx, nz);
          if (
            Math.abs(nuv.u) >= 16.5 &&
            Math.abs(nuv.v - 658) >= 7.0 &&
            canStand(nx, nz)
          ) {
            z.x = nx;
            z.z = nz;
            z.u = nuv.u;
            z.v = nuv.v;
          }
        }
      }
      continue;
    }

    // 3. Ambient forest behavior -> randomly cycle 'idle', 'crawl', 'scream'
    z.alerted = false;
    z.stateTimer -= clampedDt;
    if (z.stateTimer <= 0 || z.clip === 'attack') {
      const nextClip = pickRandomAmbientClip(rng, z.ambientClip);
      z.ambientClip = nextClip;
      z.clip = nextClip;
      z.stateTimer = +(2.2 + rng() * 3.8).toFixed(3);
      if (nextClip === 'crawl') {
        const nextTarget = sampleValidForestPoint(q, [], rng, 0);
        z.targetU = nextTarget.u;
        z.targetV = nextTarget.v;
      }
    } else {
      z.clip = z.ambientClip;
    }

    if (z.clip === 'crawl' && z.hitStunTimer <= 0) {
      const { x: tx, z: tz } = toWorld(z.targetU, z.targetV);
      const dx = tx - z.x;
      const dz = tz - z.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 1.2) {
        const nextTarget = sampleValidForestPoint(q, [], rng, 0);
        z.targetU = nextTarget.u;
        z.targetV = nextTarget.v;
      } else {
        z.yaw = Math.atan2(dx, dz);
        const step = Math.min(dist, ZOMBIE_CRAWL_SPEED_MPS * clampedDt);
        const nx = z.x + (dx / dist) * step;
        const nz = z.z + (dz / dist) * step;
        const nuv = worldToForestUV(nx, nz);
        if (
          nuv.u >= q.uMin - 4 &&
          nuv.u <= q.uMax + 4 &&
          nuv.v >= q.vMin - 4 &&
          nuv.v <= q.vMax + 4 &&
          Math.abs(nuv.v - 658) >= 7.0 &&
          canStand(nx, nz)
        ) {
          z.x = nx;
          z.z = nz;
          z.u = nuv.u;
          z.v = nuv.v;
        } else {
          const nextTarget = sampleValidForestPoint(q, [], rng, 0);
          z.targetU = nextTarget.u;
          z.targetV = nextTarget.v;
        }
      }
    }
  }

  return { inForest, activeAttacks, strikeZombieId };
}

export const ZOMBIE_PLAYER_MAX_HEARTS = 3;
export const KNIFE_GUARD_WINDOW_SEC = 3.5;
let zombieAttackSeq = 0;
let knifeGuardTimerSec = 0;

/**
 * Activates the knife guard shield ('ကာ' / Sword_Block / Sword_Parry / Dodge) so incoming
 * zombie attacks do not reduce the character's heart lives.
 */
export function activateKnifeGuard(durationSec = KNIFE_GUARD_WINDOW_SEC): void {
  knifeGuardTimerSec = Math.max(knifeGuardTimerSec, Math.max(0, durationSec));
  for (const z of state.zombies) {
    if (!z.alive) continue;
    if (z.standingNearPlayer || z.clip === 'attack') {
      z.attackCycleTime = 0;
      z.attackStrikeDone = false;
      z.standAttackDelay = Math.max(z.standAttackDelay, sampleStandAttackDelay());
      if (z.clip === 'attack') {
        z.clip = 'idle';
      }
    }
  }
}

export function clearKnifeGuard(): void {
  knifeGuardTimerSec = 0;
}

export function isPlayerGuardingWithKnife(): boolean {
  const def = playerCombat.defend();
  if (def === 'block' || def === 'parry' || def === 'dodge') return true;
  if (
    playerCombat.phase === 'BLOCK' ||
    playerCombat.phase === 'PARRY' ||
    playerCombat.phase === 'DODGE'
  ) {
    return true;
  }
  if (
    playerCombat.clip === 'Sword_Block' ||
    playerCombat.clip === 'Sword_Parry' ||
    playerCombat.clip === 'Dodge_Left' ||
    playerCombat.clip === 'Dodge_Right'
  ) {
    return true;
  }
  if (knifeGuardTimerSec > 0 && getActiveMissionWeapon() === 'ghost-sword') {
    return true;
  }
  return false;
}

export interface ZombiePlayerAttackResult {
  readonly applied: boolean;
  readonly blocked: boolean;
  readonly livesRemaining: number;
  readonly playerDied: boolean;
  readonly defeatMotionId: ZombieDefeatClipId | null;
  readonly message: string;
}

/**
 * Each zombie melee attack deducts 1 Heart from the player's 3 Heart Lives (`rideLife.lives`).
 * If the player is guarding ('ကာ' with the knife), 0 hearts are deducted.
 * When all 3 hearts are depleted (`livesRemaining === 0`), plays defeat_02/defeat_03 and triggers
 * Game Over / Respawn from the beginning just like a Ghost kill.
 */
export function applyZombieAttackToPlayer(
  zombieId: string,
  playerX: number,
  playerZ: number,
  rng: () => number = Math.random,
): ZombiePlayerAttackResult {
  if (
    getPlayerDeathState().phase !== 'alive' ||
    isPlayerHomeProtected(playerX, playerZ)
  ) {
    return {
      applied: false,
      blocked: false,
      livesRemaining: rideLife.lives,
      playerDied: false,
      defeatMotionId: null,
      message: '',
    };
  }

  if (isPlayerGuardingWithKnife()) {
    const attacker = state.zombies.find(z => z.id === zombieId);
    if (attacker) {
      attacker.attackCycleTime = 0;
      attacker.attackStrikeDone = false;
      attacker.standAttackDelay = sampleStandAttackDelay(rng);
      attacker.clip = 'idle';
    }
    const msg = '🛡 ဓားဖြင့် ကာကွယ်လိုက်သဖြင့် Heart Life မလျော့ပါ!';
    publish({ ...state, lastMessage: msg });
    return {
      applied: false,
      blocked: true,
      livesRemaining: rideLife.lives,
      playerDied: false,
      defeatMotionId: null,
      message: msg,
    };
  }

  rideLife.mode = 'walking';
  rideLife.damage = 1;
  rideLife.lives = Math.max(0, Math.round((rideLife.lives - 1) * 10) / 10);
  // Brief blink feedback without freezing movement or sword attacks
  rideLife.invulnerable = 0.55;
  rideLife.crashTime = 0;

  const livesRemaining = rideLife.lives;
  if (livesRemaining <= 0) {
    zombieAttackSeq++;
    const defeatMotionId: ZombieDefeatClipId =
      zombieAttackSeq % 2 === 1 ? 'defeat_03' : 'defeat_02';
    playSpecialAction(defeatMotionId, { loop: false, force: true });
    killPlayerFromGhost(zombieId, zombieAttackSeq, playerX, playerZ);
    if (!state.completed) {
      rerollZombieForestWave(rng, state.gunUnlocked);
    }
    const msg =
      '💀 Zombie တိုက်ခိုက်ခံရသဖြင့် Heart Life ၃ ခုလုံး ကုန်သွားပါပြီ! မူလနေရာမှ ပြန်လည်စတင်ပါမည်။';
    publish({ ...state, lastMessage: msg });
    return {
      applied: true,
      blocked: false,
      livesRemaining: 0,
      playerDied: true,
      defeatMotionId,
      message: msg,
    };
  }

  const msg = `💔 ${zombieId} တိုက်ခိုက်ခံရသည်! Heart ၁ ခု လျော့သွားပါပြီ (ကျန်ရှိ: ${livesRemaining}/${ZOMBIE_PLAYER_MAX_HEARTS})`;
  publish({ ...state, lastMessage: msg });
  return {
    applied: true,
    blocked: false,
    livesRemaining,
    playerDied: false,
    defeatMotionId: null,
    message: msg,
  };
}
