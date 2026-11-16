import {LoopOnce,LoopRepeat,type AnimationAction,type AnimationClip,type AnimationMixer,type Object3D} from 'three';
import {COMBAT_CLIPS,ATTACKS,type CombatClip} from './AttackDefinitions.ts';
import {CombatController} from './CombatController.ts';

import {fitSwordClips} from './SwordPose.ts';

/** Shares the character's existing mixer; the caller owns exactly one update path. */
export class CombatAnimationDriver {
 readonly clips=new Map<CombatClip,AnimationClip>();private action:AnimationAction|null=null;
 private key='';private finished=false;private active=false;private disposed=false;
 private lease:ReturnType<CombatController['bindAnimation']>;
 private retired=new Map<AnimationAction,number>();
 private mixer:AnimationMixer;private root:Object3D;private state:CombatController;
 private sample:(active:boolean)=>void;private enter:()=>void;
 private readonly onFinished=(event:{action:AnimationAction})=>{if(event.action===this.action)this.finished=true;};
 constructor(mixer:AnimationMixer,root:Object3D,clips:readonly AnimationClip[],state:CombatController,
  sample:(active:boolean)=>void=()=>{},enter:()=>void=()=>{}){
  this.mixer=mixer;this.root=root;this.state=state;this.sample=sample;this.enter=enter;
  const fitted=fitSwordClips(root,clips);
  for(const name of COMBAT_CLIPS){const clip=fitted.find(c=>c.name===name);if(clip&&clip.duration>0)this.clips.set(name,clip);}
  this.lease=state.bindAnimation(COMBAT_CLIPS.every(name=>this.clips.has(name)));
  mixer.addEventListener('finished',this.onFinished);
 }
 get enabled(){return this.lease.current()&&this.state.running;}
 get currentClip(){return this.action?.getClip().name??null;}
 get actionTime(){return this.action?.time??0;}
 update(dt:number){
  if(this.disposed)return false;
  if(!this.enabled){this.stop();return false;}
  if(!this.active){this.enter();this.active=true;this.key='';}
  if(this.state.paused){this.mixer.update(0);return true;}
  let remaining=Math.min(.25,Math.max(0,dt));
  do{
   const step=Math.min(1/60,remaining);remaining-=step;
   const desired=this.state.clip??(Math.abs(this.state.speed)>.1?(Math.abs(this.state.speed)>5.8?'Sword_Run':'Sword_Walk'):'Combat_Idle');
   const key=`${desired}:${this.state.actionActive?this.state.sequence:0}`;
   const clip=this.clips.get(desired);
   if(!clip){this.state.message=`Missing combat clip: ${desired}`;this.state.cancel();this.stop();return false;}
   if(this.key!==key){
    const previous=this.action,next=this.mixer.clipAction(clip,this.root);
    this.finished=false;next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    next.setLoop(this.state.actionActive?LoopOnce:LoopRepeat,this.state.actionActive?1:Infinity);next.clampWhenFinished=true;
    this.retired.delete(next);
    next.play();if(previous&&previous!==next){previous.fadeOut(.1);this.retired.set(previous,.12);next.fadeIn(.1);}else next.fadeIn(.06);
    this.action=next;this.key=key;
   }
   const sequence=this.state.sequence,action=this.action!;
   this.mixer.update(step);
   for(const [old,left] of this.retired){if(left<=step){old.stop();this.retired.delete(old);}else this.retired.set(old,left-step);}
   if(this.state.actionActive)this.state.sample(action.time/clip.duration);
   else{this.state.phase=Math.abs(this.state.speed)>.1?'MOVE':'IDLE';this.state.idleStep(step);}
   this.sample(this.state.phase==='ACTIVE'&&!!ATTACKS[desired]);
   if(this.finished){this.finished=false;this.state.finish(sequence);}
  }while(remaining>1e-8);
  return true;
 }
 stop(){
  if(!this.active)return;
  for(const clip of this.clips.values())this.mixer.existingAction(clip,this.root)?.stop();
  this.action=null;this.key='';this.active=false;
  this.retired.clear();
 }
 dispose(){
  if(this.disposed)return;this.stop();this.disposed=true;
  this.mixer.removeEventListener('finished',this.onFinished);
  for(const clip of this.clips.values())this.mixer.uncacheAction(clip,this.root);
  this.lease.release();
 }
}
