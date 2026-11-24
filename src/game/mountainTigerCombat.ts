/**
 * ============================================================================
 * Open-World Mountain Tiger Combat State, Progression & Carrot Reward Registry
 * (`တောင်ပေါ်ကျား Open-World တိုက်ခိုက်မှု နှင့် ယုန်ကျွေးရန် မုန်လာဥနီ/ခါကျက်ဥနီ ဆု`)
 * ============================================================================
 * - Open-World combat as soon as the player enters mountain tiger territory
 *   (no Mission Hub gate required).
 * - Unarmed players (e.g. players who have not completed Mission 1/2 yet and
 *   hold no weapon) suffer a fatal tiger pounce if caught inside tiger territory.
 * - Armed players (Sword or Gun) can fight back, block (`ကာ`) / parry, take
 *   -1 Heart + `universfield-punch-03-352040` + 4m airborne knockback + drone view.
 * - Defeating ALL mountain tigers unlocks Carrots (`မုန်လာဥနီ / ခါကျက်ဥနီ`) and
 *   triggers the 5-second Auto-Bot Rabbit Carrot-Feeding Cinematic!
 */

import { useSyncExternalStore } from 'react';
import { WILDLIFE_TIGER_AUDIO_FILES, pickCachedSfxBuffer, preloadSfxBuffers } from './audio/sfxBufferCache.ts';
import { playerCombat } from './combat/combatRuntime.ts';
import { triggerPlayerKnockback } from './combat/playerKnockback.ts';
import { playGhostHitPlayerSound } from './combat/swordAudio.ts';
import { gameAudio } from './gameAudio.ts';
import { getActiveMissionWeapon } from './missions/threeGhostsMission.ts';
import { isPlayerGuardingWithKnife } from './missions/zombieForestMission.ts';
import { getPlayerDeathState, killPlayerFromGhost } from './playerDeath.ts';
import { isPlayerHomeProtected } from './playerHomeProtection.ts';
import { triggerRabbitCarrotCinematic } from './rabbitCarrotCinematic.ts';
import { rideLife } from './rideLife.ts';
import { playSpecialAction } from './specialActions.ts';

export const TIGER_WARN_RADIUS_M = 24;
export const TIGER_AGGRO_RADIUS_M = 16;
export const TIGER_GIVEUP_RADIUS_M = 34;
export const TIGER_POUNCE_RANGE_M = 3.6;
export const TIGER_HIT_RANGE_M = 2.65;
export const TIGER_TELEGRAPH_SEC = 0.52;
export const TIGER_POUNCE_SEC = 0.36;
export const TIGER_ATTACK_DELAY_MIN_SEC = 1.0;
export const TIGER_ATTACK_DELAY_MAX_SEC = 2.4;
export const TIGER_SOLO_MAX_HP = 60;
export const TIGER_PAIR_MAX_HP = 50;
export const TIGER_COLLAPSE_HIDE_SEC = 2.4;

const STORAGE_CARROTS_KEY = 'mm-mountain-tiger-carrots-v1';

export interface ActiveCombatTigerInfo {
  readonly id: string;
  readonly territoryId: string;
  readonly groupKind: 'pair' | 'solo';
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  aggroTimer: number;
  staggerTimer: number;
  hitFlashTimer: number;
  defeatedTimer: number;
}

export interface TigerMapTerritoryMarker {
  readonly territoryId: string;
  readonly x: number;
  readonly z: number;
  readonly aliveCount: number;
  readonly isNearest: boolean;
  readonly distanceM: number;
}

export interface NearestLiveTigerMarker {
  readonly id: string;
  readonly territoryId: string;
  readonly x: number;
  readonly z: number;
  readonly distanceM: number;
}

export interface MountainTigerMapSnapshot {
  readonly territories: readonly TigerMapTerritoryMarker[];
  readonly nearest: NearestLiveTigerMarker | null;
  readonly nearestTigers: readonly NearestLiveTigerMarker[];
  readonly remainingCount: number;
  readonly totalCount: number;
}

export interface MountainTigerCombatSnapshot {
  readonly totalCount: number;
  readonly defeatedCount: number;
  readonly remainingCount: number;
  readonly allDefeated: boolean;
  readonly carrotsUnlocked: boolean;
  readonly lastMessage: string;
}

export interface TigerDamageResult {
  readonly id: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly defeated: boolean;
  readonly allDefeated: boolean;
  readonly message: string;
}

export interface TigerPlayerAttackResult {
  readonly applied: boolean;
  readonly blocked: boolean;
  readonly fatalUnarmed: boolean;
  readonly playerDied: boolean;
  readonly livesRemaining: number;
  readonly message: string;
}

function loadSavedCarrotUnlock(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_CARROTS_KEY) || 'null') as {
      carrotsUnlocked?: boolean;
    } | null;
    return Boolean(raw?.carrotsUnlocked);
  } catch {
    return false;
  }
}

function persistCarrotUnlock(unlocked: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CARROTS_KEY, JSON.stringify({ carrotsUnlocked: unlocked }));
  } catch {
    // ignore quota/private storage errors
  }
}

const tigersById = new Map<string, ActiveCombatTigerInfo>();
const activeSlotIds = new Set<string>();
const listeners = new Set<() => void>();
let carrotsUnlocked = loadSavedCarrotUnlock();
let lastMessage = '';
let tigerKillSeq = 500000;
let lastRoarAtMs = 0;

let snapshot: MountainTigerCombatSnapshot = Object.freeze({
  totalCount: 0,
  defeatedCount: 0,
  remainingCount: 0,
  allDefeated: false,
  carrotsUnlocked,
  lastMessage: '',
});

function rebuildSnapshot(): void {
  let totalCount = 0;
  let defeatedCount = 0;
  for (const t of tigersById.values()) {
    totalCount++;
    if (!t.alive) defeatedCount++;
  }
  const remainingCount = Math.max(0, totalCount - defeatedCount);
  const allDefeated = totalCount > 0 && remainingCount === 0;
  snapshot = Object.freeze({
    totalCount,
    defeatedCount,
    remainingCount,
    allDefeated,
    carrotsUnlocked,
    lastMessage,
  });
  for (const fn of listeners) fn();
}

export function getMountainTigerCombatSnapshot(): MountainTigerCombatSnapshot {
  return snapshot;
}

export function subscribeMountainTigerCombat(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMountainTigerCombat(): MountainTigerCombatSnapshot {
  return useSyncExternalStore(
    subscribeMountainTigerCombat,
    getMountainTigerCombatSnapshot,
    getMountainTigerCombatSnapshot,
  );
}

/** Registers the deterministic spawn list from `MountainTigerFixedPool`. Preserves already-defeated state across pool remounts. */
export function registerMountainTigerSpawns(
  spawns: readonly {
    readonly id: string;
    readonly territoryId?: string;
    readonly groupKind: 'pair' | 'solo';
    readonly homeX: number;
    readonly homeY: number;
    readonly homeZ: number;
    readonly scale: number;
  }[],
): void {
  const validIds = new Set<string>();
  for (const sp of spawns) {
    validIds.add(sp.id);
    if (!tigersById.has(sp.id)) {
      const maxHp = sp.groupKind === 'solo' ? TIGER_SOLO_MAX_HP : TIGER_PAIR_MAX_HP;
      tigersById.set(sp.id, {
        id: sp.id,
        territoryId: sp.territoryId ?? sp.id,
        groupKind: sp.groupKind,
        x: sp.homeX,
        y: sp.homeY,
        z: sp.homeZ,
        yaw: 0,
        scale: sp.scale,
        hp: maxHp,
        maxHp,
        alive: true,
        aggroTimer: 0,
        staggerTimer: 0,
        hitFlashTimer: 0,
        defeatedTimer: 0,
      });
    }
  }
  for (const id of [...tigersById.keys()]) {
    if (!validIds.has(id)) {
      tigersById.delete(id);
      activeSlotIds.delete(id);
    }
  }
  rebuildSnapshot();
}

export function resetMountainTigerCombat(resetCarrotReward = false): void {
  for (const t of tigersById.values()) {
    t.hp = t.maxHp;
    t.alive = true;
    t.aggroTimer = 0;
    t.staggerTimer = 0;
    t.hitFlashTimer = 0;
    t.defeatedTimer = 0;
  }
  if (resetCarrotReward) {
    carrotsUnlocked = false;
    persistCarrotUnlock(false);
  }
  lastMessage = '';
  rebuildSnapshot();
}

export function clearMountainTigerCombatRegistry(): void {
  tigersById.clear();
  activeSlotIds.clear();
  lastMessage = '';
  rebuildSnapshot();
}

export function getCombatTiger(id: string): ActiveCombatTigerInfo | undefined {
  return tigersById.get(id);
}

export function isMountainTigerAlive(id: string): boolean {
  return Boolean(tigersById.get(id)?.alive);
}

export function markCombatTigerSlotActive(
  id: string,
  x: number,
  y: number,
  z: number,
  yaw: number,
): void {
  const t = tigersById.get(id);
  if (!t) return;
  t.x = x;
  t.y = y;
  t.z = z;
  t.yaw = yaw;
  activeSlotIds.add(id);
}

export function markCombatTigerSlotInactive(id: string): void {
  activeSlotIds.delete(id);
}

/**
 * Computes realtime mountain tiger territory markers + the single nearest living tiger
 * relative to `(playerX, playerZ)` for rendering on the 2D Map SVG.
 */
export function getMountainTigerMapSnapshot(
  playerX: number,
  playerZ: number,
): MountainTigerMapSnapshot {
  let totalCount = 0;
  let remainingCount = 0;
  let nearest: NearestLiveTigerMarker | null = null;
  let nearestDistSq = Infinity;
  const allLiving: NearestLiveTigerMarker[] = [];

  const grouped = new Map<string, { sumX: number; sumZ: number; count: number; minDistSq: number }>();

  for (const t of tigersById.values()) {
    totalCount++;
    if (!t.alive) continue;
    remainingCount++;

    const dx = t.x - playerX;
    const dz = t.z - playerZ;
    const dSq = dx * dx + dz * dz;
    const entry: NearestLiveTigerMarker = {
      id: t.id,
      territoryId: t.territoryId,
      x: t.x,
      z: t.z,
      distanceM: Math.sqrt(dSq),
    };
    allLiving.push(entry);
    if (dSq < nearestDistSq) {
      nearestDistSq = dSq;
      nearest = entry;
    }

    const g = grouped.get(t.territoryId);
    if (g) {
      g.sumX += t.x;
      g.sumZ += t.z;
      g.count += 1;
      if (dSq < g.minDistSq) g.minDistSq = dSq;
    } else {
      grouped.set(t.territoryId, { sumX: t.x, sumZ: t.z, count: 1, minDistSq: dSq });
    }
  }

  allLiving.sort((a, b) => a.distanceM - b.distanceM);
  const nearestTigers = allLiving.slice(0, 5);

  const nearestTerritoryId = nearest?.territoryId ?? null;
  const territories: TigerMapTerritoryMarker[] = [];
  for (const [territoryId, g] of grouped.entries()) {
    territories.push({
      territoryId,
      x: g.sumX / g.count,
      z: g.sumZ / g.count,
      aliveCount: g.count,
      isNearest: territoryId === nearestTerritoryId,
      distanceM: Math.sqrt(g.minDistSq),
    });
  }

  return { territories, nearest, nearestTigers, remainingCount, totalCount };
}

/** Iterates currently pooled live tigers for O(16) sword & gun combat hit detection. */
export function getActiveCombatTigers(): ActiveCombatTigerInfo[] {
  const out: ActiveCombatTigerInfo[] = [];
  for (const id of activeSlotIds) {
    const t = tigersById.get(id);
    if (t && t.alive) out.push(t);
  }
  return out;
}

export function isPlayerArmedForTigers(): boolean {
  const weapon = getActiveMissionWeapon();
  return weapon === 'ghost-sword' || weapon === 'zombie-gun';
}

export function playTigerCombatRoar(volume = 0.78): void {
  if (typeof window === 'undefined') return;
  if (!gameAudio.isActive()) return;
  const nowMs = Date.now();
  if (nowMs - lastRoarAtMs < 1400) return;
  lastRoarAtMs = nowMs;

  const ctx = gameAudio.context;
  const out = gameAudio.master;
  if (!ctx || !out || ctx.state !== 'running') {
    preloadSfxBuffers(ctx, WILDLIFE_TIGER_AUDIO_FILES);
    return;
  }
  const buf = pickCachedSfxBuffer(ctx, WILDLIFE_TIGER_AUDIO_FILES);
  if (!buf) {
    preloadSfxBuffers(ctx, WILDLIFE_TIGER_AUDIO_FILES);
    return;
  }
  try {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + Math.random() * 0.14;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    // Keep combat roar punchy (<= 2.2s)
    const clipSec = Math.min(buf.duration, 2.2);
    gain.gain.setValueAtTime(volume, now + Math.max(0.2, clipSec - 0.35));
    gain.gain.linearRampToValueAtTime(0.001, now + clipSec);
    src.connect(gain).connect(out);
    src.onended = () => {
      try {
        src.disconnect();
        gain.disconnect();
      } catch {}
    };
    src.start(now, 0, clipSec);
  } catch {
    // ignore audio errors
  }
}

/**
 * Applies Sword or Gun damage to a live Mountain Tiger.
 * When the final tiger falls, unlocks Carrots (`မုန်လာဥနီ / ခါကျက်ဥနီ`) and
 * launches the 5-second Auto-Bot Rabbit Carrot-Feeding Cinematic!
 */
export function damageMountainTiger(
  id: string,
  amount: number,
  source: 'sword' | 'gun',
  attackerX?: number,
  attackerZ?: number,
  attackerY?: number,
  attackerYaw?: number,
): TigerDamageResult | null {
  const t = tigersById.get(id);
  if (!t || !t.alive || amount <= 0) return null;

  t.hp = Math.max(0, t.hp - amount);
  t.hitFlashTimer = 0.3;
  t.aggroTimer = 18;
  t.staggerTimer = Math.max(t.staggerTimer, source === 'sword' ? 0.55 : 0.32);

  const defeated = t.hp <= 0;
  if (defeated) {
    t.alive = false;
    t.defeatedTimer = 0;
    t.staggerTimer = 0;
  } else {
    playTigerCombatRoar(0.72);
  }

  let totalCount = 0;
  let defeatedCount = 0;
  for (const item of tigersById.values()) {
    totalCount++;
    if (!item.alive) defeatedCount++;
  }
  const allDefeated = totalCount > 0 && defeatedCount >= totalCount;

  let msg: string;
  if (allDefeated) {
    carrotsUnlocked = true;
    persistCarrotUnlock(true);
    msg = '🥕 တောင်ပေါ်ကျားအားလုံး နှိမ်နင်းပြီး! ယုန်လေးတွေကျွေးဖို့ မုန်လာဥနီ (ခါကျက်ဥနီ) ရရှိပါပြီ!';
    const cx = typeof attackerX === 'number' ? attackerX : t.x;
    const cy = typeof attackerY === 'number' ? attackerY : t.y;
    const cz = typeof attackerZ === 'number' ? attackerZ : t.z;
    const yaw = typeof attackerYaw === 'number' ? attackerYaw : 0;
    triggerRabbitCarrotCinematic({
      playerX: cx,
      playerGroundY: cy,
      playerZ: cz,
      bodyYaw: yaw,
    });
  } else if (defeated) {
    msg = `🐯 တောင်ပေါ်ကျား နှိမ်နင်းပြီး! (${defeatedCount}/${totalCount})`;
  } else {
    msg = `${source === 'gun' ? '🔫' : '⚔️'} တောင်ပေါ်ကျား HP: ${t.hp}/${t.maxHp}`;
  }

  lastMessage = msg;
  playerCombat.message = msg;
  rebuildSnapshot();

  return {
    id,
    hp: t.hp,
    maxHp: t.maxHp,
    defeated,
    allDefeated,
    message: msg,
  };
}

/**
 * Resolves a Mountain Tiger pounce impact against the player:
 * - Unarmed players (no sword/gun equipped — e.g. Mission 1/2 not yet finished)
 *   die immediately upon being mauled in tiger territory.
 * - Armed players blocking with sword (`ကာ`) negate damage and stagger the tiger.
 * - Armed unblocked players take -1 Heart + `universfield-punch-03-352040` + 4m airborne knockback + drone view.
 */
export function applyTigerAttackToPlayer(opts: {
  tigerId: string;
  tigerX: number;
  tigerZ: number;
  playerX: number;
  playerZ: number;
  cameraX?: number;
  cameraZ?: number;
}): TigerPlayerAttackResult {
  if (
    getPlayerDeathState().phase !== 'alive' ||
    isPlayerHomeProtected(opts.playerX, opts.playerZ)
  ) {
    return {
      applied: false,
      blocked: false,
      fatalUnarmed: false,
      playerDied: false,
      livesRemaining: rideLife.lives,
      message: '',
    };
  }

  const armed = isPlayerArmedForTigers();

  // Armed player guarding with knife/sword blocks the pounce & staggers the tiger!
  if (armed && isPlayerGuardingWithKnife()) {
    const tiger = tigersById.get(opts.tigerId);
    if (tiger && tiger.alive) {
      tiger.staggerTimer = Math.max(tiger.staggerTimer, 1.8);
    }
    const msg = '🛡 ကျားခုန်အုပ်ချက်ကို ဓားဖြင့် ကာကွယ်လိုက်နိုင်သည်!';
    lastMessage = msg;
    playerCombat.message = msg;
    rebuildSnapshot();
    return {
      applied: false,
      blocked: true,
      fatalUnarmed: false,
      playerDied: false,
      livesRemaining: rideLife.lives,
      message: msg,
    };
  }

  if (armed && rideLife.invulnerable > 0) {
    return {
      applied: false,
      blocked: false,
      fatalUnarmed: false,
      playerDied: false,
      livesRemaining: rideLife.lives,
      message: '',
    };
  }

  playGhostHitPlayerSound();
  playTigerCombatRoar(0.88);

  const kb = triggerPlayerKnockback({
    ghostId: opts.tigerId, // defaults to 4.0m (0.80s, 0.70m airborne lift + 3/4 drone view)
    ghostX: opts.tigerX,
    ghostZ: opts.tigerZ,
    playerX: opts.playerX,
    playerZ: opts.playerZ,
    cameraX: opts.cameraX,
    cameraZ: opts.cameraZ,
  });

  rideLife.mode = 'walking';
  rideLife.damage = 1;
  rideLife.crashTime = 0;

  // Unarmed (Mission 1/2 not done / no weapon): tiger maul inside tiger territory is fatal!
  if (!armed) {
    rideLife.lives = 0;
    rideLife.invulnerable = 0;
    tigerKillSeq++;
    playSpecialAction('flying-back-away', {
      loop: false,
      force: true,
      restart: true,
      speed: kb.playbackSpeed,
    });
    killPlayerFromGhost(opts.tigerId, tigerKillSeq, opts.playerX, opts.playerZ);
    const msg = '🐯 လက်နက်မရှိဘဲ ကျားနယ်မြေဝင်မိ၍ ကျားကိုက်သေဆုံးသွားပါပြီ!';
    lastMessage = msg;
    playerCombat.message = msg;
    rebuildSnapshot();
    return {
      applied: true,
      blocked: false,
      fatalUnarmed: true,
      playerDied: true,
      livesRemaining: 0,
      message: msg,
    };
  }

  rideLife.lives = Math.max(0, Math.round((rideLife.lives - 1) * 10) / 10);
  rideLife.invulnerable = Math.max(1.2, kb.durationSec + 0.55);

  const livesRemaining = rideLife.lives;
  playSpecialAction('flying-back-away', {
    loop: false,
    force: true,
    restart: true,
    speed: kb.playbackSpeed,
  });

  if (livesRemaining <= 0) {
    tigerKillSeq++;
    killPlayerFromGhost(opts.tigerId, tigerKillSeq, opts.playerX, opts.playerZ);
    const msg = '💀 တောင်ပေါ်ကျား ခုန်အုပ်ချက်ကြောင့် Life ၃ ခုလုံး ကုန်သွားပါပြီ!';
    lastMessage = msg;
    playerCombat.message = msg;
    rebuildSnapshot();
    return {
      applied: true,
      blocked: false,
      fatalUnarmed: false,
      playerDied: true,
      livesRemaining: 0,
      message: msg,
    };
  }

  playerCombat.cancel();
  const msg = `🐯 ကျားခုန်အုပ်ခံရ၍ ${kb.distance}m လွင့်သွားသည်! (Life: ${livesRemaining}/3)`;
  lastMessage = msg;
  playerCombat.message = msg;
  rebuildSnapshot();
  return {
    applied: true,
    blocked: false,
    fatalUnarmed: false,
    playerDied: false,
    livesRemaining,
    message: msg,
  };
}
