import {getActiveMissionWeapon} from '../missions/threeGhostsMission.ts';
import {activateKnifeGuard} from '../missions/zombieForestMission.ts';
import {stopSpecialAction} from '../specialActions.ts';
import type {CombatCommand} from './AttackDefinitions.ts';
import {playerCombat} from './combatRuntime.ts';
import {requestGunShot} from './gunCombatRuntime.ts';

const GUARD_COMMANDS = new Set<CombatCommand>([
  'Sword_Block',
  'Sword_Parry',
  'Dodge_Left',
  'Dodge_Right',
]);

export let selectedSwordAttack:CombatCommand='combo';
export function selectSwordAttack(command:CombatCommand){
  selectedSwordAttack=command;
  if(GUARD_COMMANDS.has(command)&&getActiveMissionWeapon()==='ghost-sword'){
    activateKnifeGuard();
  }
}
export function requestSwordAttack(command:'attack'|CombatCommand) {
  const activeWeapon=getActiveMissionWeapon();
  if(activeWeapon==='zombie-gun'){
    return requestGunShot().fired;
  }
  if(activeWeapon!=='ghost-sword')return false;
  const resolved:CombatCommand=command==='attack'?selectedSwordAttack:command;
  if(GUARD_COMMANDS.has(resolved)){
    activateKnifeGuard();
  }
  const accepted=playerCombat.request(resolved);
  if(accepted)stopSpecialAction(true);
  return accepted||GUARD_COMMANDS.has(resolved);
}
