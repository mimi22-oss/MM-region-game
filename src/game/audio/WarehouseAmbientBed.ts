import {gameAudio} from '../gameAudio.ts';
/** Persistent background layer inside the existing graph, not a second audio manager/context. */
export class WarehouseAmbientBed {
 private nodes:AudioNode[]=[];
 private sources:AudioScheduledSourceNode[]=[];
 private gain:GainNode;
 private disposed=false;
 constructor(){
  const ctx=gameAudio.context;if(!ctx||!gameAudio.ambience||ctx.state!=='running')throw new Error('Audio locked');
  this.gain=ctx.createGain();this.gain.gain.value=0;this.gain.connect(gameAudio.ambience);this.nodes.push(this.gain);
  const pan=ctx.createStereoPanner();pan.pan.value=-.12;pan.connect(this.gain);this.nodes.push(pan);
  const oscillator=(frequency:number,level:number,dest:AudioNode=pan)=>{const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.value=frequency;g.gain.value=level;osc.connect(g).connect(dest);this.nodes.push(osc,g);this.sources.push(osc);return osc;};
  const low=oscillator(43,.07);const mid=oscillator(65.2,.025);const high=oscillator(131.3,.008);
  const drift=ctx.createOscillator(),depth=ctx.createGain(),midDrift=ctx.createGain(),highDrift=ctx.createGain(),panDrift=ctx.createGain();
  drift.frequency.value=.043;depth.gain.value=2.4;midDrift.gain.value=-1.35;highDrift.gain.value=1.8;panDrift.gain.value=.22;
  drift.connect(depth).connect(low.frequency);drift.connect(midDrift).connect(mid.frequency);drift.connect(highDrift).connect(high.frequency);drift.connect(panDrift).connect(pan.pan);
  this.nodes.push(drift,depth,midDrift,highDrift,panDrift);this.sources.push(drift);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=buffer.getChannelData(0);let brown=0,sum=0;
  for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.035)/1.035;data[i]=brown;sum+=brown;}
  const mean=sum/data.length;for(let i=0;i<data.length;i++)data[i]-=mean;
  // Equal-power cyclic crossfade over the loop boundary eliminates 4s loop clicks/steps.
  const seam=Math.min(Math.floor(data.length/4),Math.floor(ctx.sampleRate*.25));
  for(let i=0;i<seam;i++){const k=data.length-seam+i,fadeOut=Math.cos((i/seam)*Math.PI*.5),fadeIn=Math.sin((i/seam)*Math.PI*.5);data[k]=data[k]*fadeOut+data[i]*fadeIn;}
  const noise=ctx.createBufferSource(),wind=ctx.createBiquadFilter(),rumble=ctx.createBiquadFilter(),metal=ctx.createBiquadFilter(),windGain=ctx.createGain(),rumbleGain=ctx.createGain(),metalGain=ctx.createGain();
  noise.buffer=buffer;noise.loop=true;wind.type='bandpass';wind.frequency.value=520;wind.Q.value=.45;rumble.type='lowpass';rumble.frequency.value=105;metal.type='bandpass';metal.frequency.value=418;metal.Q.value=8.5;
  windGain.gain.value=.12;rumbleGain.gain.value=.22;metalGain.gain.value=.035;
  noise.connect(wind).connect(windGain).connect(pan);noise.connect(rumble).connect(rumbleGain).connect(this.gain);noise.connect(metal).connect(metalGain).connect(pan);high.connect(metal);
  const gust=ctx.createOscillator(),gustDepth=ctx.createGain(),windSweep=ctx.createGain(),metalSweep=ctx.createGain();
  gust.frequency.value=.11;gustDepth.gain.value=.04;windSweep.gain.value=95;metalSweep.gain.value=34;
  gust.connect(gustDepth).connect(windGain.gain);gust.connect(windSweep).connect(wind.frequency);gust.connect(metalSweep).connect(metal.frequency);
  this.nodes.push(noise,wind,rumble,metal,windGain,rumbleGain,metalGain,gust,gustDepth,windSweep,metalSweep);this.sources.push(noise,gust);
  for(const source of this.sources)source.start();
 }
 setLevel(level:number){if(!this.disposed){const ctx=gameAudio.context!;this.gain.gain.setTargetAtTime(Math.max(0,Math.min(1,level)),ctx.currentTime,level>0?.35:.4);}}
 dispose(){if(this.disposed)return;this.disposed=true;for(const source of this.sources){try{source.stop();}catch{}}for(const node of this.nodes)node.disconnect();this.nodes=[];this.sources=[];}
 get diagnostics(){return {sources:this.sources.length,nodes:this.nodes.length,disposed:this.disposed};}
}
