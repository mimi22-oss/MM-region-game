/** One application audio graph. Context creation/resume is restricted to trusted input handlers. */
export interface AudioLevels { master:number; ghost:number; ambience:number }
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
export class GameAudioRuntime {
 context:AudioContext|null=null;
 master:GainNode|null=null;
 ghost:GainNode|null=null;
 ambience:GainNode|null=null;
 private levels:AudioLevels={master:.3,ghost:.7,ambience:1};
 private active=true;
 private compressor:DynamicsCompressorNode|null=null;
 private refs=0;
 private unlockHandler=(event:Event)=>{if(event.isTrusted&&(!('key' in event)||!(event as KeyboardEvent).repeat))this.unlock();};
 private visibility=()=>{if(this.context&&document.hidden)void this.context.suspend().catch(()=>{});};
 attach(){
  if(this.refs++===0&&typeof document!=='undefined'){
   for(const type of ['pointerdown','pointerup','keydown'])document.addEventListener(type,this.unlockHandler);
   document.addEventListener('visibilitychange',this.visibility);
  }
  return ()=>{if(--this.refs===0&&typeof document!=='undefined'){
   for(const type of ['pointerdown','pointerup','keydown'])document.removeEventListener(type,this.unlockHandler);
   document.removeEventListener('visibilitychange',this.visibility);
   if(this.context)void this.context.suspend().catch(()=>{});
  }};
 }
 unlock(){
  if(typeof navigator!=='undefined'&&navigator.userActivation&&!navigator.userActivation.isActive)return;
  if(typeof AudioContext==='undefined'||!this.active||typeof document!=='undefined'&&document.hidden)return;
  try{
   if(!this.context){
    const ctx=this.context=new AudioContext();
    this.master=ctx.createGain();this.ghost=ctx.createGain();this.ambience=ctx.createGain();
    this.compressor=ctx.createDynamicsCompressor();
    this.compressor.threshold.value=-18;this.compressor.knee.value=18;this.compressor.ratio.value=8;
    this.compressor.attack.value=.008;this.compressor.release.value=.22;
    this.ghost.connect(this.master);this.ambience.connect(this.master);
    this.master.connect(this.compressor).connect(ctx.destination);this.apply();
   }
   if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
  }catch{/* Unsupported/denied audio keeps gameplay available. */}
 }
 setLevels(next:Partial<AudioLevels>){for(const key of ['master','ghost','ambience'] as const)if(next[key]!==undefined)this.levels[key]=clamp(next[key]!);this.apply();}
 setActive(active:boolean){this.active=active;this.apply();}
 private apply(){const t=this.context?.currentTime??0;
  this.master?.gain.setTargetAtTime(this.active?this.levels.master*.6:0,t,.05);
  this.ghost?.gain.setTargetAtTime(this.levels.ghost,t,.05);this.ambience?.gain.setTargetAtTime(this.levels.ambience,t,.05);
 }
 /** World-space camera basis, supplied by the active R3F camera; no scene traversals. */
 listener(x:number,y:number,z:number,fx:number,fy:number,fz:number,ux:number,uy:number,uz:number){
  const ctx=this.context;if(!ctx||ctx.state!=='running')return;const l=ctx.listener,t=ctx.currentTime;
  l.positionX.value=x;l.positionY.value=y;l.positionZ.value=z;
  l.forwardX.setTargetAtTime(fx,t,.025);l.forwardY.setTargetAtTime(fy,t,.025);l.forwardZ.setTargetAtTime(fz,t,.025);
  l.upX.value=ux;l.upY.value=uy;l.upZ.value=uz;
 }
}
export const gameAudio=new GameAudioRuntime();
