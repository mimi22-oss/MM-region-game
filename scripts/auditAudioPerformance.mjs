import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/ghost-audit');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-runtime-audit-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5200','--strictPort'],{windowsHide:true,stdio:'ignore'});
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4200','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9361',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9361/json/list')).json();await fetch('http://127.0.0.1:5200');await fetch('http://127.0.0.1:4200');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 await call('Performance.enable');await call('HeapProfiler.enable');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
 const a=window.audioAudit={contexts:0,allocated:0,connected:0,started:0,peakStarted:0,decode:[],longTasks:[]};
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())a.longTasks.push(e.duration);}).observe({entryTypes:['longtask']});}catch{}
 const seen=new WeakMap(),connect=AudioNode.prototype.connect,disconnect=AudioNode.prototype.disconnect;
 AudioNode.prototype.connect=function(...args){if(!seen.get(this)){seen.set(this,true);a.connected++;}return connect.apply(this,args);};
 AudioNode.prototype.disconnect=function(...args){if(seen.get(this)){seen.set(this,false);a.connected--;}return disconnect.apply(this,args);};
 const Native=window.AudioContext;
 window.AudioContext=new Proxy(Native,{construct(Target,args){const ctx=Reflect.construct(Target,args);a.contexts++;
  for(const method of ['createGain','createOscillator','createBufferSource','createBiquadFilter','createPanner','createStereoPanner','createWaveShaper','createDynamicsCompressor']){const original=ctx[method];ctx[method]=function(...args){a.allocated++;const n=original.apply(ctx,args);if(n.start){const start=n.start;n.start=function(...args){a.started++;a.peakStarted=Math.max(a.peakStarted,a.started);n.addEventListener('ended',()=>a.started--,{once:true});return start.apply(n,args);};}return n;};}
  const decode=ctx.decodeAudioData;ctx.decodeAudioData=function(bytes){const t=performance.now(),length=bytes.byteLength;return decode.call(ctx,bytes).then(b=>{a.decode.push({ms:performance.now()-t,bytes:length,length:b.length,channels:b.numberOfChannels,sampleRate:b.sampleRate});return b;});};
  return ctx;}});
})()`});
 await call('Page.navigate',{url:'http://127.0.0.1:5200/tests/fixtures/audioPerformanceAudit.html'});
 const end=Date.now()+90000;while(!await evaluate('window.zone?.ready')){if(errors.length||Date.now()>end)throw Error(JSON.stringify(errors));await sleep(100);}
 await evaluate('window.zone.distance(500)');
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:40,y:10,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:40,y:10,button:'left',clickCount:1});
 await sleep(500);
 const inspect=()=>evaluate(`({stats:window.zone.stats,diag:window.zone.mixer.inspect(),loader:window.zone.loader.getDiagnostics(),counts:{...window.audioAudit},decodedBytes:[...window.zone.loader.decodedBuffers.values()].reduce((s,b)=>s+b.length*b.numberOfChannels*4,0),loopBytes:[...window.zone.loader.loopBuffers.values()].reduce((s,v)=>s+v.buffer.length*v.buffer.numberOfChannels*4,0),requests:performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/audio/horror/')).map(e=>({url:e.name,bytes:e.encodedBodySize,durationMs:e.duration})),heap:performance.memory?.usedJSHeapSize})`);
 const metrics=async()=>Object.fromEntries((await call('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const sample=async label=>{const before=await metrics();await evaluate('window.audioAudit.frameMs=[];let last=performance.now();window.audioAudit.record=true;(function f(t){if(!window.audioAudit.record)return;window.audioAudit.frameMs.push(t-last);last=t;requestAnimationFrame(f);})(last)');await sleep(3500);await evaluate('window.audioAudit.record=false');const frames=await evaluate('window.audioAudit.frameMs'),after=await metrics();return {label,frames:frames.length,meanFrameMs:frames.reduce((s,v)=>s+v,0)/frames.length,scriptMs:(after.ScriptDuration-before.ScriptDuration)*1000,taskMs:(after.TaskDuration-before.TaskDuration)*1000,jsHeapMiB:after.JSHeapUsedSize/1048576,inspect:await inspect()};};
 const baseline=await sample('normal-ambience-only-outside-zone');
 const entered=Date.now();await evaluate('window.zone.distance(50)');while(!await evaluate('(window.zone.stats?.sources??0)>0')){if(Date.now()-entered>10000)throw Error('Bed did not activate');await sleep(50);}const activationMs=Date.now()-entered;
 const first=await sample('normal-plus-warehouse');
 const loadStart=Date.now();await evaluate('(async()=>{const m=await window.zone.loader.loadManifest();for(const a of m.assets)await window.zone.loader.loadBuffer(a.id);})()');const allLoadMs=Date.now()-loadStart;
 const loaded=await inspect();const cycles=[];
 for(let i=0;i<3;i++){await evaluate('window.zone.distance(500)');await sleep(2600);await call('HeapProfiler.collectGarbage');cycles.push({mode:'exit',i,data:await inspect()});await evaluate('window.zone.distance(50)');await sleep(800);cycles.push({mode:'entry',i,data:await inspect()});}
 const burst=await evaluate(`(()=>{const modes=[];for(let i=0;i<50;i++)modes.push(window.zone.mixer.playCue({assetId:'spectral-shriek',fallbackPreset:'ghost_scream',owner:'audit-burst',position:{x:35,y:1,z:36},volume:.1}));return {modes,opus:window.zone.mixer.voices.size,procedural:window.zone.synth.diagnostics.voices,all:window.zone.mixer.activeVoiceCount()};})()`);
 await evaluate("window.zone.mixer.stopOwner('audit-burst');window.zone.distance(500)");await sleep(2600);
 const final=await inspect();
 const result={activationMs,allLoadMs,baseline,first,loaded,cycles,burst,final,errors,note:'Pinned sources, real Chromium Web Audio graph and Opus decode. Node connection/source counts are instrumentation approximations; JS heap excludes native AudioBuffer/DSP/GPU allocations. No human listening/physical Android. Long tasks are whole-page, not isolated audio GC.'};await writeFile(join(out,'audio-performance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({activationMs,allLoadMs,baselineMs:baseline.meanFrameMs,warehouseMs:first.meanFrameMs,decodedBytes:loaded.decodedBytes,loopBytes:loaded.loopBytes,contexts:final.counts.contexts,decodeCalls:final.counts.decode.length,burst,errors}));
}finally{ws?.close();chrome.kill();vite.kill();preview.kill();}
