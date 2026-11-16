import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/ghost-mission-v2');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-runtime-audit-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5217','--strictPort'],{windowsHide:true,stdio:'ignore'});
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4217','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9377',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9377/json/list')).json();await fetch('http://127.0.0.1:5217');await fetch('http://127.0.0.1:4217');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 await call('Network.enable');const requests=[];const oldHandler=ws.onmessage;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);oldHandler(e);};
 await call('Network.setBlockedURLs',{urls:['*.opus']});
 await call('Page.navigate',{url:'http://127.0.0.1:5217/tests/fixtures/ghostMissionRuntime.html'});
 const readyEnd=Date.now()+180000;
 while(!await evaluate('window.__GHOST_NPC__?.count===3')){if(errors.length||Date.now()>readyEnd)throw Error('Runtime fixture not ready: '+JSON.stringify(errors));await sleep(200);}

 const results=[];
 await evaluate(`document.querySelector('button[aria-expanded=\"false\"]')?.click()`);
 for(const [id,d] of [['ghost-1',22],['ghost-2',4.5],['ghost-3',10]]){
  await evaluate(`window.missionRuntime.select('${id}')`);await sleep(500);
  await evaluate(`window.missionRuntime.approach('${id}',${d})`);await sleep(150);
  const before=await evaluate(`window.missionRuntime.inspect().find(g=>g.id==='${id}')`);
  await sleep(850);
  const after=await evaluate(`window.missionRuntime.inspect().find(g=>g.id==='${id}')`);
  assert.ok(Math.hypot(after.runtime.x-before.runtime.x,after.runtime.z-before.runtime.z)>.05,id+' moves');
  assert.ok(Math.hypot(after.runtime.x-after.root.x,after.runtime.z-after.root.z)<.001,id+' matches scene root');
  assert.equal(after.runtime.source,'entity');
  const text=await evaluate(`document.body.innerText`);assert.ok(text.includes('GHOST DEV MAP — LIVE'));assert.ok(text.includes('Ghost '+id.slice(-1)+': LIVE'));
  results.push({id,before,after});
 }
 const player=await evaluate(`window.missionRuntime.place(100,90);true`);await sleep(400);
 assert.ok((await evaluate('document.body.innerText')).includes('Player: X 100.00, Z 90.00'));
 await evaluate(`window.missionRuntime.pause(true)`);await sleep(350);
 const paused=await evaluate('window.missionRuntime.inspect()');assert.ok(paused.every(g=>g.runtime.active===false&&g.runtime.state==='PAUSED'));
 await evaluate(`window.missionRuntime.pause(false);window.missionRuntime.place(-500,-500);window.missionRuntime.hideRoot('ghost-1')`);await sleep(400);
 const hidden=await evaluate(`window.missionRuntime.inspect().find(g=>g.id==='ghost-1')`);
 assert.equal(hidden.runtime.source,'ai');assert.notEqual(hidden.runtime.x,999);
 await evaluate(`window.missionRuntime.select(null);['ghost-1','ghost-2','ghost-3'].forEach(window.missionRuntime.encounter);const f=window.missionRuntime.field;window.missionRuntime.place(f.x+50,f.z);`);await sleep(400);
 const modes=[];
 for(const mode of ['chase','search','return']){
  await evaluate(`for(const id of ['ghost-1','ghost-2','ghost-3']){const g=window.missionRuntime.guard(id),f=window.missionRuntime.field;g.initialized=true;g.x=f.x+30;g.z=f.z+5;g.mode='${mode}';g.timer=${mode==='return'?0:10};}`);await sleep(150);
  const before=await evaluate('window.missionRuntime.inspect()');await sleep(500);const after=await evaluate('window.missionRuntime.inspect()');
  for(let i=0;i<3;i++){assert.equal(after[i].runtime.state,mode);assert.ok(Math.hypot(after[i].runtime.x-after[i].root.x,after[i].runtime.z-after[i].root.z)<.001);const moved=Math.hypot(after[i].runtime.x-before[i].runtime.x,after[i].runtime.z-before[i].runtime.z);assert.ok(mode==='search'?moved<.001:moved>.05,mode+': '+after[i].id);}
  modes.push({mode,before,after});
 }
 const progress=await evaluate('window.missionRuntime.progress()');
 await evaluate('window.missionRuntime.mount(false)');await sleep(400);
 assert.ok((await evaluate('window.missionRuntime.inspect()')).every(g=>!g.runtime&&!g.root));
 assert.deepEqual(await evaluate('window.missionRuntime.progress()'),progress);
 assert.equal(errors.length,0,JSON.stringify(errors));
 const result={results,paused,hidden,modes,progress,registryReleased:true,errors,note:'Current production GhostNpc/GLB/AI and mission scene, nested player proxy, headless Chrome SwiftShader. Not physical Android.'};
 await writeFile(join(out,'runtime.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,ghosts:results.map(r=>r.id),modes:modes.map(m=>m.mode),registryReleased:true,errors}));
}finally{ws?.close();chrome.kill();vite.kill();preview.kill();}
