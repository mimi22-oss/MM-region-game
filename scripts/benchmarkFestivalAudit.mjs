// Paired component benchmark. A Git-index src snapshot must exist at artifacts/performance-audit/before/src.
// Isolated Chrome software renderer: these numbers are NOT physical device FPS.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=resolve('artifacts/performance-audit');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'festival-audit-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5192','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-background-timer-throttling','--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9348',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
async function ready(url){for(let i=0;i<100;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(200);}throw Error(`Unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),events=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else events.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>events.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error(method+' timed out'));},45000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
let browser,page;const results=[],errors=[];
try{
 await ready('http://127.0.0.1:5192/tests/fixtures/festivalAudit.html');
 browser=await connect((await (await ready('http://127.0.0.1:9348/json/version')).json()).webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'});
 const targets=await(await fetch('http://127.0.0.1:9348/json/list')).json();page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);
 await page.call('Runtime.enable');await page.call('Page.enable');await page.call('Performance.enable');
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const metrics=async()=>Object.fromEntries((await page.call('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const cases=[{festival:0,characters:0},{festival:1,characters:0},{festival:1,characters:1},{festival:1,characters:1,mode:'ride'},{festival:1,characters:4},{festival:0,characters:4},{festival:1,characters:1,quality:'mobile'}];
 for(const config of cases)for(const version of ['before','after']){
  const mobile=config.quality==='mobile';
  await page.call('Emulation.setDeviceMetricsOverride',{width:mobile?390:960,height:mobile?844:640,deviceScaleFactor:1,mobile});
  const params=new URLSearchParams({...config,version,quality:config.quality??'medium'});
  await page.call('Page.navigate',{url:`http://127.0.0.1:5192/tests/fixtures/festivalAudit.html?${params}`});
  await page.call('Page.bringToFront');
  const deadline=Date.now()+120000;
  while(!await evaluate('window.audit?.ready')){assert.deepEqual(errors,[]);if(Date.now()>deadline)throw Error('Fixture readiness timeout');await sleep(200);}
  await sleep(1800);await evaluate('window.audit.start()');const m0=await metrics();await sleep(5500);const m1=await metrics();
  const sample=await evaluate('window.audit.stop()'),frames=sample.frames,ms=frames.map(f=>f.ms),mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  assert.ok(frames.length>3,'benchmark needs frame samples');
  const sorted=[...ms].sort((a,b)=>b-a),slow=sorted.slice(0,Math.max(1,Math.ceil(ms.length*.01)));
  const row={version,...config,quality:config.quality??'medium',renderer:sample.renderer,frames:frames.length,avgFps:1000/mean(ms),low1Fps:1000/mean(slow),frameMs:mean(ms),calls:mean(frames.map(f=>f.calls)),triangles:mean(frames.map(f=>f.triangles)),textures:frames.at(-1).textures,geometries:frames.at(-1).geometries,cameraMs:mean(frames.map(f=>f.cameraMs)),scriptMs:(m1.ScriptDuration-m0.ScriptDuration)*1000,taskMs:(m1.TaskDuration-m0.TaskDuration)*1000,heapMiB:m1.JSHeapUsedSize/1048576,reactCommits:sample.renders,farUploads:frames.at(-1).farVersion-frames[0].farVersion,farCount:frames.at(-1).farCount};
  results.push(row);console.log(JSON.stringify(row));await writeFile(join(out,'benchmark.json'),JSON.stringify({date:new Date().toISOString(),note:'Paired component fixture, software WebGL, synthetic 500 candle candidates, no full village geometry; not device FPS.',results,errors},null,2));
 }
 assert.deepEqual(errors,[]);
}finally{try{await browser?.call('Browser.close');}catch{}page?.ws.close();browser?.ws.close();chrome.kill();vite.kill();}
