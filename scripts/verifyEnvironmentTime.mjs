// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'environment-time-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5184','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9346',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try{
 await fetchReady('http://127.0.0.1:5184/tests/fixtures/environmentTime.html');
 const version=await (await fetchReady('http://127.0.0.1:9346/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'}),targets=await (await fetch('http://127.0.0.1:9346/json/list')).json();
 page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);const errors=[];
 page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 page.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(200);}throw new Error('Timed out: '+expression+' state='+JSON.stringify(await evaluate('window.envSample')));};

 await page.call('Emulation.setTimezoneOverride',{timezoneId:'Asia/Rangoon'});
 await page.call('Page.addScriptToEvaluateOnNewDocument',{source:`
  const NativeDate=Date,fixed=NativeDate.UTC(2026,9,27,0,0,0);
  window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
  const NativeAudio=window.AudioContext;
  if(NativeAudio)window.AudioContext=class extends NativeAudio{constructor(...args){super(...args);window.audioProbe=this;}};
 `});
 await page.call('Page.navigate',{url:'http://127.0.0.1:5184/tests/fixtures/environmentTime.html'});
 await until('window.envClock?.period==="morning" && !!window.envSample');
 assert.equal(await evaluate('window.envClock.mode'),'auto');
 assert.equal(await evaluate('window.envClock.minute'),390);
 assert.equal(await evaluate('!!window.audioProbe'),false,'Audio must not start before interaction');
 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:"nearest"})`);const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await page.call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
 const skyId=await evaluate('window.envSample.skyId');
 for(const period of ['morning','day','evening','night']){
  await click(`[data-period="${period}"]`);await until(`window.envClock.period==="${period}" && window.envClock.mode==="${period}"`);
  if(period==='day')await until('window.envSample.sun>2.55 && window.envSample.stars<.01');
  else if(period==='morning')await until('window.envSample.sun>1.95');
  else if(period==='evening')await until('window.envSample.lamps>.30 && window.envSample.sun<1.65');
  else await until('window.envSample.stars>.97 && window.envSample.sun<.73');
  assert.equal(await evaluate('window.envSample.skyId'),skyId,'Time changes must preserve scene objects');
  const shot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,period+'.png'),Buffer.from(shot.data,'base64'));
  console.log(period,await evaluate('window.envSample'));
 }
 await until('window.audioProbe?.state==="running"');
 await click('.environment-sound input');await until('window.audioProbe.state==="suspended"');
 await click('.environment-sound input');await until('window.audioProbe.state==="running"');
 await evaluate('window.envActive(false)');await until('window.audioProbe.state==="suspended"');
 await evaluate('window.envActive(true)');await until('window.audioProbe.state==="running"');
 const previousPage=await evaluate('performance.timeOrigin');
 await page.call('Emulation.setTimezoneOverride',{timezoneId:'America/Los_Angeles'});await page.call('Page.reload');
 await until(`performance.timeOrigin!==${previousPage} && window.envClock?.mode==="night" && !!window.envSample && !!document.querySelector('.environment-settings > .time-btn')`);
 await click('.environment-settings > .time-btn');await until('window.envClock.mode==="auto" && window.envClock.period==="evening"');
 assert.equal(await evaluate('window.envClock.minute'),1020);
 await page.call('Emulation.setTimezoneOverride',{timezoneId:'Asia/Tokyo'});
 await evaluate('window.dispatchEvent(new Event("focus"))');await until('window.envClock.period==="morning"');
 assert.equal(await evaluate('window.envClock.minute'),540);
 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await sleep(300);
 const mobile=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'mobile-settings.png'),Buffer.from(mobile.data,'base64'));
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await evaluate('window.envUnmount()');await until('window.audioProbe.state==="closed"');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,timezones:3,periods:4,persistence:true,audioLifecycle:true,artifacts}));
}finally{
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
 const profile=resolve(artifacts,'profile'),tempRoot=resolve(tmpdir())+sep;
 if(profile.startsWith(tempRoot)&&profile===resolve(artifacts)+sep+'profile'){
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
 }
}
