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
const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
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
    if (await evaluate(expression)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}: ${await evaluate('document.body.innerText')}`);
}
async function screenshot(name) {
  const shot = await page.call('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'));
}

let failPrimary = false;
const held = new Set();
page.on('Fetch.requestPaused', async event => {
  try {
    const primary = event.request.url.includes('/wards/myothar/index.tsx');
    if (failPrimary && primary) {
      await page.call('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Failed' });
    } else {
      if (!held.has(event.request.url)) {
        held.add(event.request.url);
        await sleep(primary ? 1200 : 350);
      }
      await page.call('Fetch.continueRequest', { requestId: event.requestId });
    }
  } catch (error) { errors.push(String(error)); }
});

try {
  await page.call('Runtime.enable');
  await page.call('Page.enable');
  await page.call('Network.enable');
  await page.call('Network.setCacheDisabled', { cacheDisabled: true });
  await page.call('Fetch.enable', { patterns: [
    { urlPattern: '*/src/components/wards/myothar/index.tsx*' },
    { urlPattern: '*/src/components/villages/*/index.tsx*' },
  ] });
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.loadingMessages = [];
    new MutationObserver(() => {
      const text = document.querySelector('[data-world-loading]')?.innerText;
      if (text && window.loadingMessages.at(-1) !== text) window.loadingMessages.push(text);
    }).observe(document, {childList: true, subtree: true, characterData: true});
  ` });

  const transitionsOnly = process.argv.includes('--transitions-only');
  for (const [name, width, height] of process.argv.includes('--errors-only') || transitionsOnly ? [] : [['desktop', 1000, 760], ['mobile', 390, 844]]) {
    held.clear();
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: name === 'mobile' });
    await page.call('Page.navigate', { url: site });
    await until(`document.querySelector('[data-world-loading="blocking"] .world-loading-name')?.innerText.includes('မြို့သာ')`, `${name} named startup`);
    assert.equal(await evaluate(`document.querySelector('.game-content').inert`), true);
    assert.equal(await evaluate(`document.querySelectorAll('.loading-dots i').length`), 3);
    assert.equal(await evaluate(`!!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.world-loading')`), true);
    await screenshot(`${name}-loading`);
    await until(`document.querySelector('canvas') && document.querySelector('.game-content')?.inert === false`, `${name} ready`);
    await until(`!document.querySelector('[data-world-loading]')`, `${name} startup complete`);
    const messages = await evaluate('window.loadingMessages');
    assert.ok(messages.some(text => text.includes('မြို့သာ')), `${name}: named progress`);
    assert.ok(messages.some(text => text.includes('ကြာအင်း')), `${name}: all regions prepared`);
    assert.ok(messages.every(text => !text.includes('ဒေတာရယူနေသည်') && !text.includes('အဆင်သင့်ဖြစ်')), `${name}: only town names, no stage text`);
    await screenshot(`${name}-ready`);
    const frames = await evaluate(`new Promise(resolve => { const times = []; let previous; function sample(now) { if(previous) times.push(now-previous); previous=now; if(times.length===12) resolve({meanFrameMs:times.reduce((a,b)=>a+b,0)/times.length,maxFrameMs:Math.max(...times),heapMB:Math.round((performance.memory?.usedJSHeapSize??0)/1048576)}); else requestAnimationFrame(sample); } requestAnimationFrame(sample); })`);
    console.log(`${name}: one startup, town names only, controls released after all regions prepared`);
    console.log(`${name}: steady scene sample`, frames);
  }

  if (!transitionsOnly) {
    failPrimary = true;
    await page.call('Page.navigate', { url: site });
    await until(`!!document.querySelector('.world-loading-card button')`, 'download error');
    assert.ok(await evaluate(`document.querySelector('.world-loading').innerText.includes('မြို့သာ')`));
    assert.ok(await evaluate(`!!document.querySelector('.world-loading-card button')`));
    assert.equal(await evaluate(`document.querySelector('.game-content').inert`), true);
    await screenshot('download-error');
    failPrimary = false;
    await evaluate(`document.querySelector('.world-loading-card button').click()`);
    await until(`document.querySelector('canvas') && document.querySelector('.game-content')?.inert === false`, 'reload recovery');
    console.log('failed download: named error, retry controls and reload recovery passed');
  }

  if (!process.argv.includes('--errors-only') && !process.argv.includes('--app-only')) {
    await page.call('Emulation.setDeviceMetricsOverride', { width: 600, height: 700, deviceScaleFactor: 1, mobile: true });
    await page.call('Page.navigate', { url: `${site}/tests/fixtures/worldLoading.html` });
    await until(`document.querySelector('output')?.dataset.ready === 'true'`, 'fixture startup');
    const initial = await evaluate(`window.worldStats`);
    assert.equal(await evaluate(`JSON.parse(document.querySelector('output').textContent).length`), 8);
    assert.deepEqual(await evaluate('window.checkGround()'), [], 'every prepared town road supports actors even off screen');
    await evaluate(`window.blockedAgain = false; new MutationObserver(() => { if(document.querySelector('[data-world-loading="blocking"]')) window.blockedAgain = true; }).observe(document.body, {childList:true, subtree:true});`);
    for (const id of ['tharsi', 'myothar-area-5', 'kyarinn', 'myothar-area-5']) {
      await evaluate(`document.querySelector('[data-destination="${id}"]').click()`);
      await until(`window.worldStats?.details.some(item => item.name === 'detail-${id === 'myothar-area-5' ? 'myothar' : id}')`, `destination ${id}`);
      assert.ok(await evaluate(`JSON.parse(document.querySelector('output').textContent).every(item => item.phase === 'ready')`));
      assert.deepEqual(await evaluate('window.checkGround()'), [], `road height survives travel to ${id}`);
    }
    const returned = await evaluate('window.worldStats');
    assert.equal(returned.details.find(item => item.name === 'detail-myothar').uuid, initial.details.find(item => item.name === 'detail-myothar').uuid, 'reuse the same built scene');
    assert.equal(returned.geometries, initial.geometries, 'no new geometry uploads on travel');
    assert.ok(returned.details.length <= 1, 'inactive regions are detached');
    await evaluate(`document.querySelector('[data-destination="htomar"]').click(); document.querySelector('[data-destination="chinsai"]').click()`);
    await until(`window.worldStats?.details.some(item => item.name === 'detail-chinsai')`, 'latest destination wins');
    assert.equal(await evaluate(`document.querySelector('output').dataset.failed`), 'false');
    assert.equal(await evaluate('window.blockedAgain'), false, 'never block controls after startup');
    console.log('destinations: all 8 scenes prepared, same cached scene reused, no new GPU geometry and no loading on travel', returned);
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log(`Screenshots: ${artifacts}`);
} finally {
  await browser.call('Target.closeTarget', { targetId });
  page.ws.close();
  browser.ws.close();
}
