import { useSyncExternalStore } from 'react';
import { playKnifeDrawSound, preloadSwordAudio } from '../combat/swordAudio.ts';

/** Single-player mission progress. No mission-specific logic is embedded in vehicles. */
export const THREE_GHOSTS_MISSION_ID = 'three-ghosts-v1';
export const GHOST_IDS = ['ghost-1', 'ghost-2', 'ghost-3'] as const;
export type GhostId = typeof GHOST_IDS[number];
export const GHOST_STATS: Record<GhostId, { scale: number; maxHp: number; attackDamage: number }> = {
  'ghost-1': { scale: 2, maxHp: 100, attackDamage: 10 },
  'ghost-2': { scale: 3, maxHp: 150, attackDamage: 15 },
  'ghost-3': { scale: 4, maxHp: 200, attackDamage: 20 },
};
export const SWORD_DAMAGE = 10;
export const ENCOUNTER_RADIUS_M = 8;
export const SWORD_PICKUP_RADIUS_M = 3.2;
export const GROUP_SHIELD_RADIUS_M = 12;
const STORAGE_KEY = 'mm-region-three-ghosts-mission-v1';
export type MissionWeaponId = 'ghost-sword' | 'zombie-gun' | null;
export interface ThreeGhostsProgress {
  version: 1;
  encountered: GhostId[];
  swordCollected: boolean;
  equippedWeapon: MissionWeaponId;
  hp: Record<GhostId, number>;
  completed: boolean;
}
const initial = (): ThreeGhostsProgress => ({ version: 1, encountered: [], swordCollected: false, equippedWeapon:null,
  hp: { 'ghost-1': 100, 'ghost-2': 150, 'ghost-3': 200 }, completed: false });
function load(): ThreeGhostsProgress {
  if (typeof localStorage === 'undefined') return initial();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<ThreeGhostsProgress> | null;
    if (!raw || raw.version !== 1) return initial();
    const hp = { ...initial().hp };
    for (const id of GHOST_IDS) {
      const n = raw.hp?.[id];
      if (typeof n === 'number' && Number.isFinite(n)) hp[id] = Math.max(0, Math.min(GHOST_STATS[id].maxHp, n));
    }
    const encountered = GHOST_IDS.filter(id => raw.encountered?.includes(id));
    const swordCollected = Boolean(raw.swordCollected) && encountered.length === 3;
    const completed = swordCollected && GHOST_IDS.every(id => hp[id] === 0);
    // Legacy completed saves enter the inventory with empty hands. An unfinished quest
    // keeps its already-collected sword equipped so the player can finish the encounter.
    const equippedWeapon: MissionWeaponId =
      completed && raw.equippedWeapon === 'zombie-gun'
        ? 'zombie-gun'
        : swordCollected && (!completed || raw.equippedWeapon === 'ghost-sword')
          ? 'ghost-sword'
          : null;
    return { version: 1, encountered, swordCollected, equippedWeapon, hp, completed };
  } catch { return initial(); }
}
let progress: ThreeGhostsProgress = load();
let zombieGunUnlocked = progress.completed && progress.equippedWeapon === 'zombie-gun';
let zombieForestSwordActive = false;
let swordQuickHolstered = false;
let quickToggleWeapon: 'ghost-sword' | 'zombie-gun' | null =
  progress.equippedWeapon ?? (progress.swordCollected ? 'ghost-sword' : null);
let prevActiveMissionWeapon: MissionWeaponId =
  progress.equippedWeapon === 'ghost-sword' && progress.swordCollected ? 'ghost-sword' : null;
const subscribers = new Set<() => void>();
function syncWeaponTransitionAudio() {
  const next = getActiveMissionWeapon();
  if (prevActiveMissionWeapon === null && next === 'ghost-sword') {
    playKnifeDrawSound();
  }
  if (progress.swordCollected) {
    preloadSwordAudio();
  }
  prevActiveMissionWeapon = next;
}
function publish(next: ThreeGhostsProgress) {
  progress = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* storage disabled */ }
  syncWeaponTransitionAudio();
  subscribers.forEach(fn => fn());
}
export function getThreeGhostsProgress() { return progress; }
export function subscribeThreeGhostsMission(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; }
export function useThreeGhostsMission() { return useSyncExternalStore(subscribeThreeGhostsMission, getThreeGhostsProgress, getThreeGhostsProgress); }
export function hasCompletedThreeGhostsMission() { return progress.completed; }
export function resetThreeGhostsMission() {
  zombieGunUnlocked = false;
  zombieForestSwordActive = false;
  swordQuickHolstered = false;
  quickToggleWeapon = null;
  prevActiveMissionWeapon = null;
  publish(initial());
}
export function setZombieGunUnlockedState(unlocked: boolean, autoEquip = false) {
  const allowed = Boolean(unlocked && progress.completed && progress.swordCollected);
  zombieGunUnlocked = allowed;
  if (!allowed && progress.equippedWeapon === 'zombie-gun') {
    if (quickToggleWeapon === 'zombie-gun') quickToggleWeapon = progress.swordCollected ? 'ghost-sword' : null;
    publish({ ...progress, equippedWeapon: null });
    return;
  }
  if (allowed && autoEquip) {
    zombieForestSwordActive = false;
    swordQuickHolstered = false;
    quickToggleWeapon = 'zombie-gun';
    if (progress.equippedWeapon !== 'zombie-gun') {
      publish({ ...progress, equippedWeapon: 'zombie-gun' });
      return;
    }
  }
  subscribers.forEach(fn => fn());
}
export function isZombieGunUnlockedState() { return Boolean(zombieGunUnlocked && progress.completed && progress.swordCollected); }
export function setZombieForestSwordActive(active: boolean) {
  const allowed = Boolean(active && progress.completed && progress.swordCollected);
  if (allowed) {
    swordQuickHolstered = false;
    quickToggleWeapon = 'ghost-sword';
  }
  if (zombieForestSwordActive !== allowed) {
    zombieForestSwordActive = allowed;
    syncWeaponTransitionAudio();
    subscribers.forEach(fn => fn());
  }
}
export function isZombieForestSwordActive() { return Boolean(zombieForestSwordActive && progress.completed && progress.swordCollected); }
export function getActiveMissionWeapon(): MissionWeaponId {
  if (progress.equippedWeapon === 'zombie-gun') {
    return progress.completed && progress.swordCollected && zombieGunUnlocked ? 'zombie-gun' : null;
  }
  if (progress.equippedWeapon === 'ghost-sword') {
    if (swordQuickHolstered) return null;
    return progress.swordCollected ? 'ghost-sword' : null;
  }
  if (zombieForestSwordActive && progress.completed && progress.swordCollected) {
    return 'ghost-sword';
  }
  return null;
}
export function getQuickToggleWeapon(): 'ghost-sword' | 'zombie-gun' | null {
  const active = getActiveMissionWeapon();
  if (active) return active;
  if (quickToggleWeapon === 'zombie-gun' && isZombieGunUnlockedState()) return 'zombie-gun';
  if (quickToggleWeapon === 'ghost-sword' && progress.swordCollected) return 'ghost-sword';
  if (isZombieGunUnlockedState()) return 'zombie-gun';
  if (progress.swordCollected) return 'ghost-sword';
  return null;
}
export function toggleQuickWeapon(target?: 'ghost-sword' | 'zombie-gun'): MissionWeaponId {
  const slot = target ?? getQuickToggleWeapon();
  if (!slot) return null;
  const active = getActiveMissionWeapon();
  if (slot === 'zombie-gun') {
    if (!isZombieGunUnlockedState()) return active;
    quickToggleWeapon = 'zombie-gun';
    if (active === 'zombie-gun') {
      selectMissionWeapon(null);
      return null;
    }
    selectMissionWeapon('zombie-gun');
    return getActiveMissionWeapon();
  }
  if (!progress.swordCollected) return active;
  quickToggleWeapon = 'ghost-sword';
  if (active === 'ghost-sword') {
    if (progress.completed) {
      selectMissionWeapon(null);
    } else {
      swordQuickHolstered = true;
      syncWeaponTransitionAudio();
      subscribers.forEach(fn => fn());
    }
    return null;
  }
  swordQuickHolstered = false;
  if (progress.completed) {
    selectMissionWeapon('ghost-sword');
  } else {
    syncWeaponTransitionAudio();
    subscribers.forEach(fn => fn());
  }
  return getActiveMissionWeapon();
}
export function selectMissionWeapon(weapon: ThreeGhostsProgress['equippedWeapon']) {
  if (!progress.completed || !progress.swordCollected) return false;
  if (weapon === 'zombie-gun') {
    if (!zombieGunUnlocked) return false;
    zombieForestSwordActive = false;
    swordQuickHolstered = false;
    quickToggleWeapon = 'zombie-gun';
    if (progress.equippedWeapon !== 'zombie-gun') publish({ ...progress, equippedWeapon: 'zombie-gun' });
    return true;
  }
  if (weapon !== null && weapon !== 'ghost-sword') return false;
  if (weapon === null) {
    zombieForestSwordActive = false;
    swordQuickHolstered = false;
  } else {
    swordQuickHolstered = false;
    quickToggleWeapon = 'ghost-sword';
  }
  if (progress.equippedWeapon !== weapon) publish({ ...progress, equippedWeapon: weapon });
  return true;
}
export function isGhostDefeated(id: string) { return GHOST_IDS.includes(id as GhostId) && progress.hp[id as GhostId] === 0; }
export function markGhostEncounter(id: string) {
  if (!GHOST_IDS.includes(id as GhostId) || progress.encountered.includes(id as GhostId) || progress.completed) return false;
  publish({ ...progress, encountered: [...progress.encountered, id as GhostId] });
  return true;
}
export function collectGhostSword() {
  if (progress.swordCollected || progress.encountered.length !== 3) return false;
  swordQuickHolstered = false;
  quickToggleWeapon = 'ghost-sword';
  publish({ ...progress, swordCollected: true, equippedWeapon: 'ghost-sword' });
  return true;
}
/** Reaching the unlocked sword is sufficient: no interaction key, hold timer or guard-distance gate. */
export function tryAutoCollectGhostSword(playerX:number,playerZ:number,swordX:number,swordZ:number,onFoot:boolean,alive=true) {
  if (progress.swordCollected || progress.encountered.length !== 3 || !onFoot || !alive ||
      !Number.isFinite(playerX) || !Number.isFinite(playerZ) || !Number.isFinite(swordX) || !Number.isFinite(swordZ) ||
      Math.hypot(playerX-swordX,playerZ-swordZ)>SWORD_PICKUP_RADIUS_M+1e-9) return false;
  return collectGhostSword();
}
export function damageMissionGhost(id: string, amount: number) {
  if (!GHOST_IDS.includes(id as GhostId) || !progress.swordCollected || progress.completed || !Number.isFinite(amount) || amount <= 0) return false;
  const ghostId = id as GhostId;
  if (progress.hp[ghostId] === 0) return false;
  const hp = { ...progress.hp, [ghostId]: Math.max(0, progress.hp[ghostId] - amount) };
  const completed = GHOST_IDS.every(ghost => hp[ghost] === 0);
  publish({ ...progress, hp, completed, equippedWeapon: completed ? null : progress.equippedWeapon });
  return true;
}
