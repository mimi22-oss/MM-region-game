// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'mobile-auto-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5183','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9345',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try{
 await fetchReady('http://127.0.0.1:5183/tests/fixtures/humanJump.html');
 const version=await (await fetchReady('http://127.0.0.1:9345/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'}),targets=await (await fetch('http://127.0.0.1:9345/json/list')).json();
 page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);const errors=[];
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 page.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(200);}throw new Error('Timed out: '+expression+' state='+JSON.stringify(await evaluate('window.jumpSample')));};

 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await page.call('Page.navigate',{url:'http://127.0.0.1:5183/tests/fixtures/humanJump.html'});
 await until('!!window.jumpSample && !!document.querySelector(".mobile-joystick-tick-up")');
 await sleep(800);
 const center=selector=>evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
 const startTouch=async(selector)=>{const p=await center(selector);await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...p,radiusX:2,radiusY:2,force:1}]});};
 const endTouch=()=>page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const press=async(selector,ms)=>{await startTouch(selector);await sleep(ms);await endTouch();await sleep(100);};
 // A short press remains manual. A long press latches and the actual Player keeps moving.
 await press('.mobile-joystick-tick-up',150);assert.equal(await evaluate('window.jumpInput.active'),false);
 await startTouch('.mobile-joystick-tick-up');await until('window.jumpInput.autoDirection==="up"');await endTouch();
 assert.equal(await evaluate('window.jumpInput.moveScale'),1);
 const a=await evaluate('window.jumpSample');await sleep(1000);const b=await evaluate('window.jumpSample');
 assert.ok(Math.hypot(b.x-a.x,b.z-a.z)>1,'Character continues walking after release');
 await press('.mobile-auto-stop',80);assert.equal(await evaluate('window.jumpInput.active'),false);
 const stopped=await evaluate('window.jumpSample');await sleep(500);const after=await evaluate('window.jumpSample');
 assert.ok(Math.hypot(after.x-stopped.x,after.z-stopped.z)<.05,'Stop button stops the character');
 // Freeze the isolated scene after checking movement, so long UI tests do not walk into unrelated world obstacles.
 await evaluate('window.jumpRenderLoop("never")');
 await startTouch('.mobile-joystick-tick-up');await until('window.jumpInput.autoDirection==="up"');await endTouch();
 await startTouch('.mobile-joystick-tick-up');await until('window.jumpInput.moveScale>=1.25');await endTouch();
 const speed=await evaluate('window.jumpInput.moveScale');await press('.mobile-joystick-tick-right',100);
 assert.equal(await evaluate('window.jumpInput.autoDirection'),'right');assert.equal(await evaluate('window.jumpInput.moveScale'),speed);
 await press('.mobile-joystick-tick-right',100);assert.equal(await evaluate('window.jumpInput.moveScale'),1);
 const mobile=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'mobile-auto-controls.png'),Buffer.from(mobile.data,'base64'));
 await press('.mobile-auto-stop',80);assert.equal(await evaluate('window.jumpInput.active'),false);
 // Browser interruption and disabled controls must clear a latched direction.
 await startTouch('.mobile-joystick-tick-left');await until('window.jumpInput.autoDirection==="left"');
 await page.call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await until('!window.jumpInput.active && !document.querySelector(".mobile-auto-stop")');
 await startTouch('.mobile-joystick-tick-down');await until('window.jumpInput.autoDirection==="down"');await endTouch();
 await evaluate('window.dispatchEvent(new Event("blur"))');await until('!window.jumpInput.active');
 await startTouch('.mobile-joystick-tick-up');await until('window.jumpInput.autoDirection==="up"');await endTouch();
 await evaluate('window.jumpPause(true)');await until('!window.jumpInput.active && !document.querySelector(".mobile-controls")');
 await evaluate('window.jumpPause(false)');await until('!!document.querySelector(".mobile-controls")');
 assert.equal(await evaluate('window.jumpInput.autoDirection'),null);
 // Direction buttons and the central stop remain distinct in landscape.
 await page.call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await sleep(300);
 await startTouch('.mobile-joystick-tick-left');await until('window.jumpInput.autoDirection==="left"');await endTouch();
 const hit=await evaluate('(()=>{const e=document.querySelector(".mobile-auto-stop"),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e})()');assert.equal(hit,true);
 const landscape=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'mobile-auto-landscape.png'),Buffer.from(landscape.data,'base64'));
 await press('.mobile-auto-stop',80);assert.equal(await evaluate('window.jumpInput.active'),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,continuedDistance:Math.hypot(b.x-a.x,b.z-a.z),portrait:true,landscape:true,artifacts}));
}finally{
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
 const profile=resolve(artifacts,'profile'),tempRoot=resolve(tmpdir())+sep;
 if(profile.startsWith(tempRoot)&&profile===resolve(artifacts)+sep+'profile'){
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 }
}
