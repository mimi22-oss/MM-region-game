import type {GhostEncounterInteractionState} from '../ghostConfig.ts';
type Input={dt:number;valid:boolean;protected:boolean;distance:number;attackNormalized:number;defence:'none'|'block'|'parry'|'dodge';x:number;z:number};
/** Guard combat reuses the existing player's neck-grab/fall/death contract. */
export class GuardMeleeController {
 private phase:'idle'|'windup'|'grab'|'fall'='idle';private elapsed=0;private cooldown=0;private seq=100000;
 readonly interaction:GhostEncounterInteractionState={active:false,phase:'none',seq:0,ghostX:0,ghostZ:0,fallProgress:0};
 started=false;killed=false;parried=false;
 private holdSec:number;private fallSec:number;
 constructor(holdSec=1.15,fallSec=3.15){this.holdSec=holdSec;this.fallSec=fallSec;}
 get engaged(){return this.phase!=='idle';}
 cancel(){this.phase='idle';this.elapsed=0;this.interaction.active=false;this.interaction.phase='none';this.cooldown=1.5;}
 step(input:Input){
  this.started=false;this.killed=false;this.parried=false;
  this.cooldown=Math.max(0,this.cooldown-input.dt);
  if(input.protected||!input.valid||input.distance>2.45){if(this.engaged)this.cancel();return this.interaction;}
  if(this.phase==='idle'){
   if(input.distance<=1.65&&this.cooldown===0){this.phase='windup';this.started=true;this.elapsed=0;}
  }else if(this.phase==='windup'){
   // Contact is driven by Ghost_Attack's actual mixer progress, not an unrelated timeout.
   if(input.attackNormalized>=.5){
    if(input.defence!=='none'){this.parried=input.defence==='parry';this.cancel();}
    else{this.phase='grab';this.elapsed=0;this.interaction.active=true;this.interaction.phase='neck-grab';this.interaction.seq=++this.seq;}
   }
  }else{
   this.elapsed+=input.dt;
   if(this.phase==='grab'&&this.elapsed>=this.holdSec){this.phase='fall';this.elapsed=0;this.interaction.phase='player-fall';this.interaction.seq=++this.seq;}
   else if(this.phase==='fall'){
    this.interaction.fallProgress=Math.min(1,this.elapsed/this.fallSec);
    if(this.elapsed>=this.fallSec){this.killed=true;this.cancel();}
   }
  }
  this.interaction.ghostX=input.x;this.interaction.ghostZ=input.z;return this.interaction;
 }
}
