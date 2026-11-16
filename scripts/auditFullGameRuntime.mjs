import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/ghost-audit');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-runtime-audit-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5201','--strictPort'],{windowsHide:true,stdio:'ignore'});
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4201','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9362',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9362/json/list')).json();await fetch('http://127.0.0.1:5201');await fetch('http://127.0.0.1:4201');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('mm-town-intro-settings-v2',JSON.stringify({mode:'off',durationSec:7,respectReducedMotion:true,hasCompletedFirstEntry:true}));localStorage.setItem('mm-town-environment-v1',JSON.stringify({mode:'night',sound:true,volume:.3}));localStorage.setItem('mm-region-game-save-v1',JSON.stringify({version:1,x:35.149,z:36.176,yaw:0,pitch:-.1,zoom:6,topDown:false,first:false,savedAt:new Date().toISOString()}));`});
 await call('Page.navigate',{url:'http://127.0.0.1:5201/?ghost=debug&quality=mobile'});
 const end=Date.now()+120000,trace=[];
 while(Date.now()<end){await sleep(1000);const sample=await evaluate(`({body:document.body.innerText.slice(0,600),ghosts:window.__GHOST_NPC__?.getSnapshots(),startup:window.__STARTUP_DIAGNOSTICS__?.getStartupSummary()})`);trace.push(sample);if((sample.ghosts?.length??0)>0){await sleep(8000);break;}if(errors.length)break;}
 // Valid user gesture unlocks the already-created game audio graph without changing game flags.
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:5,y:5,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:5,y:5,button:'left',clickCount:1});await sleep(3000);
 const extra=await evaluate(`(async()=>({zones:(await import('/src/game/ghostConfig.ts')).getActiveGhostZones(),perf:(await import('/src/game/perfMetrics.ts')).getPerfSnapshot(),audio:(await import('/src/game/audio/horrorAudioDiagnostics.ts')).getAudioDiagnosticsSnapshot()}))()`);
 const final=await evaluate(`({body:document.body.innerText.slice(0,2500),ghosts:window.__GHOST_NPC__?.getSnapshots(),startup:window.__STARTUP_DIAGNOSTICS__?.getStartupSummary(),gameOver:!!document.querySelector('[aria-label="Game Over"]')})`);
 await writeFile(join(out,'full-game-probe.json'),JSON.stringify({final,extra,trace,errors,note:'Actual main.tsx/Player/Town application, fresh profile, saved warehouse start, manual night, intro off, mobile quality on desktop SwiftShader. No key/mouse chase intervention; real Android and audible output not verified.'},null,2));console.log(JSON.stringify({ghosts:final.ghosts,gameOver:final.gameOver,errors,startup:final.startup}));
}finally{ws?.close();chrome.kill();vite.kill();preview.kill();}
