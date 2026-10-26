// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'balloon-ride-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5182','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9344',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try{
 await fetchReady('http://127.0.0.1:5182/tests/fixtures/balloonRide.html');
 const version=await (await fetchReady('http://127.0.0.1:9344/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'}),targets=await (await fetch('http://127.0.0.1:9344/json/list')).json();
 page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);const errors=[];
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 page.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(200);}throw new Error('Timed out: '+expression+' state='+JSON.stringify(await evaluate('window.balloonSample')));};

 await page.call('Page.navigate',{url:'http://127.0.0.1:5182/tests/fixtures/balloonRide.html'});await until('window.balloonSample?.riding');
 const key=async(code,down=true)=>page.call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code==='Space'?' ':code,windowsVirtualKeyCode:({ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Space:32,KeyE:69,KeyV:86,KeyT:84})[code]??0});
 const start=await evaluate('window.balloonSample');assert.ok(Math.abs(start.avatar[1]-start.y-.26)<.01);assert.equal(start.visible,true);
 console.log('Boarding passed');
 await key('ArrowUp');await until('window.balloonSample.y>7');await key('ArrowUp',false);await key('Space');await sleep(1200);await key('Space',false);
 await key('KeyE');await key('KeyE',false);assert.equal(await evaluate('window.balloonSample.riding'),true,'Cannot exit in the air');
 const airborne=await evaluate('window.balloonSample');await key('ArrowRight');await until('Math.hypot(window.balloonSample.x-'+start.x+',window.balloonSample.z-('+start.z+'))>2');await key('ArrowRight',false);await key('Space');await sleep(1500);await key('Space',false);
 await key('KeyV');await key('KeyV',false);await until('window.balloonSample.visible===false');await key('KeyV');await key('KeyV',false);await until('window.balloonSample.visible===true');
 const shot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'balloon-passenger-flight.png'),Buffer.from(shot.data,'base64'));
 await key('KeyT');await key('KeyT',false);await sleep(400);const top=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'balloon-top-view.png'),Buffer.from(top.data,'base64'));await key('KeyT');await key('KeyT',false);
 await evaluate('window.balloonPause(true)');await until('window.balloonSample.paused===true');const paused=await evaluate('window.balloonSample');await sleep(300);const afterPause=await evaluate('window.balloonSample');for(const field of ['x','y','z','vx','vy','vz','riding'])assert.equal(afterPause[field],paused[field]);await evaluate('window.balloonPause(false)');await until('window.balloonSample.paused===false');
 await page.call('Emulation.setDeviceMetricsOverride',{width:900,height:600,deviceScaleFactor:1,mobile:true});await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await sleep(300);
 await evaluate('Array.from(document.querySelectorAll(".balloon-controls button")).find(b=>b.textContent.includes("Joystick")).click()');
 assert.equal(await evaluate('window.balloonSample.vertical'),true);
 await evaluate('Array.from(document.querySelectorAll(".balloon-controls button")).find(b=>b.textContent.includes("အတွင်း/အပြင်")).click()');await until('window.balloonSample.visible===false');
 await evaluate('Array.from(document.querySelectorAll(".balloon-controls button")).find(b=>b.textContent.includes("အတွင်း/အပြင်")).click()');await until('window.balloonSample.visible===true');
 const before=await evaluate('window.balloonSample.y'),box=await evaluate('(()=>{const b=document.querySelector(".mobile-joystick-ring").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2+27}})()');
 await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...box,radiusX:2,radiusY:2,force:1}]});await until('window.balloonSample.y<'+(before-1));await page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const mobile=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'balloon-mobile-controls.png'),Buffer.from(mobile.data,'base64'));
 await key('ArrowDown');await until('window.balloonSample.grounded');await key('ArrowDown',false);await key('Space');await sleep(800);await key('Space',false);await key('KeyE');await key('KeyE',false);await until('window.balloonSample.riding===false');
 const exit=await evaluate('window.balloonSample');assert.ok(Math.hypot(exit.avatar[0]-exit.x,exit.avatar[2]-exit.z)>2.8);await sleep(1000);assert.equal(await evaluate('window.balloonSample.riding'),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,takeoffHeight:airborne.y,mobile:true,landing:true,artifacts}));

}finally{
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
 const profile=resolve(artifacts,'profile'),tempRoot=resolve(tmpdir())+sep;
 if(profile.startsWith(tempRoot)&&profile===resolve(artifacts)+sep+'profile'){
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 }
}
