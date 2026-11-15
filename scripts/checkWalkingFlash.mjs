import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/performance-audit/walking');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'walking-flash-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5197','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9357',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9357/json/list')).json();await fetch('http://127.0.0.1:5197');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 const dprResults=[];
 for(const fixed of [0,1]){
  await call('Page.navigate',{url:`http://127.0.0.1:5197/tests/fixtures/walkingFlash.html?dprOnly=1&fixed=${fixed}`});
  const end=Date.now()+60000;while(!await evaluate('!!window.flash?.getDpr')){if(Date.now()>end)throw Error('DPR fixture not ready');await sleep(200);}
  const values=[];
  for(let i=0;i<3;i++){
   await evaluate('window.flash.adapt(.85)');await sleep(200);values.push(await evaluate('window.flash.getDpr()'));
   await evaluate('window.flash.parentUpdate()');await sleep(200);values.push(await evaluate('window.flash.getDpr()'));
  }
  assert.deepEqual(values,fixed?[.85,.85,.85,.85,.85,.85]:[.85,1.25,.85,1.25,.85,1.25]);
  dprResults.push({fixed:!!fixed,values});
 }
 await writeFile(join(out,'dpr-regression.json'),JSON.stringify({passed:true,dprResults},null,2));
 console.log('DPR regression passed: '+JSON.stringify(dprResults));
 if(process.argv.includes('--dpr-only'))process.exitCode=0;
 else {
 await call('Page.navigate',{url:'http://127.0.0.1:5197/tests/fixtures/walkingFlash.html'});
 const deadline=Date.now()+180000;
 while(!await evaluate('window.flash && !window.flash.loading')){if(Date.now()>deadline||errors.length)throw Error('Fixture failed: '+JSON.stringify(errors));await sleep(300);}
 await evaluate('window.flash.record=true');
 for(let i=0;i<24;i++){
  const key=i%8<4?'KeyW':'KeyS',previous=i%8===4?'KeyW':i%8===0?'KeyS':null;
  if(previous)await call('Input.dispatchKeyEvent',{type:'keyUp',code:previous,key:previous==='KeyW'?'w':'s'});
  if(i%4===0)await call('Input.dispatchKeyEvent',{type:'keyDown',code:key,key:key==='KeyW'?'w':'s'});
  await sleep(500);const shot=await call('Page.captureScreenshot',{format:'png'});
  await writeFile(join(out,`frame-${String(i).padStart(2,'0')}.png`),Buffer.from(shot.data,'base64'));
 }
 for(const key of ['KeyW','KeyS'])await call('Input.dispatchKeyEvent',{type:'keyUp',code:key,key:key==='KeyW'?'w':'s'});
 const result=await evaluate('window.flash');result.errors=errors;
 await writeFile(join(out,'trace.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({frames:result.frames.length,lost:result.lost,restored:result.restored,dprs:[...new Set(result.frames.map(f=>f.dpr))],errors}));
 }
}finally{ws?.close();chrome.kill();vite.kill();}
