// Run against Vite dev server (default http://127.0.0.1:4173) and headless Chrome debugging port (default 9335):
// node tests/subscriptionShop.browser.mjs [site URL] [debugging port] [screenshot dir]
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const site = process.argv[2] ?? 'http://127.0.0.1:4173';
const debug = `http://127.0.0.1:${process.argv[3] ?? 9335}`;
const screenshotDir = process.argv[4] ?? join(tmpdir(), 'myanmar-subshop-qa');
await mkdir(screenshotDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_SHOP_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Subscription Shop Fixture</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #0b1220; color: #f8fafc; }
    .hero { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #1e293b; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 16px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
    button { background: #0284c7; color: #fff; border: 0; border-radius: 8px; padding: 9px 15px; cursor: pointer; font-weight: 600; }
    input { padding: 9px 11px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; margin-right: 8px; min-width: 210px; }
    .status-pill { display: inline-block; padding: 5px 10px; border-radius: 999px; background: rgba(16,185,129,0.18); color: #6ee7b7; font-size: 13px; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="hero">
    <div>
      <h1 id="shop-heading" style="margin:0 0 4px;">Subscription Link Storefront</h1>
      <div style="color:#94a3b8;font-size:14px;">Digital Accounts, AI Subscriptions & Instant Delivery (MMK)</div>
    </div>
    <form id="login-form" onsubmit="event.preventDefault(); document.getElementById('session-status').textContent = 'Signed in: ' + document.getElementById('account-input').value;">
      <input id="account-input" type="text" placeholder="Enter username (test wasd/n keys)" />
      <button id="login-btn" type="submit">Sign In</button>
      <span id="session-status" class="status-pill">Guest</span>
    </form>
  </div>
  <div class="grid">
    <div class="card">
      <h3>ChatGPT Plus (1 Month)</h3>
      <p>MMK 58,000 · Private Shared / Personal</p>
      <button id="order-btn" type="button" onclick="document.getElementById('order-status').textContent = 'Ordered: ChatGPT Plus';">Order Now</button>
    </div>
    <div class="card">
      <h3>YouTube Premium Family</h3>
      <p>MMK 12,000 · Ad-Free + Music</p>
      <button type="button" onclick="document.getElementById('order-status').textContent = 'Ordered: YouTube Premium';">Order Now</button>
    </div>
    <div class="card">
      <h3>Canva Pro Team</h3>
      <p>MMK 15,000 · Brand Kit + AI</p>
      <button type="button" onclick="document.getElementById('order-status').textContent = 'Ordered: Canva Pro';">Order Now</button>
    </div>
  </div>
  <p id="order-status" style="margin-top:18px;font-weight:600;color:#7dd3fc;">No order placed</p>
</body>
</html>`;

const mockServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(MOCK_SHOP_HTML);
});
await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
const mockPort = mockServer.address().port;
const mockShopUrl = `http://127.0.0.1:${mockPort}/`;

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(message.error);
      else request.resolve(message.result);
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
page.on('Runtime.exceptionThrown', (event) => {
  runtimeErrors.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text ?? 'Runtime error');
});

const evalInPage = async (expression, contextId) => {
  const result = await page.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    ...(contextId ? { contextId } : {}),
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
    canvas: !!document.querySelector('canvas'),
    inert: document.querySelector('.game-content')?.inert ?? null,
    loadingText: document.querySelector('[data-world-loading]')?.textContent ?? null,
    bodyText: document.body.innerText.slice(0, 300),
  })`).catch(() => null);
  throw new Error(`Timed out waiting for ${label}; diag=${JSON.stringify(diag)}; errors=${JSON.stringify(runtimeErrors)}`);
}

async function screenshot(name) {
  const shot = await page.call('Page.captureScreenshot', { format: 'png' });
  const filePath = join(screenshotDir, `${name}.png`);
  await writeFile(filePath, Buffer.from(shot.data, 'base64'));
  return filePath;
}

async function dismissIntroIfPresent() {
  await evalInPage(`(() => {
    const skipBtn = document.querySelector('[data-testid="skip-intro-btn"], .cinematic-skip-btn');
    if (skipBtn instanceof HTMLElement) skipBtn.click();
  })()`);
  await waitUntil(
    `!document.querySelector('[data-testid="cinematic-intro-overlay"], .cinematic-intro-overlay')`,
    'intro overlay dismissed',
    25000,
  );
}

const KEY_CODES = {
  KeyW: 87,
  KeyA: 65,
  KeyS: 83,
  KeyD: 68,
  KeyE: 69,
  KeyN: 78,
  Escape: 27,
};

async function holdKey(code, key, ms) {
  const vk = KEY_CODES[code] ?? 0;
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(ms);
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}

async function typeKeys(text) {
  for (const ch of text) {
    const upper = ch.toUpperCase();
    const code = ch === ' ' ? 'Space' : `Key${upper}`;
    const vk = ch === ' ' ? 32 : upper.charCodeAt(0);
    await page.call('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code,
      key: ch,
      text: ch,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    });
    await page.call('Input.dispatchKeyEvent', {
      type: 'keyUp',
      code,
      key: ch,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    });
    await sleep(40);
  }
}

async function tapTouch(x, y) {
  await page.call('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await sleep(45);
  await page.call('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

function findDomNode(node, pred) {
  if (!node) return null;
  if (pred(node)) return node;
  for (const child of node.children ?? []) {
    const hit = findDomNode(child, pred);
    if (hit) return hit;
  }
  if (node.contentDocument) {
    const hit = findDomNode(node.contentDocument, pred);
    if (hit) return hit;
  }
  return null;
}

try {
  await page.call('Runtime.enable');
  await page.call('Page.enable');
  await page.call('DOM.enable');
  await page.call('Network.enable');
  await page.call('Network.setCacheDisabled', { cacheDisabled: true });

  // -------------------------------------------------------------------------
  // 1. Desktop E2E Flow (1280x800) - Pass A: Live URL & Billboard Click
  // -------------------------------------------------------------------------
  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await page.call('Page.navigate', { url: site });
  await waitUntil(
    `document.querySelector('canvas') && document.querySelector('.game-content')?.inert === false && !document.querySelector('[data-world-loading]')`,
    'desktop world ready',
  );
  await dismissIntroIfPresent();
  await sleep(600);

  // Walk around the sofa into the open living room walkway toward the back wall billboard (< 5m)
  await holdKey('KeyD', 'd', 1800);
  await holdKey('KeyW', 'w', 3800);
  await holdKey('KeyA', 'a', 1500);
  await sleep(300);

  const near = await evalInPage(`!!document.querySelector('.subshop-proximity-btn')`);
  const desktopBeforeShot = await screenshot('desktop-world-billboard');
  const posBefore = await evalInPage(`document.querySelector('.subshop-proximity-copy span')?.textContent ?? ''`);
  const canvasCountBefore = await evalInPage(`document.querySelectorAll('canvas').length`);
  assert.equal(canvasCountBefore, 1, 'Expected single WebGL Canvas mounted');

  async function clickBillboardDesktop() {
    const clickGrid = [
      [460, 145], [430, 145], [490, 145], [390, 145], [520, 145],
      [460, 115], [360, 145], [340, 145], [550, 145], [430, 175],
      [520, 210], [640, 220], [380, 210], [640, 150], [310, 145],
    ];
    for (const [cx, cy] of clickGrid) {
      await evalInPage(`if (document.pointerLockElement) document.exitPointerLock();`);
      await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
      await sleep(40);
      await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
      await sleep(180);
      if (await evalInPage(`!!document.querySelector('.subshop-backdrop')`)) {
        return [cx, cy];
      }
    }
    return null;
  }

  const hitDesktopPoint = await clickBillboardDesktop();
  assert.ok(hitDesktopPoint, 'Clicking directly on the rendered 3D Subscription Billboard should open the dialog');

  await waitUntil(`!!document.querySelector('.subshop-backdrop')`, 'Subscription Shop dialog open', 10000);
  await sleep(1000);

  const liveDialogInfo = await evalInPage(`(() => {
    const iframe = document.querySelector('.subshop-iframe');
    const ext = document.querySelector('a.subshop-btn-primary');
    return {
      iframeSrc: iframe?.getAttribute('src') ?? null,
      externalHref: ext?.getAttribute('href') ?? null,
      externalRel: ext?.getAttribute('rel') ?? null,
      externalTarget: ext?.getAttribute('target') ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
      loadingVisible: !!document.querySelector('[data-world-loading]'),
    };
  })()`);
  assert.equal(liveDialogInfo.iframeSrc, 'https://subscription-app-nine-phi.vercel.app/');
  assert.equal(liveDialogInfo.externalHref, 'https://subscription-app-nine-phi.vercel.app/');
  assert.equal(liveDialogInfo.externalTarget, '_blank');
  assert.ok(liveDialogInfo.externalRel?.includes('noopener'));
  assert.equal(liveDialogInfo.canvasCount, 1);
  assert.equal(liveDialogInfo.loadingVisible, false);

  const desktopLiveDialogShot = await screenshot('desktop-live-dialog');

  // Verify Fallback View toggle works cleanly
  await evalInPage(`(() => {
    const btn = document.querySelector('.subshop-notice-link');
    if (btn instanceof HTMLElement) btn.click();
  })()`);
  await waitUntil(`!!document.querySelector('.subshop-fallback-card')`, 'fallback view card shown');
  const desktopFallbackShot = await screenshot('desktop-fallback-card');

  // Close with Escape
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape', windowsVirtualKeyCode: 27 });
  await waitUntil(`!document.querySelector('.subshop-backdrop')`, 'dialog closed via Escape');

  // -------------------------------------------------------------------------
  // 2. Pass B: Embeddable Storefront Flow Inside Iframe (Typing, Login, Order)
  // -------------------------------------------------------------------------
  await evalInPage(`if (document.pointerLockElement) document.exitPointerLock();`);
  await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: hitDesktopPoint[0], y: hitDesktopPoint[1], button: 'left', clickCount: 1 });
  await sleep(40);
  await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hitDesktopPoint[0], y: hitDesktopPoint[1], button: 'left', clickCount: 1 });
  await waitUntil(`!!document.querySelector('.subshop-iframe')`, 'embed dialog re-opened', 10000);
  await sleep(300);

  // Point the mounted iframe inside the dialog to the embeddable local storefront fixture
  const getIframeContextId = async () => {
    const updatedRoot = (await page.call('DOM.getDocument', { depth: -1, pierce: true })).root;
    const iframeNode = findDomNode(updatedRoot, (n) => n.nodeName === 'IFRAME' && n.attributes?.includes('subshop-iframe'));
    if (!iframeNode?.frameId) return null;
    const world = await page.call('Page.createIsolatedWorld', { frameId: iframeNode.frameId, worldName: 'subshop-qa' });
    return world.executionContextId;
  };
  const evalInIframe = async (expr) => {
    try {
      return await evalInPage(expr, iframeContextId);
    } catch (err) {
      if (err && err.code === -32000) {
        iframeContextId = await getIframeContextId();
        return await evalInPage(expr, iframeContextId);
      }
      throw err;
    }
  };

  let iframeContextId = null;
  let lastIframeDebug = null;
  let lastIframeError = null;
  const iframeDeadline = Date.now() + 20000;
  while (Date.now() < iframeDeadline) {
    await evalInPage(`(() => {
      const f = document.querySelector('.subshop-iframe');
      if (f && f.getAttribute('src') !== ${JSON.stringify(mockShopUrl)}) {
        f.setAttribute('src', ${JSON.stringify(mockShopUrl)});
      }
    })()`).catch(() => {});
    try {
      const ctxId = await getIframeContextId();
      if (ctxId) {
        lastIframeDebug = await evalInPage(
          `({ href: location.href, ready: document.readyState, heading: document.getElementById('shop-heading')?.textContent ?? null })`,
          ctxId,
        );
        if (lastIframeDebug.href.startsWith(mockShopUrl) && lastIframeDebug.ready === 'complete' && lastIframeDebug.heading === 'Subscription Link Storefront') {
          iframeContextId = ctxId;
          break;
        }
      }
    } catch (err) {
      lastIframeError = String(err?.message ?? err);
    }
    await sleep(250);
  }
  assert.ok(iframeContextId, `Expected embeddable storefront iframe to load, last state: ${JSON.stringify(lastIframeDebug)}, last error: ${lastIframeError}`);

  const isNightBefore = await evalInPage(`document.querySelector('main')?.classList.contains('night-mode') ?? false`);

  // Focus #account-input inside iframe using real bounding coordinates + real CDP typing ("wasd nm")
  const inputPos = await evalInPage(`(() => {
    const frame = document.querySelector('.subshop-iframe').getBoundingClientRect();
    return { fl: frame.left, ft: frame.top };
  })()`);
  const innerCoords = await evalInIframe(`(() => {
    const r = document.getElementById('account-input').getBoundingClientRect();
    const btn = document.getElementById('login-btn').getBoundingClientRect();
    const ord = document.getElementById('order-btn').getBoundingClientRect();
    return {
      ix: Math.round(r.left + r.width / 2),
      iy: Math.round(r.top + r.height / 2),
      bx: Math.round(btn.left + btn.width / 2),
      by: Math.round(btn.top + btn.height / 2),
      ox: Math.round(ord.left + ord.width / 2),
      oy: Math.round(ord.top + ord.height / 2),
    };
  })()`);

  const clickViewport = async (vx, vy) => {
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: vx, y: vy, button: 'left', clickCount: 1 });
    await sleep(30);
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: vx, y: vy, button: 'left', clickCount: 1 });
  };

  await clickViewport(Math.round(inputPos.fl + innerCoords.ix), Math.round(inputPos.ft + innerCoords.iy));
  await sleep(120);
  await typeKeys('wasd nm');
  for (let i = 0; i < 10; i++) {
    const val = await evalInIframe(`document.getElementById('account-input')?.value`);
    if (val === 'wasd nm') break;
    await sleep(50);
  }
  await clickViewport(Math.round(inputPos.fl + innerCoords.bx), Math.round(inputPos.ft + innerCoords.by));
  await sleep(50);
  await clickViewport(Math.round(inputPos.fl + innerCoords.ox), Math.round(inputPos.ft + innerCoords.oy));

  // Verify real KeyN outside input does NOT cycle night-mode while dialog is open
  await evalInPage(`document.querySelector('.subshop-btn-close')?.focus()`);
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyN', key: 'n', windowsVirtualKeyCode: 78 });
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyN', key: 'n', windowsVirtualKeyCode: 78 });

  const iframeResult = await evalInIframe(`({
    session: document.getElementById('session-status')?.textContent,
    order: document.getElementById('order-status')?.textContent,
  })`);
  assert.equal(iframeResult.session, 'Signed in: wasd nm');
  assert.equal(iframeResult.order, 'Ordered: ChatGPT Plus');

  const isNightDuring = await evalInPage(`document.querySelector('main')?.classList.contains('night-mode') ?? false`);
  assert.equal(isNightDuring, isNightBefore, 'KeyN must not toggle night-mode while dialog is open');

  const desktopEmbedShot = await screenshot('desktop-embedded-shop');

  // Close using visible Close button and confirm position & Canvas preserved
  await evalInPage(`document.querySelector('.subshop-btn-close')?.click()`);
  await waitUntil(`!document.querySelector('.subshop-backdrop')`, 'dialog closed via button');

  const posAfter = await evalInPage(`document.querySelector('.subshop-proximity-copy span')?.textContent ?? ''`);
  assert.equal(posAfter, posBefore, 'Player proximity state must remain preserved after closing dialog');
  assert.equal(await evalInPage(`document.querySelectorAll('canvas').length`), 1, 'Canvas preserved');

  // -------------------------------------------------------------------------
  // 3. Mobile Responsive Flow (390x844, touch)
  // -------------------------------------------------------------------------
  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    hasTouch: true,
  });
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await sleep(450);

  const mobileBeforeShot = await screenshot('mobile-world-billboard');

  let mobileOpened = false;
  if (await evalInPage(`!!document.querySelector('.subshop-proximity-btn')`)) {
    const rect = await evalInPage(`(() => {
      const r = document.querySelector('.subshop-proximity-btn').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await tapTouch(rect.x, rect.y);
    await sleep(200);
    mobileOpened = await evalInPage(`!!document.querySelector('.subshop-backdrop')`);
  }
  if (!mobileOpened) {
    const mobileTapGrid = [
      [35, 145], [45, 145], [25, 145], [55, 145], [35, 175],
      [60, 170], [20, 120], [140, 220], [195, 220], [110, 180],
    ];
    for (const [mx, my] of mobileTapGrid) {
      await tapTouch(mx, my);
      await sleep(180);
      if (await evalInPage(`!!document.querySelector('.subshop-backdrop')`)) {
        mobileOpened = true;
        break;
      }
    }
  }
  assert.ok(mobileOpened, 'Mobile tap should open Subscription Shop dialog');

  await waitUntil(`!!document.querySelector('.subshop-iframe')`, 'mobile dialog opened', 8000);
  await sleep(250);
  await evalInPage(`(() => {
    const f = document.querySelector('.subshop-iframe');
    if (f) f.setAttribute('src', ${JSON.stringify(mockShopUrl)});
  })()`);
  await sleep(900);

  const mobileDims = await evalInPage(`(() => {
    const m = document.querySelector('.subshop-modal').getBoundingClientRect();
    return { w: Math.round(m.width), h: Math.round(m.height), iw: window.innerWidth, ih: window.innerHeight };
  })()`);
  assert.equal(mobileDims.w, mobileDims.iw, 'Mobile modal width must fill screen width');
  assert.equal(mobileDims.h, mobileDims.ih, 'Mobile modal height must fill screen height');

  const mobileDialogShot = await screenshot('mobile-fullscreen-shop');
  await evalInPage(`document.querySelector('.subshop-btn-close')?.click()`);
  await waitUntil(`!document.querySelector('.subshop-backdrop')`, 'mobile dialog closed');

  assert.equal(runtimeErrors.length, 0, `Unexpected runtime errors: ${runtimeErrors.join(' | ')}`);
  console.log(JSON.stringify({
    ok: true,
    nearPromptDetected: near,
    hitDesktopPoint,
    liveDialogInfo,
    iframeResult,
    mobileDims,
    screenshots: {
      desktopBeforeShot,
      desktopLiveDialogShot,
      desktopFallbackShot,
      desktopEmbedShot,
      mobileBeforeShot,
      mobileDialogShot,
    },
  }, null, 2));
} finally {
  try {
    await browser.call('Target.closeTarget', { targetId });
  } catch {
    // Ignore close errors
  }
  browser.ws.close();
  mockServer.closeAllConnections?.();
  mockServer.close();
}
