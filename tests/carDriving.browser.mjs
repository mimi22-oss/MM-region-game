// Run against the Vite dev server and a headless Chrome debugging port:
// node tests/worldLoading.browser.mjs [site URL] [debugging port]
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const site = process.argv[2] ?? 'http://127.0.0.1:5173';
const debug = `http://127.0.0.1:${process.argv[3] ?? 9334}`;
const artifacts = await mkdtemp(join(tmpdir(), 'myanmar-loading-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), listeners = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      message.error ? request.reject(message.error) : request.resolve(message.result);
    } else listeners.get(message.method)?.(message.params);
  };
  return {
    ws,
    on: (event, callback) => listeners.set(event, callback),
    call: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 60000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    }),
  };
}

const version = await (await fetch(`${debug}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const {browserContextId}=await browser.call('Target.createBrowserContext');
const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank',browserContextId });
const targets = await (await fetch(`${debug}/json/list`)).json();
const page = await connect(targets.find(target => target.id === targetId).webSocketDebuggerUrl);
const errors = [];
page.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text));
const evaluate = async expression => {
  const result = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
async function until(expression, label, timeout = 180000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if(errors.length)throw new Error(errors.join('\n'));
    if (await evaluate(expression)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}: ${await evaluate('document.body.innerText')}`);
}
async function screenshot(name) {
  const shot = await page.call('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'));
}

const key = (code,down=true) => page.call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:({Space:' ',Digit1:'1',KeyC:'c',KeyW:'w',KeyA:'a',KeyV:'v',KeyE:'e'})[code]??code});
const tap = async code => { await key(code); await key(code,false); };
const point=async selector=>evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);
const touch=async(type,points)=>page.call('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:3,radiusY:3,force:1}))});
try{
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1000,height:760,deviceScaleFactor:1,mobile:false});
 await page.call('Page.navigate',{url:site+'/tests/fixtures/carDriving.html'});
 await until('window.carTest?.driving','automatic side-door boarding');
 assert.equal(await evaluate('window.carTest.interior'),true);
 assert.equal(await evaluate('window.carTest.driverVisible'),true,'seated body remains visible in cockpit view');
 await until('window.carTest.grips.every(p=>p&&Math.abs(Math.hypot(p[0],p[1])-.17)<.002&&Math.abs(p[2])<.002)','both hands contact the actual steering rim');
 await screenshot('car-desktop-interior');
 await tap('Digit1');assert.equal(await evaluate('window.carTest.gear'),0,'clutch required');
 await key('KeyC');await tap('Digit1');await key('KeyC',false);
 await until('window.carTest.gear===1','first gear');
 await key('KeyW');await until('window.carTest.speed>1','forward acceleration');
 await key('KeyA');await until('window.carTest.steering<-.12','rate-limited steering');
 assert.ok(await evaluate('window.carTest.frontAngles[0]>window.carTest.frontAngles[1]'),'inside front wheel visibly turns more');
 assert.ok(await evaluate('window.carTest.steeringWheel>1.5'),'3D steering wheel follows the steering ratio');
 assert.ok(await evaluate('window.carTest.grips.every(p=>Math.abs(Math.hypot(p[0],p[1])-.17)<.003&&Math.abs(p[2])<.003)'),'hands remain on the tilted rim while turning');
 await key('KeyA',false);
 await key('Space');await until('window.carTest.speed===0','brakes override throttle');await key('KeyW',false);await key('Space',false);
 assert.ok(await evaluate('window.carTest.distance')>.3,'car travels through the world');
 await tap('KeyV');await until('!window.carTest.interior','external camera');await screenshot('car-desktop-exterior');
 for(const [name,position,target] of [
  ['car-front-quarter',[2.8,2.25,-3.8],[0,1.15,0]],
  ['car-driver-side',[3,1.85,-.1],[0,1.25,0]],
  ['car-passenger-cabin',[-.32,1.72,-.15],[.28,1.04,-.27]],
 ]){
  await evaluate(`window.carViewCamera=${JSON.stringify({position,target})}`);
  await sleep(300);await screenshot(name);
 }
 await evaluate('delete window.carViewCamera');
 const parked=await evaluate('({x:window.carTest.x,z:window.carTest.z})');
 await tap('KeyE');await until('!window.carTest.driving','exit');
 await sleep(1000);assert.equal(await evaluate('window.carTest.driving'),false,'no immediate remount');
 assert.deepEqual(await evaluate('({x:window.carTest.x,z:window.carTest.z})'),parked);
 console.log('desktop: automatic boarding, cockpit, clutch/gear, acceleration, steering, braking, camera and parking passed');
 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await page.call('Page.navigate',{url:site+'/tests/fixtures/carDriving.html'});
 await until('window.carTest?.driving','mobile boarding');
 await screenshot('car-mobile-interior');
 await evaluate(`window.touchLog=[];for(const name of ['pointerdown','pointerup','pointercancel','lostpointercapture','blur'])document.addEventListener(name,event=>window.touchLog.push({type:event.type,id:event.pointerId,target:event.target?.getAttribute?.('aria-label')}),true)`);
 const clutch={...await point('button[aria-label="ကလပ်"]'),id:1},gear={...await point('.car-gear-fwd-1'),id:2};
 await touch('touchStart',[clutch]);await touch('touchStart',[clutch,gear]);
 // CDP touchEnd ends the entire gesture and must have no points. Updating the
 // active touch list releases only the gear finger while keeping the clutch held.
 await touch('touchMove',[clutch]);
 await until('window.carTest.gear===1','two-finger clutch and shift');
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 assert.equal(await evaluate('window.carTest.input.clutch'),true,`gear tap keeps the other finger clutch depressed: ${JSON.stringify(await evaluate('window.touchLog'))}`);
 await touch('touchEnd',[]);await until('!window.carTest.input.clutch','clutch released');
 const gas={...await point('button[aria-label="လီဗာ"]'),id:3};
 await touch('touchStart',[gas]);await until('window.carTest.speed>1','touch accelerator');
 const center=await point('.car-steering-wheel'),wheel={x:center.x,y:center.y-25,id:4};
 await touch('touchStart',[gas,wheel]);await touch('touchMove',[gas,{...wheel,x:center.x+30,y:center.y}]);
 await until('window.carTest.steering>.06','drag steering wheel');
 await touch('touchCancel',[]);await until('!window.carTest.input.throttle&&!window.carTest.input.steer','cancelled touches release controls');
 await evaluate('document.querySelector("[data-action=pause]").click()');await until('window.carTest.speed===0','pause stops car');
 assert.equal(await evaluate('window.carTest.input.clutch'),false);
 await evaluate('document.querySelector("[data-action=pause]").click()');
 await until('!!document.querySelector(".car-controls")','resume controls');
 // React's resume effect clears stale inputs after mounting the controls.
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 await evaluate('document.querySelector(".car-exit-btn").click()');await until('!window.carTest.driving','mobile exit');
 await screenshot('car-mobile-parked');
 assert.deepEqual(errors,[]);
 console.log('mobile: multi-touch clutch/gear, pedals, draggable steering, cancellation, pause and exit passed');
 console.log('Screenshots:',artifacts);
}finally{await browser.call('Target.disposeBrowserContext',{browserContextId});page.ws.close();browser.ws.close();}
