import {GHOST_IDS, GHOST_STATS, collectGhostSword, damageMissionGhost, markGhostEncounter} from '../../src/game/missions/threeGhostsMission.ts';

/** Vehicle-physics fixtures start after the campaign unlocks the car. */
export function completeVehicleMission() {
  GHOST_IDS.forEach(markGhostEncounter);
  collectGhostSword();
  for (const id of GHOST_IDS) damageMissionGhost(id,GHOST_STATS[id].maxHp);
}
