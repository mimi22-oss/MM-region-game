// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'map-tiles-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9350',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try{
 await fetchReady('http://127.0.0.1:5188/tests/fixtures/mapTiles.html');
 const version=await (await fetchReady('http://127.0.0.1:9350/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'}),targets=await (await fetch('http://127.0.0.1:9350/json/list')).json();
 page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);const errors=[];
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 page.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(200);}throw new Error('Timed out: '+expression+' state='+JSON.stringify(await evaluate('window.tileSample')));};

 const requests=[];await page.call('Network.enable');page.on('Network.requestWillBeSent',e=>{if(e.request.url.includes('/map/'))requests.push(e.request.url);});
 await page.call('Page.navigate',{url:'http://127.0.0.1:5188/tests/fixtures/mapTiles.html'});
 await until('window.tileSample?.instances===100');
 const loaded=await evaluate('window.tileSample');assert.equal(loaded.tiles,2);assert.ok(loaded.height>.05);
 await sleep(500);const shot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'fields-overhead.png'),Buffer.from(shot.data,'base64'));
 const initialRequests=requests.filter(u=>u.includes('/tiles/')).length;
 const originalView=await evaluate('window.tileView');await evaluate('window.tileView={x:0,z:0}');await until('window.tileSample.tiles===0');
 const absent=await evaluate('window.tileSample');assert.equal(absent.height,0);
 await evaluate('window.tileView='+JSON.stringify(originalView));await until('window.tileSample.instances===100');
 assert.equal(requests.filter(u=>u.includes('/tiles/')).length,initialRequests,'resident tiles are reused after return');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,loaded,absent,tileRequests:initialRequests,artifacts}));
}finally{
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
 const profile=resolve(artifacts,'profile'),tempRoot=resolve(tmpdir())+sep;
 if(profile.startsWith(tempRoot)&&profile===resolve(artifacts)+sep+'profile'){
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 }
}
