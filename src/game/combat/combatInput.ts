import {getThreeGhostsProgress} from '../missions/threeGhostsMission.ts';
import {stopSpecialAction} from '../specialActions.ts';
import type {CombatCommand} from './AttackDefinitions.ts';
import {playerCombat} from './combatRuntime.ts';

export let selectedSwordAttack:CombatCommand='combo';
export function selectSwordAttack(command:CombatCommand){selectedSwordAttack=command;}
export function requestSwordAttack(command:'attack'|CombatCommand) {
  if(getThreeGhostsProgress().equippedWeapon!=='ghost-sword')return false;
  const accepted=playerCombat.request(command==='attack'?selectedSwordAttack:command);
  if(accepted)stopSpecialAction(true);
  return accepted;
}
