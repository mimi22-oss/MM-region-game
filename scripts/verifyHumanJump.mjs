// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'human-jump-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5181','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9343',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try{
 await fetchReady('http://127.0.0.1:5181/tests/fixtures/humanJump.html');
 const version=await (await fetchReady('http://127.0.0.1:9343/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'}),targets=await (await fetch('http://127.0.0.1:9343/json/list')).json();
 page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);const errors=[];
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 page.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(200);}throw new Error('Timed out: '+expression+' state='+JSON.stringify(await evaluate('({sample:window.jumpSample,peak:window.jumpPeak,input:window.jumpInput})')));};
 await page.call('Page.navigate',{url:'http://127.0.0.1:5181/tests/fixtures/humanJump.html'});await until('!!window.jumpSample');await sleep(600);
 const key=async(code,down=true,repeat=false)=>page.call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code==='Space'?' ':code==='ShiftLeft'?'Shift':code.slice(-1).toLowerCase(),windowsVirtualKeyCode:code==='Space'?32:code==='ShiftLeft'?16:code.charCodeAt(code.length-1),autoRepeat:repeat});
 const baseline=await evaluate('window.jumpSample');
 await key('Space');await until('window.jumpPeak>.7');await key('Space',true,true);await until('window.jumpSample.y<.04');await key('Space',false);
 let landed=await evaluate('window.jumpSample');assert.ok(Math.abs(landed.y-baseline.y)<.03);assert.ok(Math.hypot(landed.x-baseline.x,landed.z-baseline.z)<.03);
 assert.ok(await evaluate('window.jumpMaxKnee>1'),'Both knees must load before take-off');
 const standingPeak=await evaluate('window.jumpPeak');console.log('Standing jump passed',standingPeak);
 await evaluate('window.jumpReset()');await sleep(200);await key('KeyW');await key('ShiftLeft');await until('window.jumpSample.z<'+(baseline.z-5));await key('Space');await key('Space',false);await key('KeyW',false);await key('ShiftLeft',false);
 await until('window.jumpPeak>2.5');assert.ok(Math.abs(await evaluate('window.jumpKnee'))<.01,'Legs straighten in flight');await until('window.jumpSample.y<.04');landed=await evaluate('window.jumpSample');assert.ok(Math.abs(landed.y-baseline.y)<.03);assert.ok(Math.hypot(landed.x-baseline.x,landed.z-baseline.z)>10);
 const runningPeak=await evaluate('window.jumpPeak');console.log('Running jump passed',runningPeak);
 // Real closed blue gate: run up, then cross it while the feet are above the panels.
 await evaluate('window.jumpReset(true)');await sleep(250);await key('KeyW');await key('ShiftLeft');await until('Math.hypot(window.jumpSample.x-window.jumpGate.x,window.jumpSample.z-window.jumpGate.z)<6');console.log('Gate takeoff',await evaluate('window.jumpSample'));await key('Space');await key('Space',false);await key('KeyW',false);await key('ShiftLeft',false);await until('window.jumpPeak>2.4');
 const shot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'running-jump.png'),Buffer.from(shot.data,'base64'));await until('window.jumpSample.y<.04');
 const gateCrossing=await evaluate('(()=>{const p=window.jumpSample,g=window.jumpGate;return (p.x-g.x)*Math.sin(g.rotation)+(p.z-g.z)*Math.cos(g.rotation)})()');assert.ok(gateCrossing<-.5,'Must land beyond the closed blue gate: '+gateCrossing);
 // Paused airborne state is stable; switching character safely cancels the jump.
 await evaluate('window.jumpReset()');await sleep(250);await key('Space');await key('Space',false);await sleep(180);await evaluate('window.jumpPause(true)');await sleep(150);const paused=await evaluate('window.jumpSample');await sleep(250);assert.deepEqual(await evaluate('window.jumpSample'),paused);await evaluate('window.jumpPause(false)');await until('window.jumpSample.y<.04');
 await page.call('Emulation.setDeviceMetricsOverride',{width:900,height:600,deviceScaleFactor:1,mobile:true});await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await evaluate('window.jumpReset()');await sleep(300);
 const boxes=await evaluate(`(()=>{const rect=c=>{const b=document.querySelector(c).getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,top:b.top,bottom:b.bottom,width:b.width};};return {jump:rect('.mobile-jump-btn'),sprint:rect('.mobile-sprint-btn:not(.mobile-jump-btn)'),joystick:rect('.mobile-joystick-ring')}})()`);
 assert.ok(boxes.jump.width>40&&boxes.jump.bottom<boxes.sprint.top);
 const touchPoint=(id,b)=>({id,x:b.x,y:b.y,radiusX:2,radiusY:2,force:1});
 const joystick=touchPoint(1,{x:boxes.joystick.x,y:boxes.joystick.y-25}),sprint=touchPoint(2,boxes.sprint),jump=touchPoint(3,boxes.jump);
 await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[joystick]});await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[joystick,sprint]});await until('window.jumpSample.z<'+(baseline.z-5));
 await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[joystick,sprint,jump]});await until('window.jumpSample.y>.1');await page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[joystick,sprint]});await page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until('window.jumpPeak>2.3');
 const mobileShot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'mobile-jump.png'),Buffer.from(mobileShot.data,'base64'));await until('window.jumpSample.y<.04');
 await evaluate('window.jumpCharacter("robot")');await sleep(200);assert.equal(await evaluate('!!document.querySelector(".mobile-jump-btn")'),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,standingPeak,runningPeak,gateCrossing,mobile:true,artifacts}));
}finally{
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
}
