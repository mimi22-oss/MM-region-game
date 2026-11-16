import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {Group,AnimationMixer} from 'three';
import {AnimationController} from '../../artifacts/ghost-audit/snapshot/src/animation/core/AnimationController';
import {GhostAiController} from '../../artifacts/ghost-audit/snapshot/src/game/ghostAi';
import {GhostNpc} from '../../artifacts/ghost-audit/snapshot/src/components/GhostNpc';
import {buildDefaultWarehouseEnvironment,isGhostPointWalkable,isGhostSegmentWalkable} from '../../artifacts/ghost-audit/snapshot/src/data/ghostWarehouseWaypoints';
import {hasWarehouseLineOfSight} from '../../artifacts/ghost-audit/snapshot/src/game/ghostAi';
import {GHOST_WAREHOUSE_ANCHOR as anchor} from '../../artifacts/ghost-audit/snapshot/src/game/ghostConfig';
import {getPlayerDeathState,requestPlayerRespawn,completePlayerRespawn,stepPlayerRespawnGrace} from '../../artifacts/ghost-audit/snapshot/src/game/playerDeath';
import {GhostGameOver} from '../../artifacts/ghost-audit/snapshot/src/components/GhostGameOver';
const api=window as any,env=buildDefaultWarehouseEnvironment();let player:Group|null=null;
api.runtime={ready:false,frames:[],timing:{},vehicle:false,sound:true,transitions:[],getDeath:getPlayerDeathState,resetDeath(){requestPlayerRespawn();completePlayerRespawn();stepPlayerRespawnGrace(6);},place(x:number,z:number){player?.position.set(x-10,0,z);player?.updateWorldMatrix(true,true);},
 approach(id:string,distance:number){const entry=api.__GHOST_NPC__.getSnapshots().find((e:any)=>e.ghostId===id),g=entry.snapshot;
  for(let i=0;i<64;i++){const a=i*Math.PI/32,x=g.x+Math.cos(a)*distance,z=g.z+Math.sin(a)*distance;
   if(isGhostPointWalkable(x,z)&&isGhostSegmentWalkable(g.x,g.z,x,z,.25)&&hasWarehouseLineOfSight(g.x,g.z,x,z,env.obstacleBoxes)){
    api.runtime.place(x,z);api.__GHOST_NPC__.forceState('HIDING',id);return {x,z,start:g};
   }
  }throw Error('No traversable approach found for '+id);
 }};
for(const [prototype,method,label] of [[GhostAiController.prototype,'step','ai'],[GhostAiController.prototype,'setTargetWaypoint','path'],[GhostAiController.prototype,'traversable','corridor'],[AnimationController.prototype,'stepBlend','blend'],[AnimationMixer.prototype,'update','animation']] as const){
 const original=(prototype as any)[method];(prototype as any)[method]=function(...args:any[]){const t=performance.now();try{return original.apply(this,args);}finally{const k=api.runtime.timing;const v=k[label]??{calls:0,ms:0};v.calls++;v.ms+=performance.now()-t;k[label]=v;}};
}
const originalStep=GhostAiController.prototype.step;
GhostAiController.prototype.step=function(input){const before=this.getSnapshot();const result=originalStep.call(this,input);if(before.state!==result.state)api.runtime.transitions.push({at:performance.now(),from:before.state,to:result.state,x:result.x,z:result.z,distance:result.distToPlayerM,detect:(this as any).cfg.detectRadiusM});return result;};
function Inspect(){useFrame(({gl,camera},dt)=>{camera.userData.playerOccupied=api.runtime.vehicle;api.runtime.frames.push({ms:dt*1000,calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures});});return null;}
function Fixture(){const [count,setCount]=useState(3),[selected,setSelected]=useState<string|null>(null),[mounted,setMounted]=useState(true),[paused,setPaused]=useState(false);
 api.runtime.count=setCount;api.runtime.select=setSelected;api.runtime.mount=setMounted;api.runtime.pause=setPaused;
 return <><GhostGameOver/><button>Audio unlock</button><Canvas shadows={false} dpr={1} style={{width:640,height:400}} camera={{position:[anchor.x,5,anchor.z+14]}} onCreated={()=>api.runtime.ready=true}>
 <ambientLight intensity={2}/><group position={[10,0,0]}><group ref={g=>{player=g;}} name="player-avatar" position={[anchor.x-10,0,anchor.z]}/></group>
 {mounted&&Array.from({length:count},(_,i)=>i+1).map(n=><GhostNpc key={n} ghostId={`ghost-${n}`} zoneId="warehouse-row" initialSeed={100+n} enabled={selected===null||selected===`ghost-${n}`} paused={paused} minute={1260} timeMode="night" soundEnabled={api.runtime.sound}/>)}
 <Inspect/></Canvas></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
