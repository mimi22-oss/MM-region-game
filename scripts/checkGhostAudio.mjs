import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/performance-audit/audio');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-audio-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5196','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9356',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9356/json/list')).json();await fetch('http://127.0.0.1:5196');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:'http://127.0.0.1:5196/tests/fixtures/ghostAudio.html'});
 const end=Date.now()+60000;while(!await evaluate('!!window.audit')){if(Date.now()>end)throw Error('Audio fixture not ready: '+JSON.stringify(errors));await sleep(200);}
 assert.equal(await evaluate('window.audit.locked.contextState'),'locked');
 assert.equal(await evaluate('window.audit.same'),true);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:40,y:18,button:'left',clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:40,y:18,button:'left',clickCount:1});
 await sleep(200);
 assert.equal(await evaluate('window.audit.gameAudio.context.state'),'running');
 assert.equal(await evaluate('window.audit.play()'),true);
 await sleep(100);const playing=await evaluate('window.audit.engine.diagnostics');assert.equal(playing.voices,22);assert.equal(playing.emitters,2);
 const drainDeadline=Date.now()+20000;while(await evaluate('window.audit.engine.diagnostics.voices')){if(Date.now()>drainDeadline)throw Error('Voices failed to drain: '+JSON.stringify(await evaluate('({d:window.audit.engine.diagnostics,time:window.audit.gameAudio.context.currentTime})')));await sleep(200);}
 await evaluate('for(let i=0;i<50;i++)window.audit.engine.play("ghost_scream",1,"a")');
 assert.equal(await evaluate('window.audit.engine.diagnostics.voices'),24);
 await evaluate('window.audit.stop()');await sleep(500);assert.equal(await evaluate('window.audit.engine.diagnostics.voices'),0);
 await evaluate('window.audit.release()');assert.equal(await evaluate('window.audit.engine.diagnostics.emitters'),0);
 // Mount the real R3F zone independently of ghost asset visibility and inspect actual panners.
 await call('Network.enable');const audioRequests=[];
 const oldHandler=ws.onmessage;ws.onmessage=e=>{const message=JSON.parse(e.data);if(message.method==='Network.requestWillBeSent'&&/\.(mp3|wav|ogg|aac|flac|m4a)(?:[?#]|$)/i.test(message.params.request.url))audioRequests.push(message.params.request.url);oldHandler(e);};
 await call('Page.navigate',{url:'http://127.0.0.1:5196/tests/fixtures/hauntedWarehouseAudio.html'});
 const readyDeadline=Date.now()+60000;while(!await evaluate('!!window.zone?.ready')){if(Date.now()>readyDeadline)throw Error('Zone fixture not ready: '+JSON.stringify(errors));await sleep(100);}
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:40,y:10,button:'left',clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:40,y:10,button:'left',clickCount:1});
 const bedDeadline=Date.now()+5000;while(!await evaluate('window.zone.stats?.sources===6')){if(Date.now()>bedDeadline)throw Error('Continuous bed did not start immediately after unlock');await sleep(50);}
 await sleep(4500);assert.equal(await evaluate('window.zone.stats.sources'),6,'persistent ambience survives short effect endings');
 const firstDeadline=Date.now()+20000;while(!await evaluate('window.zone.synth.activeVoiceCount("warehouse-audio:")')){if(Date.now()>firstDeadline)throw Error('No zone event on night entry');await sleep(100);}
 const positioned=await evaluate(`Array.from(window.zone.synth.emitters.entries()).every(([id,e])=>{const p=window.zone.origins.find(p=>p.id===id);return p&&Math.abs(e.panner.positionX.value-p.x)<.001&&Math.abs(e.panner.positionZ.value-p.z)<.001&&e.panner.panningModel==='HRTF';})`);
 assert.equal(positioned,true);
 await evaluate('window.zone.distance(80)');await sleep(800);assert.equal(await evaluate('window.zone.synth.activeVoiceCount("warehouse-audio:")'),0);
 const fadeDeadline=Date.now()+6000;while(await evaluate('window.zone.stats?.sources!==0')){if(Date.now()>fadeDeadline)throw Error('Continuous bed did not fade out after leaving zone');await sleep(100);}
 await evaluate('window.zone.distance(30)');
 const reenterDeadline=Date.now()+5000;while(!await evaluate('window.zone.stats?.sources===6')){if(Date.now()>reenterDeadline)throw Error('Continuous bed did not restart upon returning to zone');await sleep(50);}
 await evaluate('window.zone.distance(12);window.zone.night(false)');await sleep(800);assert.equal(await evaluate('window.zone.synth.activeVoiceCount("warehouse-audio:")'),0);
 assert.equal(await evaluate('window.zone.gameAudio.context.state'),'running','normal daylight ambience keeps its shared context');
 await sleep(4000);assert.equal(await evaluate('window.zone.synth.activeVoiceCount("warehouse-audio:")'),0);
 await evaluate('window.zone.night(true)');
 const returnDeadline=Date.now()+20000;while(!await evaluate('window.zone.synth.activeVoiceCount("warehouse-audio:")')){if(Date.now()>returnDeadline)throw Error('No zone event on night return');await sleep(100);}
 await evaluate('window.zone.distance(5)');await sleep(800);assert.equal(await evaluate('window.zone.stats.sources'),6,'continuous ambience stays independent inside encounter distance');
 const bounded=await evaluate(`(async()=>{const {GhostSpatialAudioController}=await import('/src/game/audio/GhostSpatialAudioController.ts');const c=new GhostSpatialAudioController(window.zone.origins,[]);for(const p of window.zone.origins)c.play(p,'metal_knock',.2);const count=window.zone.synth.activeVoiceCount('warehouse-audio:');c.dispose();return count<=4;})()`);
 assert.equal(bounded,true,'zone retains at most four emitter slots under source churn');
 await evaluate('window.zone.gameAudio.setActive(false)');await sleep(250);assert.equal(await evaluate('window.zone.gameAudio.context.state'),'suspended');assert.equal(await evaluate('window.zone.synth.diagnostics.voices'),0);
 assert.deepEqual(audioRequests,[]);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,presets:22,sharedContext:true,voiceLimit:24,cleanup:true,warehouseZone:true,noAudioFiles:true,errors}));
 await writeFile(join(out,'audio-regression.json'),JSON.stringify({passed:true,playing,warehouseZone:true,noAudioFiles:true,errors},null,2));
}finally{ws?.close();chrome.kill();vite.kill();}
