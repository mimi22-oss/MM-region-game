import {ghostCombatMovementLocked} from '../combat/GhostCombatReactions.ts';
import {isPlayerHomeProtected} from '../playerHomeProtection.ts';
import { area5 } from '../../data/wards/myothar/area5.ts';
import { GHOST_IDS, getThreeGhostsProgress, type GhostId } from './threeGhostsMission.ts';
import { getGhostRuntime } from './ghostRuntimeRegistry.ts';

/** Lightweight shared world-space controller. No React state or per-frame storage writes. */
export type GuardMode = 'gather' | 'guard' | 'chase' | 'search' | 'wait' | 'return';
type Ghost = { x:number; z:number; mode:GuardMode; timer:number; phase:number; initialized:boolean; updatedAt?:number };
const ghosts: Record<GhostId,Ghost> = {
  'ghost-1': {x:0,z:0,mode:'gather',timer:0,phase:0,initialized:false},
  'ghost-2': {x:0,z:0,mode:'gather',timer:0,phase:2.1,initialized:false},
  'ghost-3': {x:0,z:0,mode:'gather',timer:0,phase:4.2,initialized:false},
};
const offsets: Record<GhostId,[number,number]> = {'ghost-1':[-10,-8],'ghost-2':[10,-8],'ghost-3':[0,9]};
let previousTime = -1;
let groupCooldown = 0;
let playerX = 0;
let playerZ = 0;

let previousActive = false;
const distance = (ax:number,az:number,bx:number,bz:number) => Math.hypot(ax-bx,az-bz);
const random = (a:number,b:number) => a + Math.random()*(b-a);
function move(g:Ghost,x:number,z:number,step:number) {
  const d=distance(g.x,g.z,x,z); if(d<0.001)return;
  const t=Math.min(1,step/d); g.x+=(x-g.x)*t;g.z+=(z-g.z)*t;
}
export function guardMissionActive() {
  const p=getThreeGhostsProgress();return p.encountered.length===3 && !p.completed;
}
export function updateGhostGuard(now:number, px:number,pz:number) {
  if(previousTime===now)return;
  const dt=previousTime<0?0:Math.min(Math.max(now-previousTime,0),0.12);
  previousTime=now;playerX=px;playerZ=pz;
  const active=guardMissionActive();
  if(!active){previousActive=false;return;}
  if(!previousActive){
    for(const id of GHOST_IDS){const g=ghosts[id];g.mode='gather';g.timer=0;g.initialized=false;}
    groupCooldown=0;
  }
  previousActive=true;
  groupCooldown=Math.max(0,groupCooldown-dt);
  const p=getThreeGhostsProgress();
  const eligible=GHOST_IDS.filter(id=>p.hp[id]>0 && ['guard','wait','search'].includes(ghosts[id].mode) && distance(ghosts[id].x,ghosts[id].z,px,pz)<19);
  if(eligible.length && groupCooldown===0){
    const roll=Math.random();const wanted=roll<0.45?1:roll<0.85?2:3;
    const candidates=[...eligible].sort(()=>Math.random()-0.5);
    // Other guards can respond to the disturbance even if outside immediate detection range.
    for(const id of GHOST_IDS)if(!candidates.includes(id) && p.hp[id]>0 && ghosts[id].mode==='guard')candidates.push(id);
    for(const id of candidates.slice(0,wanted)){
      const g=ghosts[id];g.mode='chase';g.timer=random(7,15);
    }
    groupCooldown=random(5,9);
  }
  for(const id of GHOST_IDS){
    const g=ghosts[id];if(p.hp[id]===0||ghostCombatMovementLocked(id))continue;
    if(isPlayerHomeProtected(px,pz)){g.mode='return';g.timer=0;}
    const [ox,oz]=offsets[id];const gx=area5.pitch.x+ox;const gz=area5.pitch.z+oz;
    if(!g.initialized)continue; // GhostNpc seeds initial position from the existing AI.
    g.updatedAt = performance.now();
    g.timer-=dt;
    switch(g.mode){
      case 'gather':move(g,gx,gz,dt*5);if(distance(g.x,g.z,gx,gz)<1.2){g.mode='guard';g.timer=0;}break;
      case 'guard':{
        g.phase+=dt*0.2;move(g,gx+Math.cos(g.phase)*2,gz+Math.sin(g.phase)*2,dt*1.4);break;
      }
      case 'chase':{
        // Maintain realistic melee duel spacing when the player holds the sword so ghosts don't clip into 0m and insta-grab
        const stopDist=p.swordCollected?1.32:0.65;
        const dToPlayer=distance(g.x,g.z,px,pz);
        if(dToPlayer>stopDist){
          const speed=p.swordCollected?(id==='ghost-1'?4.4:id==='ghost-2'?4.0:3.6):(id==='ghost-1'?5.2:id==='ghost-2'?4.7:4.1);
          move(g,px,pz,Math.min(dToPlayer-stopDist,dt*speed));
        }
        // Random separation after a meaningful distance from the field.
        const away=distance(g.x,g.z,area5.pitch.x,area5.pitch.z);
        if(g.timer<=0 || (away>26 && Math.random()<dt*0.13)){
          g.mode='search';g.timer=random(5,12);
        }
        break;
      }
      case 'search':{
        if(g.timer<=0){g.mode='wait';g.timer=random(8,20);}break;
      }
      case 'wait':if(g.timer<=0){g.mode='return';g.timer=random(5,15);}break;
      case 'return':{
        if(g.timer>0)break;
        move(g,gx,gz,dt*2.5);if(distance(g.x,g.z,gx,gz)<1.2){g.mode='guard';g.timer=0;}break;
      }
    }
  }
}
export function getGuardGhost(id:GhostId){return ghosts[id];}
export function seedGuardGhost(id:GhostId,x:number,z:number){const g=ghosts[id];if(!g.initialized){g.x=x;g.z=z;g.initialized=true;}}
export function swordGuardClear(radius=20){
  if(!guardMissionActive())return false;
  const p=getThreeGhostsProgress();
  return GHOST_IDS.every(id=>{
    if (p.hp[id]===0) return true;
    const runtime = getGhostRuntime(id);
    // Pickup uses the same fresh world-space positions as encounters and combat.
    return !!runtime?.active && distance(runtime.x,runtime.z,area5.pitch.x,area5.pitch.z)>radius+1e-6;
  });
}
export function getGuardSummary(){return GHOST_IDS.map(id=>({id,mode:ghosts[id].mode,x:ghosts[id].x,z:ghosts[id].z,initialized:ghosts[id].initialized,updatedAt:ghosts[id].updatedAt}));}
