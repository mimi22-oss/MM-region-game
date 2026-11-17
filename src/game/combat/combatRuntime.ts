import {Vector3,type Object3D} from 'three';
import {CombatController} from './CombatController.ts';
import {ATTACKS} from './AttackDefinitions.ts';
import {SwordHitDetection} from './SwordHitDetection.ts';
import {GHOST_IDS,GROUP_SHIELD_RADIUS_M,SWORD_DAMAGE,damageMissionGhost,getThreeGhostsProgress,isGhostDefeated} from '../missions/threeGhostsMission.ts';
import {getGhostRuntime} from '../missions/ghostRuntimeRegistry.ts';
import {requestGhostReaction} from './GhostCombatReactions.ts';
import {clearGhostEncounterInteraction} from '../ghostConfig.ts';
import {canStand} from '../collision.ts';

export const playerCombat=new CombatController();
playerCombat.weaponReady=false;
type Target={root:Object3D;height:number;radius:number};
const targets=new Map<string,Target>();
let weapon:{root:Object3D;avatar:Object3D;base:Object3D;tip:Object3D}|null=null;
export function registerCombatTarget(id:string,target:Target){targets.set(id,target);return()=>{if(targets.get(id)===target)targets.delete(id);};}
export function registerCombatWeapon(root:Object3D,avatar:Object3D){
 const base=root.getObjectByName('sword-blade-base'),tip=root.getObjectByName('sword-blade-tip');
 if(!base||!tip)return()=>{};
 const entry={root,avatar,base,tip};weapon=entry;playerCombat.weaponReady=true;
 return()=>{if(weapon===entry){weapon=null;previousValid=false;playerCombat.weaponReady=false;playerCombat.cancel();}};
}
export const combatEffects={time:0,trailHead:0,impactHead:0,
 trail:Array.from({length:48},()=>({base:new Vector3(),tip:new Vector3(),at:-100,sequence:0})),
 impacts:Array.from({length:8},()=>({position:new Vector3(),at:-100,seed:0}))};
const previousBase=new Vector3(),previousTip=new Vector3(),base=new Vector3(),tip=new Vector3(),player=new Vector3(),targetPos=new Vector3(),a=new Vector3(),b=new Vector3(),forward=new Vector3();
const detector=new SwordHitDetection();let previousValid=false,previousActive=false,lastSequence=-1;
export function combatLineClear(ax:number,az:number,bx:number,bz:number){
 const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/.25));
 for(let i=1;i<=n;i++)if(!canStand(ax+(bx-ax)*i/n,az+(bz-az)*i/n))return false;
 return true;
}
/** Called by the player's one mixer owner, after each bounded animation substep. */
export function sampleCombatBlade(active:boolean){
 active=active&&playerCombat.phase==='ACTIVE'&&playerCombat.actionActive;
 if(!weapon||!playerCombat.running||!active||getThreeGhostsProgress().equippedWeapon!=='ghost-sword'){previousValid=false;previousActive=false;return;}
 weapon.root.updateWorldMatrix(true,false);
 weapon.base.getWorldPosition(base);weapon.tip.getWorldPosition(tip);
 if(lastSequence!==playerCombat.sequence){lastSequence=playerCombat.sequence;previousValid=false;previousActive=false;}
 if(!previousActive&&active)previousValid=false;
 if(!previousValid){previousBase.copy(base);previousTip.copy(tip);previousValid=true;}
 if(active&&playerCombat.clip&&ATTACKS[playerCombat.clip]){
  const trail=combatEffects.trail[combatEffects.trailHead++%combatEffects.trail.length];trail.base.copy(base);trail.tip.copy(tip);trail.at=combatEffects.time;trail.sequence=playerCombat.sequence;
  weapon.avatar.getWorldPosition(player);
  forward.set(0,0,-1).transformDirection(weapon.avatar.matrixWorld);
  let nearby=0;
  for(const id of GHOST_IDS){const g=getGhostRuntime(id);if(g?.active&&!isGhostDefeated(id)&&Math.hypot(g.x-player.x,g.z-player.z)<=GROUP_SHIELD_RADIUS_M)nearby++;}
  for(const [id,target] of targets){
   if(playerCombat.hits.has(id)||isGhostDefeated(id)||!getGhostRuntime(id)?.active)continue;
   target.root.getWorldPosition(targetPos);
   const dx=targetPos.x-player.x,dz=targetPos.z-player.z,distance=Math.hypot(dx,dz);
   const facing=distance<.01?1:(dx*forward.x+dz*forward.z)/distance;
   if(distance>3||facing<(playerCombat.clip==='Spin_Slash'?-.95:-.15))continue;
   a.set(targetPos.x,targetPos.y+target.height*.15,targetPos.z);b.set(targetPos.x,targetPos.y+target.height*.82,targetPos.z);
   if(!detector.sweptBlade(previousBase,previousTip,base,tip,a,b,target.radius+.09))continue;
   if(nearby>=2){playerCombat.message='Ghost နှစ်ကောင်နီးနေသဖြင့် damage ပိတ်ထားသည်။';continue;}
   if(!combatLineClear(player.x,player.z,targetPos.x,targetPos.z))continue;
   if(!damageMissionGhost(id,SWORD_DAMAGE))continue;
   playerCombat.hits.add(id);
   const dead=isGhostDefeated(id);
   requestGhostReaction(id,dead?'Ghost_Death':playerCombat.clip==='Heavy_Slash'||playerCombat.clip==='Combo_Finisher'?'Ghost_Stagger':'Ghost_Hit');
   clearGhostEncounterInteraction(id);
   const impact=combatEffects.impacts[combatEffects.impactHead++%combatEffects.impacts.length];
   impact.position.copy(base).lerp(tip,.5);impact.at=combatEffects.time;impact.seed=playerCombat.sequence*17+combatEffects.impactHead;
   playerCombat.message=`${id}: ${getThreeGhostsProgress().hp[id as keyof ReturnType<typeof getThreeGhostsProgress>['hp']]} HP`;
  }
 }
 previousBase.copy(base);previousTip.copy(tip);
 previousActive=active;
}
export function resetCombatSweep(){previousValid=false;}
