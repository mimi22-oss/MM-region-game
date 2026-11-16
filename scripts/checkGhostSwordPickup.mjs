import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/ghost-sword-pickup');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-runtime-audit-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5225','--strictPort'],{windowsHide:true,stdio:'ignore'});
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4225','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9385',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9385/json/list')).json();await fetch('http://127.0.0.1:5225');await fetch('http://127.0.0.1:4225');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 await call('Network.enable');const requests=[];const oldHandler=ws.onmessage;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);oldHandler(e);};
 await call('Network.setBlockedURLs',{urls:['*.opus']});
 await call('Page.navigate',{url:'http://127.0.0.1:5225/tests/fixtures/ghostSwordPickup.html'});
 const waitFor=async expression=>{const end=Date.now()+60000;while(!await evaluate(expression)){if(Date.now()>end||errors.length)throw Error('Wait failed: '+expression+' '+JSON.stringify(errors));await sleep(100);}};
 await waitFor('!!window.swordTest?.inspect');
 await evaluate('window.swordTest.place(0)');await sleep(350);
 assert.equal(await evaluate('window.swordTest.progress().swordCollected'),false,'locked sword cannot collect');
 await evaluate('window.swordTest.place(3.21);window.swordTest.unlock();');await sleep(350);
 assert.equal(await evaluate('window.swordTest.progress().swordCollected'),false,'outside pickup radius');
 await evaluate('window.swordTest.nearbyGhosts()');
 assert.equal(await evaluate('window.swordTest.guardClear()'),false,'nearby ghosts block the obsolete clearance rule');
 await evaluate('window.swordTest.place(3.2)');
 await waitFor('window.swordTest.progress().swordCollected');
 assert.equal(await evaluate('window.swordTest.inspect().pickupVisible'),false,'world sword hides immediately');
 await evaluate('window.swordTest.place(0)');
 const cases=[];
 for(const kind of ['boy','girl','code','robot']){
  await evaluate(`window.swordTest.kind('${kind}')`);
  await waitFor('window.swordTest.inspect().attached');await sleep(500);
  const proof=await evaluate('window.swordTest.inspect()');
  assert.equal(proof.kind,kind);assert.ok(proof.attached);
  assert.ok(Math.hypot(proof.heldPosition.x-proof.handPosition.x,proof.heldPosition.y-proof.handPosition.y,proof.heldPosition.z-proof.handPosition.z)<.001);
  const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(out,kind+'.png'),Buffer.from(screenshot.data,'base64'));
  cases.push(proof);
 }
 await evaluate('window.swordTest.scene(false)');await sleep(350);
 assert.equal(await evaluate('window.swordTest.inspect().attached'),true,'equipment survives warehouse scene unmount');
 await call('Page.reload');await waitFor('!!window.swordTest?.inspect');await waitFor('window.swordTest.inspect().attached');
 const restored=await evaluate('window.swordTest.inspect()');assert.equal(restored.progress.swordCollected,true);assert.equal(restored.progress.encountered.length,3);
 assert.equal(errors.length,0,JSON.stringify(errors));
 const result={passed:true,autoPickupWithoutInput:true,nearbyGhostsDoNotBlock:true,cases,persistedAfterReload:restored,errors};
 await writeFile(join(out,'runtime.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,characters:cases.map(c=>c.kind),autoPickupWithoutInput:true,persistedAfterReload:true,errors}));
}finally{ws?.close();chrome.kill();vite.kill();preview.kill();}
