import {gameAudio} from './gameAudio.ts';
export type GhostAudioCue='flee-scare'|'scream'|'evil-laugh'|'grab-impact';
export const HORROR_PRESETS=['ghost_ambient','ghost_whisper','ghost_warning','ghost_scream','ghost_evil_laugh','ghost_footsteps','ghost_chase_tension','ghost_grab','player_struggle','player_fall','ghost_disappear'] as const;
export type HorrorPreset=typeof HORROR_PRESETS[number];
const aliases:Record<GhostAudioCue,HorrorPreset>={'flee-scare':'ghost_warning',scream:'ghost_scream','evil-laugh':'ghost_evil_laugh','grab-impact':'ghost_grab'};
interface Voice {owner:string;preset:HorrorPreset;nodes:AudioNode[];sources:AudioScheduledSourceNode[];gain:GainNode;end:number;done:boolean;stopping?:boolean}
interface Emitter {panner:PannerNode;gain:GainNode}
export interface HorrorSyncFrame {state:string;clip:string;clipTime:number;clipDuration:number;moving:boolean;grabPhase:string;visible:boolean}
/** Tracks animation phase crossings, suppresses repeats and drops missed footfalls after stalls. */
export class HorrorAnimationSync {
 private state='';private clip='';private time=0;private phase='';
 step(frame:HorrorSyncFrame,emit:(preset:HorrorPreset)=>void){
  if(frame.state!==this.state){

   if(frame.state==='OBSERVING_PLAYER')emit('ghost_whisper');
   if(frame.state==='FLEEING')emit('ghost_warning');
   if(frame.state==='DESPAWNING')emit('ghost_disappear');
  }
  if(frame.clip!==this.clip){if(frame.clip==='freaky')emit('ghost_scream');if(frame.clip==='laugh_01')emit('ghost_evil_laugh');}
  if(frame.grabPhase!==this.phase){if(frame.grabPhase==='neck-grab'){emit('ghost_grab');emit('player_struggle');}if(frame.grabPhase==='player-fall')emit('player_fall');}
  if(frame.visible&&frame.moving&&frame.clip===this.clip&&frame.clipDuration>0){
   const interval=frame.clipDuration/4;
   if(frame.clipTime<this.time||Math.floor(frame.clipTime/interval)>Math.floor(this.time/interval))emit('ghost_footsteps');
  }
  this.state=frame.state;this.clip=frame.clip;this.time=frame.clipTime;this.phase=frame.grabPhase;
 }
}
/** Runtime synthesis only. Bounded voices, shared noise/graph, independent spatial emitters. */
export class GhostHorrorAudio {
 private noise:AudioBuffer|null=null;
 private voices=new Set<Voice>();
 private emitters=new Map<string,Emitter>();
 private curve:Float32Array<ArrayBuffer>;
 constructor(){this.curve=new Float32Array(512);for(let i=0;i<512;i++){const x=i/255.5-1;this.curve[i]=Math.tanh(x*2)/Math.tanh(2);}}
 unlock(){gameAudio.unlock();}
 private emitter(owner:string){
  const ctx=gameAudio.context;if(!ctx||!gameAudio.ghost)return null;
  let e=this.emitters.get(owner);if(!e){const panner=ctx.createPanner(),gain=ctx.createGain();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=3;panner.maxDistance=65;panner.rolloffFactor=1.8;gain.gain.value=0;panner.connect(gain).connect(gameAudio.ghost);e={panner,gain};this.emitters.set(owner,e);}return e;
 }
 position(owner:string,x:number,y:number,z:number,enabled=true){const e=this.emitter(owner),ctx=gameAudio.context;if(!e||!ctx)return;e.panner.positionX.value=x;e.panner.positionY.value=y;e.panner.positionZ.value=z;e.gain.gain.setTargetAtTime(enabled?1:0,ctx.currentTime,.04);if(!enabled)this.stop(owner);}
 private cleanup(v:Voice){if(v.done)return;v.done=true;this.voices.delete(v);for(const source of v.sources){source.onended=null;try{source.stop();}catch{}}for(const node of v.nodes)node.disconnect();}
 stop(owner:string,preset?:HorrorPreset){const ctx=gameAudio.context;if(!ctx)return;for(const v of this.voices)if(v.owner===owner&&(!preset||v.preset===preset)&&!v.stopping){v.stopping=true;v.gain.gain.cancelScheduledValues(ctx.currentTime);v.gain.gain.setTargetAtTime(0,ctx.currentTime,.012);for(const s of v.sources)try{s.stop(ctx.currentTime+.06);}catch{}}}
 release(owner:string){for(const v of [...this.voices])if(v.owner===owner)this.cleanup(v);const e=this.emitters.get(owner);e?.panner.disconnect();e?.gain.disconnect();this.emitters.delete(owner);}
 sustain(owner:string,preset:'ghost_ambient'|'ghost_chase_tension',active:boolean){if(!active){this.stop(owner,preset);return;}for(const v of this.voices)if(v.owner===owner&&v.preset===preset)return;this.play(preset,1,owner);}
 play(cue:GhostAudioCue|HorrorPreset,volume=1,owner='default'){
  const preset=cue in aliases?aliases[cue as GhostAudioCue]:cue as HorrorPreset;
  const ctx=gameAudio.context;if(!ctx||ctx.state!=='running'||!Number.isFinite(volume)||volume<=0||!HORROR_PRESETS.includes(preset)||this.voices.size>=24)return;
  const e=this.emitter(owner);if(!e)return;
  if(!this.noise){this.noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=this.noise.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.1)/1.1;data[i]=last*2;}}
  const duration=preset==='ghost_ambient'?4:preset==='ghost_chase_tension'?2.8:preset==='ghost_evil_laugh'?1.6:preset==='ghost_footsteps'?.16:preset==='ghost_grab'?.35:1.15;
  const t=ctx.currentTime,v:Voice={owner,preset,nodes:[],sources:[],gain:ctx.createGain(),end:t+duration,done:false};
  this.voices.add(v);v.nodes.push(v.gain);v.gain.gain.value=Math.min(1,volume)*.16;v.gain.connect(e.panner);
  const envelope=(dest:AudioNode,start:number,length:number,peak:number)=>{const g=ctx.createGain();v.nodes.push(g);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(peak,start+Math.min(.035,length/4));g.gain.exponentialRampToValueAtTime(.0001,start+length);g.connect(dest);return g;};
  const source=(s:AudioScheduledSourceNode,start:number,end:number)=>{v.sources.push(s);v.nodes.push(s);s.start(start);s.stop(end);};
  const tone=(start:number,length:number,freq:number,end:number,peak:number,voiced=false)=>{
   const osc=ctx.createOscillator();osc.type=voiced?'sawtooth':'sine';osc.frequency.setValueAtTime(freq,start);osc.frequency.exponentialRampToValueAtTime(end,start+length);
   const fm=ctx.createOscillator(),depth=ctx.createGain();fm.frequency.value=voiced?freq*1.97:5.7;depth.gain.value=voiced?freq*.18:5;fm.connect(depth).connect(osc.frequency);v.nodes.push(depth);source(fm,start,start+length+.02);
   let output:AudioNode=osc;
   if(voiced){const formant=ctx.createBiquadFilter(),dist=ctx.createWaveShaper();formant.type='bandpass';formant.frequency.value=preset==='ghost_scream'?1500:650;formant.Q.value=1.6;dist.curve=this.curve;osc.connect(dist).connect(formant);v.nodes.push(dist,formant);output=formant;}
   output.connect(envelope(v.gain,start,length,peak));source(osc,start,start+length+.02);
  };
  const noise=(start:number,length:number,freq:number,peak:number)=>{const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter();src.buffer=this.noise;src.loop=true;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=1.2;src.connect(filter).connect(envelope(v.gain,start,length,peak));v.nodes.push(filter);source(src,start,start+length+.02);};
  switch(preset){
   case 'ghost_evil_laugh': for(let i=0;i<6;i++){const f=340-i*27+(i%2)*35;tone(t+i*.235,.19,f,f*.73,.65,true);noise(t+i*.235,.12,1100,.12);}break;
   case 'ghost_scream':tone(t,.95,670,390,.85,true);tone(t,.95,1004,590,.25,true);noise(t,1.05,2200,.6);break;
   case 'ghost_ambient':tone(t,4,48,51,.5);noise(t,4,280,.25);break;
   case 'ghost_whisper':for(let i=0;i<4;i++)noise(t+i*.22,.24,900+i*420,.5);break;
   case 'ghost_warning':tone(t,.8,310,90,.65,true);noise(t,.8,650,.35);break;
   case 'ghost_footsteps':noise(t,.13,180,.9);tone(t,.12,92,38,.5);break;
   case 'ghost_chase_tension':for(let i=0;i<7;i++){tone(t+i*.38,.33,62+i*2,70+i*2,.6);noise(t+i*.38,.24,450,.22);}break;
   case 'ghost_grab':tone(t,.3,150,38,.9);noise(t,.22,550,.7);break;
   case 'player_struggle':for(let i=0;i<3;i++){noise(t+i*.33,.28,750,.6);tone(t+i*.33,.24,180,95,.35,true);}break;
   case 'player_fall':tone(t,.75,260,35,.6);noise(t+.65,.35,140,.9);break;
   case 'ghost_disappear':noise(t,.9,2000,.5);tone(t,1.1,430,70,.4);break;
  }
  // Quiet delayed reflections, synthesized afresh (allowed nodes only; no DelayNode or samples).
  if(preset==='ghost_scream'||preset==='ghost_disappear')for(let i=1;i<=3;i++)noise(t+i*.13,.5,1100,.12/i);
  // A silent sentinel owns cleanup after all scheduled layers/tails finish, including cancellation.
  const sentinel=ctx.createOscillator(),silent=ctx.createGain();silent.gain.value=0;sentinel.connect(silent).connect(v.gain);v.nodes.push(silent);source(sentinel,t,t+duration+.1);sentinel.onended=()=>this.cleanup(v);
 }
 dispose(){for(const owner of [...this.emitters.keys()])this.release(owner);this.noise=null;}
 get diagnostics(){return {voices:this.voices.size,emitters:this.emitters.size,contextState:gameAudio.context?.state??'locked'};}
}
const sharedGhostAudio=new GhostHorrorAudio();
let refs=0;
export function acquireSharedGhostAudio(){refs++;return sharedGhostAudio;}
export function releaseSharedGhostAudio(){if(refs>0&&--refs===0)sharedGhostAudio.dispose();}
