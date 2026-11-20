import { clearGhostCombatReaction } from '../combat/GhostCombatReactions.ts';
import { resetPlayerKnockback } from '../combat/playerKnockback.ts';
import { clearGhostEncounterInteraction, clearGhostThreat } from '../ghostConfig.ts';
import { rideLife } from '../rideLife.ts';
import { GHOST_IDS, resetThreeGhostsMission } from './threeGhostsMission.ts';
import { rerollZombieForestWave } from './zombieForestMission.ts';

export type VictoryMissionKind = 'ghost' | 'zombie';

/**
 * Pure transition detector: returns which mission JUST completed (`false -> true`),
 * preventing the Victory Dialog from popping up on initial page load of an already-completed save.
 */
export function detectMissionVictoryTransition(
  prevGhostCompleted: boolean,
  nextGhostCompleted: boolean,
  prevZombieCompleted: boolean,
  nextZombieCompleted: boolean,
): VictoryMissionKind | null {
  if (!prevZombieCompleted && nextZombieCompleted) return 'zombie';
  if (!prevGhostCompleted && nextGhostCompleted) return 'ghost';
  return null;
}

/**
 * Fully resets Mission 1 (Ghost Mission) even after completion (`✓ ပြီးဆုံးပြီ`)
 * so the player can search for all 3 ghosts, pick up the sword, and fight again from scratch.
 */
export function resetGhostMissionForReplay(): void {
  resetThreeGhostsMission();
  for (const id of GHOST_IDS) {
    clearGhostCombatReaction(id);
    clearGhostEncounterInteraction(id);
    clearGhostThreat(id);
  }
  resetPlayerKnockback();
  rideLife.lives = 3;
  rideLife.damage = 0;
  rideLife.invulnerable = 0;
  rideLife.crashTime = 0;
  rerollZombieForestWave(Math.random, false);
}

/**
 * Resets Mission 2 (Zombie Forest) back to 0/13 so it can be replayed cleanly
 * even after `✓ ပြီးဆုံးပြီ` (and triggers the Zombie Victory Dialog again on 13/13!).
 */
export function resetZombieMissionForReplay(): void {
  rideLife.lives = 3;
  rideLife.damage = 0;
  rideLife.invulnerable = 0;
  rerollZombieForestWave(Math.random, false);
}
