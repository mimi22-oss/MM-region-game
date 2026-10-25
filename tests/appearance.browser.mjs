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


const key=(code,down=true)=>page.call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:({Space:' ',Digit1:'1',KeyW:'w',KeyV:'v',KeyP:'p'})[code]??code});
const tap=async code=>{await key(code);await key(code,false);};
const choose=async(label,value)=>{
 await evaluate(`(()=>{const label=[...document.querySelectorAll('.appearance-field')].find(e=>e.querySelector('span')?.textContent===${JSON.stringify(label)});const select=label?.querySelector('select');if(!select)throw new Error('Missing select');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await sleep(100);
};
const color=async(label,value)=>{
 await evaluate(`(()=>{const label=[...document.querySelectorAll('.appearance-field')].find(e=>e.querySelector('span')?.textContent===${JSON.stringify(label)});const input=label.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await sleep(100);
};
try{
 await page.call('Runtime.enable');await page.call('Page.enable');
 await page.call('Emulation.setDeviceMetricsOverride',{width:1280,height:850,deviceScaleFactor:1,mobile:false});
 await page.call('Page.navigate',{url:site+'/tests/fixtures/appearance.html'});
 await until('!!window.appearanceTest','appearance fixture');
 for(const preset of ['girl','mother','grandmother','grandfather','father','boy']){
  await choose('လူပုံစံ',preset);await until(`window.appearanceTest.settings.human.preset==='${preset}'`,'human preset '+preset);
  assert.equal(await evaluate('window.appearanceTest.other'),'6936ae','customizing one human leaves another instance unchanged');
 }
 await choose('လူပုံစံ','grandmother');await screenshot('appearance-grandmother');
 await choose('ဆံပင်ပုံစံ','long');await choose('ဖိနပ်ပုံစံ','boots');await color('အင်္ကျီအရောင်','#18a966');
 await until("window.appearanceTest.torso==='18a966'",'independent live clothing material');
 await evaluate('document.getElementById("appearance-tab-car").click()');
 for(const model of ['toyota','lambo','toshiba','lighttruck']){
  await choose('ကားပုံစံ',model);await until(`window.appearanceTest.settings.car.model==='${model}'&&window.appearanceTest.modelVisible`,'bodywork '+model);
  await screenshot('appearance-car-'+model);
 }
 await choose('ဂီယာစနစ်','automatic');await color('ကားအရောင်','#db7138');
 await evaluate('document.getElementById("appearance-tab-robot").click()');
 await choose('ခြေထောက်','feet');await choose('လက်ပုံစံ','claw');await color('Robot အရောင်','#b84169');
 await until('window.appearanceTest.robotLegs&&window.appearanceTest.robotHands','replaceable robot limbs');
 await screenshot('appearance-robot-feet');
 await choose('ခြေထောက်','tracks');await choose('လက်ပုံစံ','gripper');
 await screenshot('appearance-robot-tracks');
 await page.call('Page.reload');await until("window.appearanceTest?.settings.car.transmission==='automatic'&&window.appearanceTest.settings.human.clothingColor==='#18a966'",'saved appearance after reload');
 assert.equal(await evaluate('window.appearanceTest.settings.robot.legs'),'tracks');
 assert.equal(await evaluate('window.appearanceTest.other'),'6936ae');
 await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.ok(await evaluate('document.querySelector(".settings-menu").getBoundingClientRect().right<=innerWidth'),'mobile settings fit the viewport');
 await screenshot('appearance-mobile-settings');
 // Drive the configured truck using the actual Player, collision and controls.
 await page.call('Page.navigate',{url:site+'/tests/fixtures/carDriving.html'});
 await until('window.carTest?.driving','automatic truck boarding');
 assert.equal(await evaluate('window.carTest.transmission'),'automatic');
 assert.equal(await evaluate('window.carTest.model'),'lighttruck');
 assert.equal(await evaluate('!!document.querySelector("button[aria-label=ကလပ်]")'),false,'automatic has no clutch pedal control');
 assert.equal(await evaluate('document.querySelectorAll(".car-auto-selector button").length'),4);
 await tap('Digit1');assert.equal(await evaluate('window.carTest.gear'),0,'brake interlock');
 await key('Space');await tap('Digit1');await key('Space',false);
 await key('KeyW');await until('window.carTest.speed>1','automatic acceleration without clutch');
 await key('Space');await until('window.carTest.speed===0','automatic braking');await key('KeyW',false);
 await tap('KeyP');await key('Space',false);
 await until('document.querySelector(".car-gear-readout").textContent.trim()==="P"','automatic park display');
 await tap('KeyV');await until('!window.carTest.interior','custom driver exterior');
 await screenshot('appearance-automatic-truck-driver');
 assert.deepEqual(errors,[]);
 console.log('Appearance presets, material isolation, all car bodies, robot limbs, persistence, mobile settings and automatic driving passed.');
 console.log('Screenshots:',artifacts);
}finally{await browser.call('Target.disposeBrowserContext',{browserContextId});page.ws.close();browser.ws.close();}
