import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/performance-audit/audio');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-audio-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5196','--strictPort'],{windowsHide:true,stdio:'ignore'});
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4196','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9356',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9356/json/list')).json();await fetch('http://127.0.0.1:5196');await fetch('http://127.0.0.1:4196');break;}catch{}await sleep(200);}
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

 // Mount the real R3F zone + inspect local Opus decoding, day/night ambience, fades, and panners.
 await call('Network.enable');const externalAudioRequests=[];const horrorAudioRequests=[];
 const oldHandler=ws.onmessage;ws.onmessage=e=>{
  const message=JSON.parse(e.data);
  if(message.method==='Network.requestWillBeSent'){
   const url=message.params.request.url;
   if(url.includes('/assets/audio/horror/'))horrorAudioRequests.push(url);
   else if(/\.(mp3|wav|ogg|aac|flac|m4a|opus)(?:[?#]|$)/i.test(url))externalAudioRequests.push(url);
  }
  oldHandler(e);
 };
 await call('Page.navigate',{url:'http://127.0.0.1:5196/tests/fixtures/hauntedWarehouseAudio.html'});
 const readyDeadline=Date.now()+60000;while(!await evaluate('!!window.zone?.ready')){if(Date.now()>readyDeadline)throw Error('Zone fixture not ready: '+JSON.stringify(errors));await sleep(100);}
 // Only manifest + approached ambience stems may preload proactively; encounter/SFX clips must not load eagerly at boot.
 assert.ok(
  horrorAudioRequests.every(u=>u.includes('manifest.json')||u.includes('ambience/warehouse-drone.opus')||u.includes('ambience/eerie-wind.opus')),
  'never eagerly loads encounter/event SFX at startup: '+JSON.stringify(horrorAudioRequests),
 );

 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:40,y:10,button:'left',clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:40,y:10,button:'left',clickCount:1});
 const bedDeadline=Date.now()+8000;while(!await evaluate('(window.zone.stats?.sources??0)>=2')){if(Date.now()>bedDeadline)throw Error('Continuous bed did not start immediately after unlock');await sleep(50);}

 // Verify Opus pack decode in real Chrome Web Audio (all 11 assets).
 const decodedAll=await evaluate(`(async()=>{
  const manifest=await window.zone.loader.loadManifest();
  if(!manifest||manifest.assets.length!==11)return {ok:false,reason:'manifest'};
  const results={};
  for(const entry of manifest.assets){
   const buf=await window.zone.loader.loadBuffer(entry.id);
   results[entry.id]=buf?{duration:Math.round(buf.duration*100)/100,channels:buf.numberOfChannels,sampleRate:buf.sampleRate}:null;
  }
  return {ok:Object.values(results).every(Boolean),results,diag:window.zone.loader.getDiagnostics()};
 })()`);
 assert.equal(decodedAll.ok,true,'all 11 Opus files fetched and decoded in Chromium: '+JSON.stringify(decodedAll));
 const opusDeadline=Date.now()+5000;while(!await evaluate('window.zone.stats?.bedMode==="opus"&&window.zone.stats?.sources===2')){if(Date.now()>opusDeadline)throw Error('Ambience did not switch cleanly to Opus: '+JSON.stringify(await evaluate('window.zone.stats')));await sleep(50);}
 await sleep(2000);assert.equal(await evaluate('window.zone.stats.sources'),2,'persistent Opus ambience survives short effect endings without duplicate nodes');

 const firstDeadline=Date.now()+20000;while(!await evaluate('window.zone.mixer.activeVoiceCountForPrefix("warehouse-audio:")>0')){if(Date.now()>firstDeadline)throw Error('No zone event on night entry');await sleep(100);}
 await evaluate('window.zone.distance(80)');await sleep(800);
 assert.equal(await evaluate('window.zone.mixer.activeVoiceCountForPrefix("warehouse-audio:")'),0);
 const fadeDeadline=Date.now()+6000;while(await evaluate('window.zone.stats?.sources!==0')){if(Date.now()>fadeDeadline)throw Error('Continuous bed did not fade out after leaving zone');await sleep(100);}
 await evaluate('window.zone.distance(30)');
 const reenterDeadline=Date.now()+5000;while(!await evaluate('window.zone.stats?.sources===2')){if(Date.now()>reenterDeadline)throw Error('Continuous bed did not restart without duplication on re-entry');await sleep(50);}
 await evaluate('window.zone.distance(80)');await sleep(2600);
 await evaluate('window.zone.distance(30)');await sleep(800);
 assert.equal(await evaluate('window.zone.stats?.sources'),2,'re-entering zone twice creates zero duplicate audio nodes');

 // Daytime ambience: subtle bed continues playing while night-only haunted events stay inactive.
 await evaluate('window.zone.distance(12);window.zone.night(false)');await sleep(1200);
 assert.equal(await evaluate('window.zone.gameAudio.context.state'),'running','normal daylight ambience keeps its shared context');
 assert.equal(await evaluate('window.zone.stats?.sources'),2,'warehouse ambience plays during daytime independently of ghost night rule');
 assert.equal(await evaluate('window.zone.mixer.activeVoiceCountForPrefix("warehouse-audio:")'),0,'night haunted jumpscares stay silent in daytime');

 await evaluate('window.zone.night(true)');
 const returnDeadline=Date.now()+20000;while(!await evaluate('window.zone.mixer.activeVoiceCountForPrefix("warehouse-audio:")>0')){if(Date.now()>returnDeadline)throw Error('No zone event on night return');await sleep(100);}
 await evaluate('window.zone.distance(5)');await sleep(800);assert.equal(await evaluate('window.zone.stats.sources'),2,'continuous ambience stays independent inside encounter distance');

 // Ghost chase + grab telemetry in real browser AudioContext.
 const chaseAndGrab=await evaluate(`(()=>{
  window.zone.mixer.setChaseTension('ghost-1',true,0.8,0.05);
  const c1=window.zone.diag().activeBuses.chaseMusic.activeVoices;
  for(let i=0;i<30;i++)window.zone.mixer.setChaseTension('ghost-1',true,0.9,0.016);
  const c2=window.zone.diag().activeBuses.chaseMusic.activeVoices;
  const grab=window.zone.mixer.playCue({assetId:'ghost-grab-impact',fallbackPreset:'ghost_grab',bus:'ghostEffects',owner:'ghost-1',position:{x:35,y:1.5,z:36},volume:0.9});
  window.zone.mixer.setChaseTension('ghost-1',false,0,0.05);
  return {c1,c2,grab};
 })()`);
 assert.equal(chaseAndGrab.c1,1);assert.equal(chaseAndGrab.c2,1,'chase loop does not duplicate across ticks');
 assert.equal(chaseAndGrab.grab,'opus','grab impact plays decoded Opus');

 // Sound-off mutes all active audio; re-enable + background/foreground resumes.
 await evaluate('window.zone.sound(false)');await sleep(300);
 assert.equal(await evaluate('window.zone.stats?.sources??0'),0,'sound-off stops warehouse ambience');
 await evaluate('window.zone.sound(true)');
 const soundOnDeadline=Date.now()+5000;while(!await evaluate('window.zone.stats?.sources===2')){if(Date.now()>soundOnDeadline)throw Error('Audio failed to resume after turning sound back on');await sleep(50);}

 const bounded=await evaluate(`(async()=>{const {GhostSpatialAudioController}=await import('/src/game/audio/GhostSpatialAudioController.ts');const c=new GhostSpatialAudioController(window.zone.origins,[]);for(const p of window.zone.origins)c.play(p,'metal_knock',.2);const count=window.zone.mixer.activeVoiceCountForPrefix('warehouse-audio:');c.dispose();return count<=4;})()`);
 assert.equal(bounded,true,'zone retains at most four emitter slots under source churn');

 // Procedural fallback check when Opus codec is unsupported in runtime browser/WebView.
 const proceduralFallback=await evaluate(`(async()=>{
  const {HorrorAudioAssetLoader}=await import('/src/game/audio/HorrorAudioAssetLoader.ts');
  const {HorrorAudioMixer}=await import('/src/game/audio/HorrorAudioMixer.ts');
  const fallbackLoader=new HorrorAudioAssetLoader({detectOpus:()=>({supported:false,oggOpus:'',rawOpus:'',mediaSourceOpus:false,runtimeDecodeOk:false,method:'dom-audio',detail:'Forced unsupported Opus test'})});
  const fallbackMixer=new HorrorAudioMixer(fallbackLoader).acquire();
  const cueMode=fallbackMixer.playCue({assetId:'horror-sting',fallbackPreset:'ghost_warning',bus:'horrorEvents',owner:'fallback-test',volume:0.6});
  const bedDiag=fallbackMixer.updateWarehouseAmbience({active:true,level:0.5,isNight:false,dt:0.1});
  fallbackMixer.stopOwner('fallback-test');fallbackMixer.dispose();
  return {cueMode,bedMode:bedDiag.bedMode,sources:bedDiag.sources,opusSupported:fallbackLoader.getOpusSupport().supported};
 })()`);
 assert.equal(proceduralFallback.opusSupported,false);
 assert.equal(proceduralFallback.cueMode,'procedural','falls back cleanly to procedural cue when Opus unsupported');
 assert.equal(proceduralFallback.bedMode,'procedural','falls back cleanly to WarehouseAmbientBed when Opus unsupported');
 assert.equal(proceduralFallback.sources,6);

 await evaluate('window.zone.gameAudio.setActive(false)');await sleep(250);assert.equal(await evaluate('window.zone.gameAudio.context.state'),'suspended');
 await evaluate('window.zone.gameAudio.setActive(true)');await sleep(250);assert.equal(await evaluate('window.zone.gameAudio.context.state'),'running','resumes context on foreground');

 // Production build gating & Dev Audio Diagnostics Test Audio verification on vite preview (dist/).
 await call('Page.navigate',{url:'http://127.0.0.1:4196/'});
 const prodDeadline=Date.now()+20000;while(!await evaluate('document.readyState==="complete"')){if(Date.now()>prodDeadline)throw Error('Preview root did not load');await sleep(100);}
 await sleep(400);
 assert.equal(await evaluate('document.querySelector(\'[data-testid="audio-diagnostics-panel"]\')===null'),true,'production build hides dev audio diagnostics by default');

 await call('Page.navigate',{url:'http://127.0.0.1:4196/?dev'});
 const devDeadline=Date.now()+20000;while(!await evaluate('!!document.querySelector(\'[data-testid="audio-diagnostics-toggle"]\')')){if(Date.now()>devDeadline)throw Error('Dev audio diagnostics toggle not rendered under ?dev');await sleep(100);}
 await evaluate('document.querySelector(\'[data-testid="audio-diagnostics-toggle"]\').click()');
 const btnDeadline=Date.now()+5000;while(!await evaluate('!!document.querySelector(\'[data-testid="diag-test-audio-btn"]\')')){if(Date.now()>btnDeadline)throw Error('Test Audio button missing');await sleep(50);}
 const box=await evaluate('(()=>{const r=document.querySelector(\'[data-testid="diag-test-audio-btn"]\').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x,y:box.y,button:'left',clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x,y:box.y,button:'left',clickCount:1});
 const diagDone=Date.now()+6000;
 while(!await evaluate('document.querySelector(\'[data-diag="current-file"]\')?.textContent==="events/horror-sting.opus"')){if(Date.now()>diagDone)throw Error('Diag Test Audio did not decode/play horror-sting.opus');await sleep(100);}
 const diagUi=await evaluate('({ctx:document.querySelector(\'[data-diag="context-state"]\')?.textContent,enabled:document.querySelector(\'[data-diag="sound-enabled"]\')?.textContent,opus:document.querySelector(\'[data-diag="opus-support"]\')?.textContent,file:document.querySelector(\'[data-diag="current-file"]\')?.textContent,err:document.querySelector(\'[data-diag="last-error"]\')?.textContent})');
 assert.equal(diagUi.ctx,'running');
 assert.equal(diagUi.enabled,'ON');
 assert.equal(diagUi.opus,'supported');
 assert.equal(diagUi.file,'events/horror-sting.opus');
 assert.equal(diagUi.err,'none');

 assert.deepEqual(externalAudioRequests,[]);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,opusDecoded:11,presets:22,sharedContext:true,voiceLimit:24,cleanup:true,warehouseZone:true,proceduralFallback:true,devDiagnostics:true,externalAudioRequests:0,errors}));
 await writeFile(join(out,'audio-regression.json'),JSON.stringify({passed:true,playing,decodedAll:decodedAll.results,warehouseZone:true,chaseAndGrab,proceduralFallback,diagUi,errors},null,2));
}finally{ws?.close();chrome.kill();vite.kill();preview.kill();}
