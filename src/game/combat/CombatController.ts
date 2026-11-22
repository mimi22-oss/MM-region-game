import {ATTACKS,COMBO,type CombatClip,type CombatCommand} from './AttackDefinitions.ts';
export type CombatPhase='UNARMED'|'IDLE'|'MOVE'|'STARTUP'|'ACTIVE'|'RECOVERY'|'BLOCK'|'PARRY'|'DODGE'|'STAGGER'|'KNOCKBACK'|'DEAD';
/** Normalized progress of `Heavy_Slash` right where the leap lands & blade slams downward onto the ground. */
export const HEAVY_SLASH_LANDING_NORMALIZED=0.48;
const DEFENSIVE_COMMANDS=new Set<CombatCommand>(['Sword_Block','Sword_Parry','Dodge_Left','Dodge_Right']);
export class CombatController {
 phase:CombatPhase='UNARMED'; clip:CombatClip|null=null; sequence=0; normalized=0; comboIndex=-1;
 equipped=false; allowed=false; paused=false; dead=false; capable=false; weaponReady=true; speed=0; message='';
 private buffered:CombatCommand|null=null; private comboRemaining=0; private busy=false;
 private animationOwner:object|null=null;
 private heavySlamCueFired=false;
 readonly hits=new Set<string>();
 onAttackStart:((clip:CombatClip)=>void)|null=null;
 onHeavySlashImpact:(()=>void)|null=null;
 get running(){return this.equipped&&this.allowed&&this.capable&&this.weaponReady&&!this.dead;}
 get movementLocked(){return this.running&&this.busy;}
 get attacking(){return this.busy&&!!this.clip&&!!ATTACKS[this.clip];}
 get actionActive(){return this.busy;}
 bindAnimation(ready:boolean){
  const owner={};this.animationOwner=owner;this.capable=ready;this.cancel();
  return {current:()=>this.animationOwner===owner,release:()=>{if(this.animationOwner===owner){this.animationOwner=null;this.capable=false;this.cancel();}}};
 }
 context(equipped:boolean,allowed:boolean,paused=false,dead=false){
  this.equipped=equipped;this.allowed=allowed;this.paused=paused;this.dead=dead;
  if(dead||!equipped||!allowed){this.cancel();this.phase=dead?'DEAD':'UNARMED';}
  else if(this.phase==='UNARMED'||this.phase==='DEAD')this.phase='IDLE';
 }
 request(command:CombatCommand):boolean {
  if(!this.running||this.paused){this.message=this.capable?'Combat unavailable in this state':'Choose a combat GLB character';return false;}
  if(this.busy){
   if(DEFENSIVE_COMMANDS.has(command)){
    this.cancel();this.start(command);return true;
   }
   const def=this.clip?ATTACKS[this.clip]:undefined;
   if(!def||command!=='combo'||this.normalized<def.bufferStart||this.normalized>.96||this.buffered)return false;
   this.buffered=command;return true;
  }
  this.start(command);return true;
 }
 private start(command:CombatCommand){
  if(command==='combo'){
   this.comboIndex=this.comboRemaining>0?(this.comboIndex+1)%COMBO.length:0;
   this.clip=COMBO[this.comboIndex];
  }else{this.clip=command;this.comboIndex=-1;}
  this.busy=true;this.normalized=0;this.sequence++;this.hits.clear();this.buffered=null;this.heavySlamCueFired=false;
  this.sample(0);
  if(this.clip&&ATTACKS[this.clip]&&this.clip!=='Heavy_Slash')this.onAttackStart?.(this.clip);
 }
 sample(normalized:number){
  if(!this.busy||!this.clip)return;
  this.normalized=Math.min(1,Math.max(0,normalized));
  const def=ATTACKS[this.clip];
  this.phase=def?(normalized<def.activeStart?'STARTUP':normalized<=def.activeEnd?'ACTIVE':'RECOVERY'):
   this.clip==='Sword_Block'?'BLOCK':this.clip==='Sword_Parry'?'PARRY':this.clip.startsWith('Dodge')?'DODGE':this.clip==='Knockback'?'KNOCKBACK':'STAGGER';
  if(this.clip==='Heavy_Slash'&&!this.heavySlamCueFired&&this.normalized>=HEAVY_SLASH_LANDING_NORMALIZED){
   this.heavySlamCueFired=true;
   this.onHeavySlashImpact?.();
  }
 }
 finish(sequence:number){
  if(!this.busy||sequence!==this.sequence)return;
  this.busy=false;this.clip=null;this.phase='IDLE';this.comboRemaining=.7;this.heavySlamCueFired=false;
  const next=this.buffered;this.buffered=null;
  if(next&&this.running&&!this.paused)this.start(next);
 }
 idleStep(dt:number){if(!this.paused&&!this.busy)this.comboRemaining=Math.max(0,this.comboRemaining-dt);}
 cancel(){this.busy=false;this.clip=null;this.buffered=null;this.comboRemaining=0;this.comboIndex=-1;this.hits.clear();this.normalized=0;this.heavySlamCueFired=false;}
 interrupt(clip:'Hit_React'|'Knockback'){
  if(!this.running||this.paused)return false;
  this.cancel();this.start(clip);return true;
 }
 defend(): 'none'|'block'|'parry'|'dodge' {
  if(!this.running||this.paused)return 'none';
  if(this.phase==='DODGE'&&this.normalized>=.15&&this.normalized<=.75)return 'dodge';
  if(this.phase==='PARRY'&&this.normalized>=.15&&this.normalized<=.6)return 'parry';
  if(this.phase==='BLOCK'&&this.normalized>=.1&&this.normalized<=.9)return 'block';
  return 'none';
 }
}
