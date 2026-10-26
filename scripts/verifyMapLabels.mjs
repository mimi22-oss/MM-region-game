// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'aerial-map-labels-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5177','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9339',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try {
 await fetchReady('http://127.0.0.1:5177/tests/fixtures/mapLabels.html');
 const version = await (await fetchReady('http://127.0.0.1:9339/json/version')).json();
 browser = await connect(version.webSocketDebuggerUrl);
 const {targetId} = await browser.call('Target.createTarget', {url:'about:blank'});
 const targets = await (await fetch('http://127.0.0.1:9339/json/list')).json();
 page = await connect(targets.find(target => target.id === targetId).webSocketDebuggerUrl);
 const errors = [];
 page.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text));
 await page.call('Runtime.enable'); await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride', {width:1400,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate = async expression => {
  const result = await page.call('Runtime.evaluate', {expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
 };
 const snapshot = () => evaluate(`Array.from(document.querySelectorAll('[data-map-label]')).filter(el => getComputedStyle(el).visibility === 'visible').map(el => { const r=el.getBoundingClientRect(); return {id:el.dataset.mapLabel,text:el.innerText,x:r.x,y:r.y,w:r.width,h:r.height}; })`);
 const check = labels => {
  assert.ok(labels.length > 0, 'Aerial names must be visible');
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++) {
   const a=labels[i],b=labels[j];
   assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y, `Overlapping names: ${a.text} / ${b.text}`);
  }
 };
 await page.call('Page.navigate', {url:'http://127.0.0.1:5177/tests/fixtures/mapLabels.html'});
 for(let attempt=0;attempt<80;attempt++) { if(await evaluate('!!window.mapLabelView && !!document.querySelector("canvas")')) break; await sleep(250); }
 await sleep(1800); await evaluate('document.fonts.ready.then(()=>true)'); await sleep(300);
 const overhead = await snapshot(); check(overhead);
 assert.ok(overhead.some(label=>label.id.startsWith('poi:custom-label')), 'Imported custom labels are visible overhead');
 const screenshot = await page.call('Page.captureScreenshot', {format:'png'});
 await writeFile(join(artifacts,'overhead.png'),Buffer.from(screenshot.data,'base64'));
 await evaluate('Object.assign(window.mapLabelView,{yaw:2.1,tilt:450})'); await sleep(500); check(await snapshot());
 await evaluate('Object.assign(window.mapLabelView,{x:2980,z:2970,height:240,tilt:0.001})'); await sleep(500);
 const village = await snapshot(); check(village);
 assert.ok(village.some(label=>label.id.startsWith('poi:natmyaung-')));
 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await sleep(500); const mobile = await snapshot(); check(mobile);
 assert.ok(mobile.every(label=>label.x>=0 && label.x+label.w<=390));
 await evaluate('Object.assign(window.mapLabelView,{height:5,tilt:20})'); await sleep(300);
 assert.equal((await snapshot()).length,0,'Walking view must hide aerial labels');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,overhead:overhead.length,village:village.length,mobile:mobile.length,artifacts}));
} finally {
 try { await browser?.call('Browser.close'); } catch {}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
}
