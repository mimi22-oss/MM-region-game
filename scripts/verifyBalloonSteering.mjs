// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'balloon-steering-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5186','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9348',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try{
 await fetchReady('http://127.0.0.1:5186/tests/fixtures/balloonRide.html');
 const version=await (await fetchReady('http://127.0.0.1:9348/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'}),targets=await (await fetch('http://127.0.0.1:9348/json/list')).json();
 page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);const errors=[];
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 page.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(200);}throw new Error('Timed out: '+expression+' state='+JSON.stringify(await evaluate('window.balloonSample')));};

 await page.call('Emulation.setDeviceMetricsOverride',{width:900,height:600,deviceScaleFactor:1,mobile:true});await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await page.call('Page.navigate',{url:'http://127.0.0.1:5186/tests/fixtures/balloonRide.html'});await until('window.balloonSample?.riding');
 const down=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...p,radiusX:2,radiusY:2,force:1}]});};
 const up=()=>page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await down('.balloon-btn-up');await until('window.balloonSample.y>12');await up();await sleep(1800);
 const origin=await evaluate('window.balloonSample');
 await down('.mobile-joystick-tick-up');await until('window.balloonMobileInput.autoDirection==="up"');await up();await sleep(1300);
 const forward=await evaluate('window.balloonSample');assert.ok(Math.hypot(forward.x-origin.x,forward.z-origin.z)>2);assert.ok(Math.abs(forward.y-origin.y)<.5,'Up tick must not ascend');
 assert.equal(await evaluate('window.balloonMobileInput.moveScale'),1);
 await down('.mobile-joystick-tick-up');await until('window.balloonMobileInput.moveScale>=1.25');await up();
 await down('.mobile-joystick-tick-down');await sleep(120);await up();assert.equal(await evaluate('window.balloonMobileInput.autoDirection'),'down');assert.ok(await evaluate('window.balloonMobileInput.moveScale>=1.25'));
 await sleep(1200);const backwardStart=await evaluate('window.balloonSample');await sleep(1200);const backward=await evaluate('window.balloonSample');
 assert.ok((backward.x-backwardStart.x)*(forward.x-origin.x)+(backward.z-backwardStart.z)*(forward.z-origin.z)<0,'Down tick reverses horizontal direction');assert.ok(Math.abs(backward.y-origin.y)<.5,'Down tick must not descend');
 await down('.mobile-joystick-tick-down');await sleep(120);await up();assert.equal(await evaluate('window.balloonMobileInput.moveScale'),1);
 await down('.mobile-auto-stop');await up();await until('!window.balloonMobileInput.active && !window.balloonSample.autoCruise');
 const beforeDown=await evaluate('window.balloonSample.y');await down('.balloon-btn-down');await until('window.balloonSample.y<'+(beforeDown-2));await up();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,horizontalUpDown:true,separateLift:true,autoSpeed:true}));
}finally{
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
 const profile=resolve(artifacts,'profile'),tempRoot=resolve(tmpdir())+sep;
 if(profile.startsWith(tempRoot)&&profile===resolve(artifacts)+sep+'profile'){
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 }
}
