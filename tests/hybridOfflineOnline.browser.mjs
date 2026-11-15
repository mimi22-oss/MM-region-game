// Run against built preview server (default http://127.0.0.1:4173) and Chrome CDP port (default 9335):
// node tests/hybridOfflineOnline.browser.mjs [site URL] [debugging port]
import assert from 'node:assert/strict';

const site = process.argv[2] ?? 'http://127.0.0.1:4173';
const debug = `http://127.0.0.1:${process.argv[3] ?? 9335}`;
const siteOrigin = new URL(site).origin;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    } else {
      listeners.get(message.method)?.(message.params);
    }
  };
  return {
    ws,
    on: (event, callback) => listeners.set(event, callback),
    call: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out calling ${method}`));
        }, 60000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      }),
  };
}

const version = await (await fetch(`${debug}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
const targets = await (await fetch(`${debug}/json/list`)).json();
const target = targets.find((t) => t.id === targetId);
assert.ok(target?.webSocketDebuggerUrl, 'Missing CDP target websocket');
const page = await connect(target.webSocketDebuggerUrl);

const runtimeErrors = [];
const blockedExternalRequests = [];

page.on('Runtime.exceptionThrown', (event) => {
  runtimeErrors.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text ?? 'Runtime error');
});

const evalInPage = async (expression) => {
  const result = await page.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
};

async function waitUntil(expression, label, timeout = 180000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evalInPage(expression)) return;
    await sleep(180);
  }
  const diag = await evalInPage(`({
    perf: window.__MM_PERF__ ?? null,
    save: localStorage.getItem('mm-region-game-save-v1'),
    prox: !!document.querySelector('.subshop-proximity-btn'),
    offline: !navigator.onLine,
  })`).catch(() => null);
  throw new Error(`Timed out waiting for ${label}; diag=${JSON.stringify(diag)}; errors=${JSON.stringify(runtimeErrors)}`);
}

const KEY_CODES = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, Escape: 27 };
async function holdKey(code, key, ms) {
  const vk = KEY_CODES[code] ?? 0;
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(ms);
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}

try {
  await page.call('Runtime.enable');
  await page.call('Page.enable');
  await page.call('Network.enable');
  await page.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });

  // Block any external origin at network layer during offline verification so startup proves 100% local
  let blockExternal = true;
  page.on('Fetch.requestPaused', (req) => {
    const url = req.request.url;
    const isLocal = url.startsWith(siteOrigin) || url.startsWith('data:') || url.startsWith('blob:');
    if (!isLocal && blockExternal) {
      blockedExternalRequests.push(url);
      void page.call('Fetch.failRequest', { requestId: req.requestId, errorReason: 'InternetDisconnected' }).catch(() => {});
      return;
    }
    void page.call('Fetch.continueRequest', { requestId: req.requestId }).catch(() => {});
  });

  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: true });

  const startMs = Date.now();
  await page.call('Page.navigate', { url: site });
  await waitUntil(
    `document.querySelector('canvas') && document.querySelector('.game-content')?.inert === false && !document.querySelector('[data-world-loading]')`,
    'offline local bundle ready',
  );
  const startupReadyMs = Date.now() - startMs;

  // Dismiss entry intro cleanly
  await evalInPage(`(() => {
    const skipBtn = document.querySelector('[data-testid="skip-intro-btn"], .cinematic-skip-btn');
    if (skipBtn instanceof HTMLElement) skipBtn.click();
  })()`);
  await waitUntil(`!document.querySelector('[data-testid="cinematic-intro-overlay"], .cinematic-intro-overlay')`, 'intro dismissed', 25000);

  // Confirm initial local perf snapshot and zero external network dependencies
  await waitUntil(`!!window.__MM_PERF__ && typeof window.__MM_PERF__.drawCalls === 'number'`, 'initial perf snapshot', 25000);
  const perfInitial = await evalInPage(`window.__MM_PERF__ ?? null`);
  assert.ok(perfInitial && typeof perfInitial.drawCalls === 'number', 'Expected window.__MM_PERF__ metrics');

  // Walk character near Subscription Billboard (adaptive to software WebGL FPS) and move from initial spawn
  const spawnSave = await evalInPage(`(() => {
    window.dispatchEvent(new Event('pagehide'));
    return JSON.parse(localStorage.getItem('mm-region-game-save-v1') || 'null');
  })()`);
  const readSaveNow = () => evalInPage(`(() => {
    window.dispatchEvent(new Event('pagehide'));
    return JSON.parse(localStorage.getItem('mm-region-game-save-v1') || 'null');
  })()`);

  // Step 1: strafe right clear of the sofa (>= 1.6m from spawn)
  for (let step = 0; step < 8; step++) {
    await holdKey('KeyD', 'd', 700);
    const cur = await readSaveNow();
    if (cur && spawnSave && Math.hypot(cur.x - spawnSave.x, cur.z - spawnSave.z) >= 1.6) break;
  }
  // Step 2: walk forward toward the back wall and step left into billboard proximity (< 4.2m)
  for (let step = 0; step < 12; step++) {
    if (await evalInPage(`!!document.querySelector('.subshop-proximity-btn')`)) break;
    await holdKey('KeyW', 'w', 900);
  }
  if (!(await evalInPage(`!!document.querySelector('.subshop-proximity-btn')`))) {
    for (let step = 0; step < 6; step++) {
      await holdKey('KeyA', 'a', 600);
      if (await evalInPage(`!!document.querySelector('.subshop-proximity-btn')`)) break;
    }
  }
  await sleep(300);

  // Trigger pagehide flush so position save is written deterministically
  const saveBeforeReload = await readSaveNow();
  assert.ok(saveBeforeReload && typeof saveBeforeReload.x === 'number' && typeof saveBeforeReload.z === 'number', 'Expected local position save');
  if (spawnSave) {
    assert.ok(Math.hypot(saveBeforeReload.x - spawnSave.x, saveBeforeReload.z - spawnSave.z) > 0.5, 'Expected character to move from spawn');
  }

  // Simulate Offline network state in WebView/browser
  await evalInPage(`(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  })()`);
  await sleep(150);

  // Multiplayer should reflect offline state
  const mpText = await evalInPage(`document.querySelector('.multiplayer-panel')?.textContent ?? ''`);
  assert.ok(mpText.toLowerCase().includes('offline'), `Expected multiplayer offline indicator, got ${mpText}`);

  // Open Subscription Shop while offline -> must show .subshop-offline-card and NO remote iframe
  await waitUntil(`!!document.querySelector('.subshop-proximity-btn')`, 'proximity button near billboard', 10000);
  await evalInPage(`document.querySelector('.subshop-proximity-btn')?.click()`);
  await waitUntil(`!!document.querySelector('.subshop-offline-card')`, 'offline shop notice card rendered', 5000);
  const iframeWhileOffline = await evalInPage(`!!document.querySelector('.subshop-iframe')`);
  assert.equal(iframeWhileOffline, false, 'Must not mount remote Subscription Shop iframe while offline');
  await evalInPage(`document.querySelector('.subshop-btn-close')?.click()`);
  await waitUntil(`!document.querySelector('.subshop-backdrop')`, 'offline shop modal closed');

  // Verify WebGL context loss/restore keeps single Canvas and shows recovery banner cleanly
  const lossCheck = await evalInPage(`(() => {
    const canvas = document.querySelector('canvas');
    const ev = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented, canvasCount: document.querySelectorAll('canvas').length };
  })()`);
  assert.equal(lossCheck.prevented, true, 'webglcontextlost must call preventDefault()');
  assert.equal(lossCheck.canvasCount, 1, 'Expected single canvas on WebGL loss');
  await waitUntil(`!!document.querySelector('.webgl-recovery-banner')`, 'recovery banner visible');
  await evalInPage(`document.querySelector('canvas')?.dispatchEvent(new Event('webglcontextrestored'))`);
  await waitUntil(`!document.querySelector('.webgl-recovery-banner')`, 'recovery banner cleared');
  assert.equal(await evalInPage(`document.querySelectorAll('canvas').length`), 1, 'No duplicate canvas after WebGL restore');

  // Reload page completely while offline/blocked externally and verify position preserved
  await page.call('Page.reload', { ignoreCache: false });
  await waitUntil(
    `document.querySelector('canvas') && document.querySelector('.game-content')?.inert === false && !document.querySelector('[data-world-loading]')`,
    'reloaded offline scene ready',
  );
  await evalInPage(`(() => {
    const skipBtn = document.querySelector('[data-testid="skip-intro-btn"], .cinematic-skip-btn');
    if (skipBtn instanceof HTMLElement) skipBtn.click();
  })()`);
  await waitUntil(`!document.querySelector('[data-testid="cinematic-intro-overlay"], .cinematic-intro-overlay')`, 'reloaded intro dismissed', 25000);
  await sleep(600);

  const saveAfterReload = await evalInPage(`JSON.parse(localStorage.getItem('mm-region-game-save-v1') || 'null')`);
  assert.ok(saveAfterReload, 'Expected saved position present after reload');
  assert.ok(Math.hypot(saveAfterReload.x - saveBeforeReload.x, saveAfterReload.z - saveBeforeReload.z) < 0.5, 'Expected restored player position close to pre-reload position');

  // Put reloaded page in offline mode first, then verify Retry Connection recovers online mode cleanly
  await evalInPage(`(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  })()`);
  await waitUntil(`!!document.querySelector('.subshop-proximity-btn')`, 'proximity prompt restored after reload', 10000);
  await evalInPage(`document.querySelector('.subshop-proximity-btn')?.click()`);
  await waitUntil(`!!document.querySelector('.subshop-offline-card')`, 'offline card shown before retry', 5000);

  await evalInPage(`(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
    const buttons = Array.from(document.querySelectorAll('.subshop-offline-card button'));
    const retry = buttons.find((b) => b.textContent?.includes('Retry'));
    if (retry instanceof HTMLElement) retry.click();
  })()`);
  await waitUntil(`!document.querySelector('.subshop-offline-card') && !!document.querySelector('.subshop-btn-primary')`, 'online mode restored in Subscription Shop', 5000);
  const shopHref = await evalInPage(`document.querySelector('.subshop-actions a.subshop-btn-primary')?.getAttribute('href')`);
  assert.equal(shopHref, 'https://subscription-app-nine-phi.vercel.app/');

  assert.equal(runtimeErrors.length, 0, `Unexpected runtime errors: ${runtimeErrors.join(' | ')}`);
  console.log(JSON.stringify({
    ok: true,
    startupReadyMs,
    perfInitial,
    saveBeforeReload,
    saveAfterReload,
    blockedExternalRequests: blockedExternalRequests.length,
    shopHref,
  }, null, 2));
} finally {
  try {
    await browser.call('Target.closeTarget', { targetId });
  } catch {}
  browser.ws.close();
}
