import {useSyncExternalStore} from 'react';
import {isPlayerHomeProtected,getPlayerHomeBoundary} from './playerHomeProtection.ts';
export interface PlayerDeathState {phase:'alive'|'dead'|'respawning';ghostId:string|null;generation:number}
let state:PlayerDeathState={phase:'alive',ghostId:null,generation:0},grace=0,lastToken='';
const listeners=new Set<()=>void>();
function emit(){for(const fn of listeners)fn();}
export function getPlayerDeathState(){return state;}
export function usePlayerDeathState(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},getPlayerDeathState);}
export function playerUnavailableForGhost(){return state.phase!=='alive'||grace>0;}
export function killPlayerFromGhost(ghostId:string,seq:number,x:number,z:number){
 const token=`${ghostId}:${seq}`;
 if(playerUnavailableForGhost()||isPlayerHomeProtected(x,z)||lastToken===token)return false;
 lastToken=token;state={phase:'dead',ghostId,generation:state.generation+1};emit();return true;
}
export function requestPlayerRespawn(){if(state.phase==='dead'){state={...state,phase:'respawning'};emit();}}
export function completePlayerRespawn(){if(state.phase==='respawning'){state={...state,phase:'alive',ghostId:null};grace=5;emit();}}
export function stepPlayerRespawnGrace(dt:number){grace=Math.max(0,grace-Math.max(0,dt));}
/** One-time bounded search: use a traversable point inside the configured protection. */
export function findProtectedRespawn(walk:(x:number,z:number)=>boolean){
 const b=getPlayerHomeBoundary(),centre=b.kind==='circle'?{x:b.x,z:b.z}:{x:b.points.reduce((s,p)=>s+p.x,0)/b.points.length,z:b.points.reduce((s,p)=>s+p.z,0)/b.points.length};
 if(isPlayerHomeProtected(centre.x,centre.z)&&walk(centre.x,centre.z))return centre;
 for(let r=1;r<=32;r++)for(let i=0;i<16;i++){const x=centre.x+Math.cos(i*Math.PI/8)*r,z=centre.z+Math.sin(i*Math.PI/8)*r;if(isPlayerHomeProtected(x,z)&&walk(x,z))return{x,z};}
 return null;
}
