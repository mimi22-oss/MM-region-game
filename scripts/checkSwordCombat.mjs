import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/sword-combat');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'ghost-runtime-audit-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5237','--strictPort'],{windowsHide:true,stdio:'ignore'});

const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--incognito','--disk-cache-size=1048576','--media-cache-size=1048576','--disable-gpu-shader-disk-cache','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9397',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9397/json/list')).json();await fetch('http://127.0.0.1:5237');break;}catch{}await sleep(200);}
 ws=new WebSocket(tabs.find(t=>t.type==='page'&&t.url==='about:blank').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{
  const response=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);
  return response.result.value;
 };
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
 await call('Network.enable');const requests=[];const oldHandler=ws.onmessage;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);oldHandler(e);};
 await call('Network.setBlockedURLs',{urls:['*.opus']});
 await call('Page.navigate',{url:'http://127.0.0.1:5237/tests/fixtures/swordCombat.html?quality=mobile'});

 const waitFor=async expression=>{const end=Date.now()+90000;while(!await evaluate(expression)){if(Date.now()>end||errors.length)throw Error('Wait failed '+expression+' '+JSON.stringify({errors,state:await evaluate('window.combatTest?.inspect?.().state'),kind:await evaluate('window.combatTest?.inspect?.().kind')}));await sleep(100);}};
 await waitFor('!!window.combatTest?.inspect&&window.__GHOST_NPC__?.count===3');
 await evaluate('window.combatTest.unlock()');await sleep(350);await evaluate('window.combatTest.far()');
 const field=await evaluate('window.combatTest.field');
 await evaluate(`window.combatTest.place(${field.x+3.1},${field.z});window.combatTest.guard('ghost-1',${field.x+19},${field.z})`);await waitFor(`Math.abs(window.combatTest.inspect().ghosts[0].runtime?.x-${field.x+19})<.01`);
 assert.equal(await evaluate('window.combatTest.clear()'),false);
 await evaluate(`window.combatTest.attack('interact')`);await sleep(2200);assert.equal(await evaluate('window.combatTest.hp().swordCollected'),false);
 await evaluate('window.combatTest.far()');await waitFor('window.combatTest.clear()');await evaluate(`window.combatTest.attack('interact')`);
 await sleep(600);assert.equal(await evaluate('window.combatTest.hp().swordCollected'),false);
 await waitFor('window.combatTest.hp().swordCollected&&window.combatTest.inspect().state.ready');
 await evaluate(`window.combatTest.place(${field.x},${field.z});window.combatTest.guard('ghost-1',${field.x},${field.z-1.1})`);await sleep(300);
 const before=await evaluate('window.combatTest.inspect()');
 const startup=await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f'}));window.combatTest.inspect()");
 assert.equal(startup.state.phase,'STARTUP');assert.equal(startup.progress.hp['ghost-1'],before.progress.hp['ghost-1']);
 await waitFor('!!window.combatTest.lastActive');
 const active=await evaluate('window.combatTest.lastActive');
 const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(out,'active.png'),Buffer.from(screenshot.data,'base64'));
 await waitFor('!window.combatTest.inspect().state.busy');const hit=await evaluate('window.combatTest.inspect()');
 await writeFile(join(out,'first-hit.json'),JSON.stringify({before,startup,active,hit},null,2));
 assert.equal(hit.progress.hp['ghost-1'],before.progress.hp['ghost-1']-10,'real blade must hit once');
 assert.ok(hit.impactHead>before.impactHead);assert.ok(active.trails.length>0);
 await evaluate('window.combatTest.far();window.combatTest.closeup=true');
 for(const [kind,clip] of [['boy','Slash_Left'],['girl','Heavy_Slash'],['canolia','Slash_Overhead']]){
  await evaluate(`window.combatTest.kind('${kind}')`);
  await waitFor(`window.combatTest.inspect().kind==='${kind}'&&window.combatTest.inspect().swords===1&&window.combatTest.inspect().state.ready&&window.combatTest.inspect().state.capable`);
  await evaluate(`window.combatTest.freezeClip='${clip}';window.combatTest.attack('${clip}')`);
  await waitFor('window.combatTest.paused===true');
  const shot=await call('Page.captureScreenshot',{format:'png'});
  await writeFile(join(out,kind+'-'+clip+'.png'),Buffer.from(shot.data,'base64'));
  await evaluate('window.combatTest.paused=false');
  await waitFor('!window.combatTest.inspect().state.busy');
 }
 const cases=[];
 for(const kind of ['boy','girl','canolia']){
  await evaluate(`window.combatTest.kind('${kind}')`);await waitFor(`window.combatTest.inspect().kind==='${kind}'&&window.combatTest.inspect().swords===1&&window.combatTest.inspect().state.capable&&window.combatTest.inspect().state.ready`);await sleep(400);
  await evaluate('window.combatTest.far()');
  const names=['Slash_Left','Slash_Right','Slash_Diagonal_Left','Slash_Diagonal_Right','Slash_Overhead','Slash_Rising','Slash_Middle','Sword_Thrust','Heavy_Slash','Spin_Slash','Jump_Slash','Combo_Finisher','Sword_Block','Sword_Parry','Dodge_Left','Dodge_Right','Hit_React','Knockback'];
  const animations=[];
  for(const name of names){
   const start=await evaluate(`window.combatTest.attack('${name}');window.combatTest.inspect()`);assert.equal(start.state.clip,name,kind+': '+name);
   await waitFor('!window.combatTest.inspect().state.busy');
   const end=await evaluate('window.combatTest.inspect()');assert.equal(end.state.locked,false);assert.equal(end.swords,1);assert.equal(end.rigCount,1);animations.push({name,sequence:start.state.sequence});
  }
  cases.push({kind,animations,proof:await evaluate('window.combatTest.inspect()')});
 }
 // Exercise buffered F input in the real mixer loop and capture the live hand poses.
 await evaluate(`window.combatTest.comboProbe={seen:[]};window.combatTest.attack('combo')`);
 await waitFor('window.combatTest.comboProbe.seen.length===6&&!window.combatTest.inspect().state.busy');
 const combo=await evaluate('window.combatTest.comboProbe.seen');
 assert.deepEqual(combo,['Slash_Left','Slash_Right','Slash_Diagonal_Left','Slash_Overhead','Slash_Rising','Combo_Finisher']);
 await evaluate('window.combatTest.comboProbe=null');
 // Misses and group shielding must not emit impacts or subtract HP.
 await evaluate(`window.combatTest.kind('boy');window.combatTest.far()`);await sleep(500);
 await evaluate(`window.combatTest.guard('ghost-1',${field.x},${field.z+1.2})`);await sleep(100);
 let proof=await evaluate('window.combatTest.inspect()');await evaluate(`window.combatTest.attack('Slash_Left')`);await waitFor('!window.combatTest.inspect().state.busy');
 let end=await evaluate('window.combatTest.inspect()');assert.equal(end.progress.hp['ghost-1'],proof.progress.hp['ghost-1']);assert.equal(end.impactHead,proof.impactHead);
 await evaluate(`window.combatTest.guard('ghost-1',${field.x},${field.z-1.1});window.combatTest.guard('ghost-2',${field.x+5},${field.z})`);await sleep(100);
 proof=await evaluate('window.combatTest.inspect()');await evaluate(`window.combatTest.attack('Slash_Left')`);await waitFor('!window.combatTest.inspect().state.busy');end=await evaluate('window.combatTest.inspect()');assert.equal(end.progress.hp['ghost-1'],proof.progress.hp['ghost-1']);
 await evaluate(`window.combatTest.far();window.combatTest.guard('ghost-1',${field.x},${field.z-1.1});window.combatTest.trimHp('ghost-1')`);await sleep(100);
 await evaluate(`window.combatTest.attack('Slash_Left')`);await waitFor(`window.combatTest.hp().hp['ghost-1']===0`);
 const dying=await evaluate('window.combatTest.inspect()');await waitFor('window.combatTest.inspect().ghosts[0].visible===false');const dead=await evaluate('window.combatTest.inspect()');assert.equal(dead.ghosts[0].visible,false);assert.equal(dead.ghosts[0].runtime,undefined);
 await evaluate('window.combatTest.npcs(false);window.combatTest.mount(false)');await sleep(350);
 assert.equal(await evaluate('window.combatTest.inspect().state.capable'),false);assert.equal(await evaluate('window.combatTest.inspect().state.ready'),false);
 assert.equal(errors.length,0,JSON.stringify(errors));
 const result={passed:true,pickupClearanceAndTiming:true,combo,cases,firstHit:{before,startup,active,hit},dying,dead,cleanup:true,errors,frames:await evaluate('window.combatTest.frames')};
 await writeFile(join(out,'runtime.json'),JSON.stringify(result));console.log(JSON.stringify({passed:true,characters:cases.map(c=>c.kind),clipsPerCharacter:cases.map(c=>c.animations.length),singleHit:true,shieldAndMiss:true,death:true,cleanup:true,errors}));
}finally{
 if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({id:9999999,method:'Browser.close'}));await sleep(250);}
 ws?.close();chrome.kill();vite.kill();
}
