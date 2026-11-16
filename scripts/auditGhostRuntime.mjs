import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/ghost-audit');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-runtime-audit-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199','--strictPort'],{windowsHide:true,stdio:'ignore'});
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4199','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9360',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9360/json/list')).json();await fetch('http://127.0.0.1:5199');await fetch('http://127.0.0.1:4199');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 await call('Network.enable');const requests=[];const oldHandler=ws.onmessage;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);oldHandler(e);};
 await call('Page.navigate',{url:'http://127.0.0.1:5199/tests/fixtures/ghostRuntimeAudit.html'});
 const readyEnd=Date.now()+180000;
 while(!await evaluate('window.__GHOST_NPC__?.count===3')){if(errors.length||Date.now()>readyEnd)throw Error('Runtime fixture not ready: '+JSON.stringify(errors));await sleep(200);}
 const cases=[],renderScaling=[];
 await evaluate('window.runtime.vehicle=true;window.runtime.select(null);window.runtime.place(35.149,36.176)');
 for(const count of [1,3,10,50,100]){
  await evaluate(`window.runtime.count(${count});window.runtime.resetDeath()`);
  const deadline=Date.now()+90000;while(!await evaluate(`window.__GHOST_NPC__?.count===${count}`)){if(Date.now()>deadline)throw Error('Count not loaded '+count);await sleep(100);}
  await sleep(1800);await evaluate('window.runtime.frames=[];window.runtime.timing={}');await sleep(3500);
  const sample=await evaluate('({frames:window.runtime.frames,timing:window.runtime.timing,snapshots:window.__GHOST_NPC__.getSnapshots().map(e=>e.snapshot),heap:performance.memory?.usedJSHeapSize})');
  const f=sample.frames;renderScaling.push({count,active:sample.snapshots.filter(s=>s.state!=='DORMANT').length,visible:sample.snapshots.filter(s=>s.visible).length,frames:f.length,meanFrameMs:f.reduce((s,x)=>s+x.ms,0)/f.length,avgFps:1000/(f.reduce((s,x)=>s+x.ms,0)/f.length),maxCalls:Math.max(...f.map(x=>x.calls)),maxTriangles:Math.max(...f.map(x=>x.triangles)),maxTextures:Math.max(...f.map(x=>x.textures)),heapMiB:sample.heap/1048576,timing:sample.timing});
  console.log(JSON.stringify(renderScaling.at(-1)));
 }
 const beforePause=await evaluate(`window.__GHOST_NPC__.getSnapshot('ghost-3')`);await evaluate('window.runtime.pause(true)');await sleep(1000);const afterPause=await evaluate(`window.__GHOST_NPC__.getSnapshot('ghost-3')`);await evaluate('window.runtime.pause(false)');
 const metrics=await evaluate('window.runtime.frames'),audioFiles=requests.filter(u=>/\.(mp3|wav|ogg|opus|aac|flac|m4a)(?:[?#]|$)/i.test(u));
 await evaluate('window.runtime.mount(false)');await sleep(500);
 const registryReleased=await evaluate('!window.__GHOST_NPC__');
 const result={renderScaling,cases,pausedUnchanged:JSON.stringify(beforePause)===JSON.stringify(afterPause),registryReleased,audioFiles,errors,frameSample:{frames:metrics.length,avgFps:1000/(metrics.reduce((s,f)=>s+f.ms,0)/metrics.length),maxCalls:Math.max(...metrics.map(f=>f.calls)),maxTriangles:Math.max(...metrics.map(f=>f.triangles)),maxTextures:Math.max(...metrics.map(f=>f.textures))},note:'Pinned source, real GhostNpc/GLB/mixer/AI, proxy nested player group, software WebGL. No full Player controller or physical Android.'};
 await writeFile(join(out,'render-scaling.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();chrome.kill();vite.kill();preview.kill();}
