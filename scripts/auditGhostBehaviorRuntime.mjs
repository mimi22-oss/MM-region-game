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
 await call('Network.setBlockedURLs',{urls:['*.opus']});
 await call('Page.navigate',{url:'http://127.0.0.1:5199/tests/fixtures/ghostRuntimeAudit.html'});
 const readyEnd=Date.now()+180000;
 while(!await evaluate('window.__GHOST_NPC__?.count===3')){if(errors.length||Date.now()>readyEnd)throw Error('Runtime fixture not ready: '+JSON.stringify(errors));await sleep(200);}
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:40,y:10,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:40,y:10,button:'left',clickCount:1});
 const cases=[];let deathProof=null;
 for(const [id,distance] of [['ghost-1',22],['ghost-2',4.5],['ghost-3',10]]){
  await evaluate(`window.runtime.resetDeath();window.runtime.select('${id}')`);await sleep(1800);
  const start=await evaluate(`window.runtime.approach('${id}',${distance})`),trace=[],entered=Date.now(),end=entered+9000;
  while(Date.now()<end){const entry=await evaluate(`window.__GHOST_NPC__.getSnapshots().find(e=>e.ghostId==='${id}')`);trace.push({atMs:Date.now()-entered,...entry.snapshot});if(entry.snapshot.state==='GRABBING')break;await sleep(100);}
  const states=[...new Set(trace.map(s=>s.state))],moved=Math.max(...trace.map(s=>Math.hypot(s.x-start.start.x,s.z-start.start.z)));
  cases.push({id,approach:start,states,moved,grabbed:states.includes('GRABBING'),trace});
  if(id==='ghost-2'){
   const until=Date.now()+12000;while(!await evaluate("window.runtime.getDeath().phase==='dead'")){if(Date.now()>until)break;await sleep(100);}
   deathProof=await evaluate(`({state:window.runtime.getDeath(),overlay:!!document.querySelector('[aria-label="Game Over"]')})`);
  }
 }
 await evaluate('window.runtime.place(174.891,183.666)');await sleep(1300);
 await evaluate('window.runtime.pause(true)');await sleep(300);const beforePause=await evaluate(`window.__GHOST_NPC__.getSnapshot('ghost-3')`);await sleep(1000);const afterPause=await evaluate(`window.__GHOST_NPC__.getSnapshot('ghost-3')`);await evaluate('window.runtime.pause(false)');await sleep(3000);
 const safeHome=await evaluate(`window.__GHOST_NPC__.getSnapshot('ghost-3')`);
 const transitions=await evaluate('window.runtime.transitions');
 const metrics=await evaluate('window.runtime.frames'),audioFiles=requests.filter(u=>/\.(mp3|wav|ogg|opus|aac|flac|m4a)(?:[?#]|$)/i.test(u));
 await evaluate('window.runtime.mount(false)');await sleep(500);
 const registryReleased=await evaluate('!window.__GHOST_NPC__');
 const result={cases,deathProof,safeHome,transitions,audioBlocked:true,pausedUnchanged:JSON.stringify(beforePause)===JSON.stringify(afterPause),registryReleased,audioFiles,errors,frameSample:{frames:metrics.length,avgFps:1000/(metrics.reduce((s,f)=>s+f.ms,0)/metrics.length),maxCalls:Math.max(...metrics.map(f=>f.calls)),maxTriangles:Math.max(...metrics.map(f=>f.triangles)),maxTextures:Math.max(...metrics.map(f=>f.textures))},note:'Pinned source, real GhostNpc/GLB/mixer/AI, proxy nested player group, software WebGL. No full Player controller or physical Android.'};
 await writeFile(join(out,'behavior-runtime.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{ws?.close();chrome.kill();vite.kill();preview.kill();}
