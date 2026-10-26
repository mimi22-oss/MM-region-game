import type {TimePeriod} from './environmentTime';

/** Small synthesized rural soundscape; no downloaded files or continuously scheduled hidden-tab audio. */
export class AmbientAudio {
 readonly context:AudioContext;
 private master:GainNode;
 private wind:AudioBufferSourceNode;
 private breeze:GainNode;
 private filter:BiquadFilterNode;
 private voices=new Set<OscillatorNode>();
 private timer:ReturnType<typeof setInterval>|null=null;
 private generation=0;
 private disposed=false;
 private tick=0;
 private period:TimePeriod='day';
 constructor(){
  this.context=new AudioContext();
  const ctx=this.context;this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
  let previous=0;for(let i=0;i<data.length;i++){previous=(previous+(Math.random()*2-1)*.025)/1.025;data[i]=previous*3;}
  this.wind=ctx.createBufferSource();this.wind.buffer=buffer;this.wind.loop=true;
  this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=750;
  this.breeze=ctx.createGain();this.breeze.gain.value=.09;
  this.wind.connect(this.filter).connect(this.breeze).connect(this.master);this.wind.start();
 }
 async configure(period:TimePeriod,volume:number,active:boolean){
  if(this.disposed)return;
  const version=++this.generation;
  if(this.period!==period){this.stopVoices();this.tick=0;}this.period=period;
  const ctx=this.context;
  this.master.gain.cancelScheduledValues(ctx.currentTime);
  this.master.gain.setTargetAtTime(active?Math.max(0,Math.min(1,volume))*.6:0,ctx.currentTime,.2);
  this.breeze.gain.setTargetAtTime(period==='night'?.045:.09,ctx.currentTime,.5);
  if(!active||volume===0){this.clearTimer();this.stopVoices();await ctx.suspend().catch(()=>{});return;}
  await ctx.resume().catch(()=>{});
  if(this.disposed||version!==this.generation||ctx.state!=='running')return;
  if(!this.timer){this.play();this.timer=setInterval(()=>this.play(),2400);}
 }
 private tone(delay:number,frequency:number,end:number,duration:number,level:number,type:OscillatorType='sine'){
  if(this.disposed||this.voices.size>=48)return;
  const ctx=this.context,start=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(frequency,start);osc.frequency.exponentialRampToValueAtTime(end,start+duration);
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+Math.min(.03,duration/3));gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain).connect(this.master);this.voices.add(osc);
  osc.onended=()=>{this.voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+duration+.02);
 }
 private play(){
  if(this.context.state!=='running'||this.disposed)return;
  this.tick++;
  if(this.period==='morning'||this.period==='day'||this.period==='evening'&&this.tick%3===1){
   const count=this.period==='morning'?5:2;
   for(let i=0;i<count;i++)this.tone(i*.18,1800+i*160,2900-i*100,.13,.065);
  }
  // A rising, then falling four-syllable rooster phrase in the morning.
  if(this.period==='morning'&&this.tick%6===1){
   [0,.22,.48,.78].forEach((delay,i)=>{
    this.tone(.9+delay,480+i*90,i===3?380:660,.18+(i===3?.4:0),.04,'triangle');
    this.tone(.9+delay,960+i*180,i===3?760:1320,.18+(i===3?.4:0),.018);
   });
  }
  if(this.period==='night'||this.period==='evening'){
   for(let i=0;i<12;i++)this.tone(i*.075,4700+(this.tick%3)*170,4400+(this.tick%3)*170,.045,.035);
   if(this.period==='night')for(let i=0;i<5;i++)this.tone(1.3+i*.1,3200,3600,.065,.025);
  }
 }
 private clearTimer(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 private stopVoices(){for(const osc of this.voices){try{osc.stop();}catch{}}this.voices.clear();}
 dispose(){if(this.disposed)return;this.disposed=true;this.generation++;this.clearTimer();this.stopVoices();this.wind.stop();this.wind.disconnect();this.filter.disconnect();this.breeze.disconnect();this.master.disconnect();void this.context.close().catch(()=>{});}
}
