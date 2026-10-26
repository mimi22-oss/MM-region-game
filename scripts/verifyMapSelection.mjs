// Isolated local Chrome profile and Vite server; never touches the user's browser/profile.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const artifacts=await mkdtemp(join(tmpdir(),'map-selection-'));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Chrome or Edge is required');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5178','--strictPort'],{cwd:resolve('.'),windowsHide:true,stdio:'ignore'});
const browserProcess=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9340',`--user-data-dir=${join(artifacts,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let page,browser;
async function fetchReady(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(250);}throw new Error(`Local server unavailable: ${url}`);}
async function connect(url){
 const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),listeners=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else listeners.get(m.method)?.(m.params);};
 return {ws,on:(event,fn)=>listeners.set(event,fn),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(new Error(method+' timed out'));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));})};
}
try {
 await fetchReady('http://127.0.0.1:5178/tests/fixtures/mapSelection.html');
 const version=await (await fetchReady('http://127.0.0.1:9340/json/version')).json();browser=await connect(version.webSocketDebuggerUrl);
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank'});
 const targets=await (await fetch('http://127.0.0.1:9340/json/list')).json();page=await connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);
 const errors=[];page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text));
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(expression))return;await sleep(150);}throw new Error('Timed out: '+expression);};
 const button=async text=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(text)})).click()`);
 const bounds=()=>evaluate(`(()=>{const r=document.querySelector('.map-selection-canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
 const mouse=async(type,x,y)=>page.call('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
 const click=async(x,y)=>{await mouse('mousePressed',x,y);await mouse('mouseReleased',x,y);await sleep(40);};
 const exported=()=>evaluate(`JSON.parse(document.querySelector('textarea[aria-label="နယ်မြေ GeoJSON"]').value)`);
 await page.call('Page.navigate',{url:'http://127.0.0.1:5178/tests/fixtures/mapSelection.html'});await until('!!document.querySelector("#open")');await evaluate('document.querySelector("#open").click()');await until('!!document.querySelector("dialog[open]")');await sleep(500);
 const rect=await bounds(),cx=rect.x+rect.w*.5,cy=rect.y+rect.h*.5,r=Math.min(rect.w,rect.h)*.24;
 await mouse('mousePressed',cx+r,cy);
 for(let i=1;i<=32;i++){const a=i*Math.PI*2/32;await mouse('mouseMoved',cx+Math.cos(a)*r,cy+Math.sin(a)*r);}
 await mouse('mouseReleased',cx+r,cy);await sleep(300);
 const area=await exported();assert.equal(area.features[0].geometry.type,'Polygon');assert.ok(area.features[0].properties.scene_area_m2>100);
 await button('နေရာမှတ်ထည့်');await click(cx,cy);const withPin=await exported();assert.equal(withPin.features.length,2);
 await click(rect.x+15,rect.y+15);assert.equal((await exported()).features.length,2,'Outside pins must be rejected');
 await button('မြေပုံရွှေ့');await mouse('mousePressed',cx,cy);await mouse('mouseMoved',cx+65,cy+40);await mouse('mouseReleased',cx+65,cy+40);await sleep(200);
 assert.deepEqual((await exported()).features[0].properties.scene_boundary_xz,area.features[0].properties.scene_boundary_xz,'Panning cannot move the selected world polygon');
 await button('GeoJSON ကူးယူ');await sleep(200);
 const downloadEvents=[];await browser.call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:artifacts,eventsEnabled:true});browser.on('Browser.downloadWillBegin',e=>downloadEvents.push(e));
 await button('.geojson');await sleep(600);assert.ok(downloadEvents.some(e=>e.suggestedFilename==='map-area-request.geojson'));
 const screenshot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'selection-desktop.png'),Buffer.from(screenshot.data,'base64'));
 await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await until('!document.querySelector("dialog")');
 await evaluate('document.querySelector("#open").click()');await until('!!document.querySelector("dialog[open]")');assert.equal((await exported()).features.length,2,'Draft persists after close/reopen');
 await page.call('Page.reload');await until('!!document.querySelector("#open")');await evaluate('document.querySelector("#open").click()');await until('!!document.querySelector("dialog[open]")');assert.equal((await exported()).features.length,2,'Draft persists after reload');
 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await page.call('Emulation.setTouchEmulationEnabled',{enabled:true});await sleep(400);
 await button('အသစ်ဝိုက်');await button('ထောင့်မှတ်ရွေး');const mobile=await bounds();
 for(const [u,v] of [[.25,.25],[.75,.25],[.75,.75],[.25,.75]]){
  const x=mobile.x+mobile.w*u,y=mobile.y+mobile.h*v;
  await page.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await page.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);
 }
 const touch=await exported();assert.equal(touch.features[0].geometry.coordinates[0].length,5,'Touch taps produce four polygon vertices');
 const mobileShot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'selection-mobile.png'),Buffer.from(mobileShot.data,'base64'));
 assert.equal(await evaluate('document.querySelector("dialog").scrollWidth > document.querySelector("dialog").clientWidth'),false);
 await page.call('Emulation.setTouchEmulationEnabled',{enabled:false});
 await page.call('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});await sleep(300);
 const kind=async value=>{await evaluate(`(()=>{const el=document.querySelector('select[aria-label="ဆွဲမည့်အရာ"]');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(80);};
 await kind('river');await button('အသစ်ဆွဲ');await button('လမ်းကြောင်းမှတ်ရွေး');
 let waterRect=await bounds();
 for(const [u,v] of [[.2,.35],[.5,.55],[.8,.3]])await click(waterRect.x+waterRect.w*u,waterRect.y+waterRect.h*v);
 await evaluate(`(()=>{const el=document.querySelector('input[aria-label="ရေလမ်းအကျယ် မီတာ"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'7.5');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(150);
 let water=await exported();assert.equal(water.features[0].geometry.type,'LineString');assert.equal(water.features[0].geometry.coordinates.length,3);assert.equal(water.features[0].properties.scene_width_m,7.5);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='နေရာမှတ်ထည့်').disabled`),true);
 await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedSelection=text;}}})`);
 await button('Geolocation ကူးယူ');assert.ok((await evaluate('window.copiedSelection')).includes('3. Lat:'));
 await button('Gemini / AI');const brief=await evaluate('window.copiedSelection');assert.ok(brief.includes('"scene_width_m": 7.5'));assert.ok(brief.includes('"LineString"'));
 await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard denied for regression test')}}})`);
 await button('Gemini / AI');await sleep(150);
 assert.equal(await evaluate(`document.querySelector('textarea[aria-label="ကူးယူရန် တည်နေရာနှင့် AI ညွှန်ကြားချက်"]').value`),brief);
 await page.call('Page.reload');await until('!!document.querySelector("#open")');await evaluate('document.querySelector("#open").click()');await until('!!document.querySelector("dialog[open]")');
 water=await exported();assert.equal(water.features[0].properties.scene_width_m,7.5);assert.equal(water.features[0].geometry.type,'LineString');
 await button('အသစ်ဆွဲ');await button('လက်ဖြင့်မျဉ်း');waterRect=await bounds();
 await mouse('mousePressed',waterRect.x+waterRect.w*.2,waterRect.y+waterRect.h*.5);
 for(let i=1;i<=16;i++)await mouse('mouseMoved',waterRect.x+waterRect.w*(.2+i*.6/16),waterRect.y+waterRect.h*(.5+Math.sin(i*.4)*.15));
 await mouse('mouseReleased',waterRect.x+waterRect.w*.8,waterRect.y+waterRect.h*(.5+Math.sin(16*.4)*.15));await sleep(150);
 water=await exported();assert.equal(water.features[0].geometry.type,'LineString');assert.notDeepEqual(water.features[0].geometry.coordinates[0],water.features[0].geometry.coordinates.at(-1));
 const waterShot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'selection-waterway.png'),Buffer.from(waterShot.data,'base64'));
 for(const value of ['stream','canal','drain']){await kind(value);assert.equal((await exported()).features[0].properties.waterway,value);}
 await kind('lake');await button('အသစ်ဝိုက်');await button('ထောင့်မှတ်ရွေး');waterRect=await bounds();
 for(const [u,v] of [[.3,.3],[.7,.3],[.7,.7],[.3,.7]])await click(waterRect.x+waterRect.w*u,waterRect.y+waterRect.h*v);
 const lake=await exported();assert.equal(lake.features[0].geometry.type,'Polygon');assert.equal(lake.features[0].properties.water,'lake');assert.deepEqual(lake.features[0].geometry.coordinates[0][0],lake.features[0].geometry.coordinates[0].at(-1));
 await kind('pond');assert.equal((await exported()).features[0].properties.water,'pond');
 const operation=async value=>{await evaluate(`(()=>{const el=document.querySelector('select[aria-label="လုပ်ဆောင်ချက်"]');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(100);};
 const input=async(selector,value)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(100);};
 const copyDisabled=()=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='GeoJSON ကူးယူမည်').disabled`);
 await operation('delete');assert.equal(await copyDisabled(),true,'Delete requires an existing name or ID');
 await input('input[aria-label="မူလအရာ ID"]','test-water-123');
 const deleting=await exported();assert.equal(deleting.request.operation,'delete');assert.equal(deleting.features[0].properties.target_id,'test-water-123');
 await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedSelection=text;}}})`);
 await button('Gemini / AI');assert.ok((await evaluate('window.copiedSelection')).includes('operation=delete'));
 await operation('update');assert.equal(await copyDisabled(),true,'Update requires change instructions');
 await input('.map-selection-details label textarea','Change the water color to blue.');
 assert.equal((await exported()).request.operation,'update');
 await operation('move');assert.equal(await copyDisabled(),true,'Move requires destination');
 await button('နေရာအသစ်ရွေးရန်');const moveRect=await bounds();await click(moveRect.x+moveRect.w*.85,moveRect.y+moveRect.h*.6);
 const moving=await exported();assert.equal(moving.request.operation,'move');assert.equal(moving.features.length,2);
 assert.equal(moving.features[0].properties.selection_role,'source');assert.equal(moving.features[1].properties.selection_role,'destination');
 assert.equal(moving.features[1].properties.source_feature_id,moving.features[0].id);assert.ok(moving.request.scene_translation_xz.some(value=>Math.abs(value)>1));
 assert.deepEqual(moving.features[0].properties.scene_boundary_xz,deleting.features[0].properties.scene_boundary_xz,'Moving retains the original boundary');
 await button('Geolocation ကူးယူ');const moveText=await evaluate('window.copiedSelection');assert.ok(moveText.includes('SOURCE /'));assert.ok(moveText.includes('DESTINATION /'));
 const moveShot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,'selection-move.png'),Buffer.from(moveShot.data,'base64'));
 await button('ပိတ်မည်');await evaluate('document.querySelector("#open").click()');await until('!!document.querySelector("dialog[open]")');assert.equal((await exported()).features[1].properties.selection_role,'destination');
 await operation('create');assert.equal((await exported()).request.operation,'create');assert.equal((await exported()).features.length,1);assert.equal((await exported()).features[0].properties.target_id,null);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,vertices:area.features[0].geometry.coordinates[0].length-1,mobileVertices:4,waterways:true,aiCopy:true,crud:true,artifacts}));
} finally {
 try{await browser?.call('Browser.close');}catch{}
 page?.ws.close();browser?.ws.close();browserProcess.kill();vite.kill();
}




