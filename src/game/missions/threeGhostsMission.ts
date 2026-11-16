import { useSyncExternalStore } from 'react';

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
export interface ThreeGhostsProgress {
  version: 1;
  encountered: GhostId[];
  swordCollected: boolean;
  hp: Record<GhostId, number>;
  completed: boolean;
}
const initial = (): ThreeGhostsProgress => ({ version: 1, encountered: [], swordCollected: false,
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
    return { version: 1, encountered, swordCollected, hp, completed };
  } catch { return initial(); }
}
let progress: ThreeGhostsProgress = load();
const subscribers = new Set<() => void>();
function publish(next: ThreeGhostsProgress) {
  progress = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* storage disabled */ }
  subscribers.forEach(fn => fn());
}
export function getThreeGhostsProgress() { return progress; }
export function subscribeThreeGhostsMission(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; }
export function useThreeGhostsMission() { return useSyncExternalStore(subscribeThreeGhostsMission, getThreeGhostsProgress, getThreeGhostsProgress); }
export function hasCompletedThreeGhostsMission() { return progress.completed; }
export function isGhostDefeated(id: string) { return GHOST_IDS.includes(id as GhostId) && progress.hp[id as GhostId] === 0; }
export function markGhostEncounter(id: string) {
  if (!GHOST_IDS.includes(id as GhostId) || progress.encountered.includes(id as GhostId) || progress.completed) return false;
  publish({ ...progress, encountered: [...progress.encountered, id as GhostId] });
  return true;
}
export function collectGhostSword() {
  if (progress.swordCollected || progress.encountered.length !== 3) return false;
  publish({ ...progress, swordCollected: true });
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
  publish({ ...progress, hp, completed: GHOST_IDS.every(ghost => hp[ghost] === 0) });
  return true;
}
