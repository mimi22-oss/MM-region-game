// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'balloon-yellow-light-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9341',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try{
 await fetchReady('http://127.0.0.1:5179/tests/fixtures/balloonLight.html');
 const version=await (await fetchReady('http://127.0.0.1:9341/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'}),targets=await (await fetch('http://127.0.0.1:9341/json/list')).json();
 page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);const errors=[];
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 page.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(200);}throw new Error('Timed out: '+expression);};
 await page.call('Page.navigate',{url:'http://127.0.0.1:5179/tests/fixtures/candleAngles.html'});await until('!!window.candleAnglesResult');
 assert.equal((await evaluate('window.candleAnglesResult')).passed,true,'Candle flames remain visible from all directions');
 await page.call('Page.navigate',{url:'http://127.0.0.1:5179/tests/fixtures/balloonLight.html'});await until('!!window.balloonLightResult');await sleep(1000);
 const result=await evaluate('window.balloonLightResult');assert.ok(result.finite);assert.equal(result.lights,1);assert.equal(result.flames,result.glows);assert.ok(result.flames>0);
 for(const [name,position,target] of [['balloon-front',[7,3.2,9],[0,2.1,0]],['balloon-flame-close',[.2,.8,2],[-1,.55,0]],['balloon-side',[-4,1.2,-2],[-1,.55,0]]]){
  await evaluate('Object.assign(window.balloonLightView,'+JSON.stringify({position,target})+')');await sleep(400);
  const shot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,...result,artifacts}));
}finally{
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
}
