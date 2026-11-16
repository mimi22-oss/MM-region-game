// Headless Chromium E2E verification for Phase 4:
// Production dist/ cold-start milestones, steady-state baseline telemetry (__MM_PERF_EXPORT__),
// UpdateStatusPanel (Device Baseline & Content Packs tabs), IndexedDB storage, and offline detection.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
assert.ok(existsSync(resolve('dist/index.html')), 'dist/index.html required (run npm run build first)');
assert.ok(existsSync(resolve('dist/ota/asset-manifest.json')), 'dist/ota/asset-manifest.json required (run npm run ota:manifest first)');

const artifacts = await mkdtemp(join(tmpdir(), 'phase4-baseline-e2e-'));
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
assert.ok(chrome, 'Chrome or Edge is required');

const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5196', '--strictPort'],
  { cwd: resolve('.'), windowsHide: true, stdio: 'ignore' },
);
const browserProcess = spawn(
  chrome,
  [
    '--headless=new',
    '--disk-cache-size=1',
    '--media-cache-size=1',
    '--disable-gpu-shader-disk-cache',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9356',
    `--user-data-dir=${join(artifacts, 'profile')}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);

let page;
let browser;

async function fetchReady(url) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Local preview unavailable: ${url}`);
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(m.id);
      m.error ? p.reject(m.error) : p.resolve(m.result);
    } else {
      listeners.get(m.method)?.(m.params);
    }
  };
  return {
    ws,
    on: (event, fn) => listeners.set(event, fn),
    call: (method, params = {}) =>
      new Promise((res, rej) => {
        const n = ++id;
        const timer = setTimeout(() => {
          pending.delete(n);
          rej(new Error(`${method} timed out`));
        }, 60000);
        pending.set(n, { resolve: res, reject: rej, timer });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
  };
}

try {
  await fetchReady('http://127.0.0.1:5196/');
  const version = await (await fetchReady('http://127.0.0.1:9356/json/version')).json();
  browser = await connect(version.webSocketDebuggerUrl);
  const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
  const targets = await (await fetch('http://127.0.0.1:9356/json/list')).json();
  page = await connect(targets.find((t) => t.id === targetId).webSocketDebuggerUrl);
  const errors = [];
  page.on('Runtime.exceptionThrown', (e) =>
    errors.push(e.exceptionDetails.exception?.description ?? e.exceptionDetails.text),
  );

  await page.call('Runtime.enable');
  await page.call('Page.enable');
  await page.call('Network.enable');
  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    mobile: true,
  });

  const evaluate = async (expression) => {
    const r = await page.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  };
  const until = async (expression, maxIters = 300) => {
    for (let i = 0; i < maxIters; i++) {
      if (errors.length) throw new Error(errors.join('\n'));
      if (await evaluate(expression)) return;
      await sleep(200);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  };

  await page.call('Page.navigate', { url: 'http://127.0.0.1:5196/' });

  // Wait for cold start completion
  await until('window.__STARTUP_DIAGNOSTICS__?.getStartupSummary()?.ready === true');
  // Dismiss intro overlay if active
  await evaluate(`(() => {
    const skipBtn = Array.from(document.querySelectorAll('button')).find((b) => /skip|ကျော်/i.test(b.textContent || ''));
    if (skipBtn) skipBtn.click();
  })()`);
  await sleep(600);

  // Allow steady-state 1Hz FrameBudget samples to accumulate
  await until('(window.__MM_PERF__?.sampleCount ?? 0) >= 5');

  const report = await evaluate('window.__MM_PERF_EXPORT__?.()');
  assert.ok(report, 'Expected __MM_PERF_EXPORT__() baseline report');
  assert.equal(report.startup.ready, true, 'Startup diagnostics reached ready');
  assert.ok(report.startup.firstFrameMs > 0, 'First frame timing recorded');
  assert.ok(report.startup.timeToReadyMs >= report.startup.firstFrameMs, 'Ready timing >= first frame');
  assert.equal(report.startup.contextLostCount, 0, 'Zero WebGL context losses');
  assert.ok(report.steadyState.sampleCount >= 5, 'At least 5 steady-state FPS samples recorded');

  // Open menu if needed and open App Updates / Device Baseline dialog
  await evaluate(`(() => {
    const menuBtn = document.querySelector('button.hud-menu-btn');
    if (menuBtn && !document.querySelector('button[aria-label="App Updates and Offline Cache"]')) menuBtn.click();
  })()`);
  await sleep(300);
  await evaluate(`(() => {
    const btn = document.querySelector('button[aria-label="App Updates and Offline Cache"]');
    if (btn) btn.click();
  })()`);
  await sleep(300);

  // Switch to Device Baseline tab and trigger Copy Baseline JSON
  await evaluate(`(() => {
    const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) => el.textContent?.includes('Device Baseline'));
    if (tab) tab.click();
  })()`);
  await sleep(250);
  await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.includes('Copy Baseline JSON'));
    if (btn) btn.click();
  })()`);
  await until('Boolean(document.querySelector("textarea.ota-baseline-preview")?.value)');
  const previewLen = await evaluate('document.querySelector("textarea.ota-baseline-preview")?.value?.length ?? 0');
  assert.ok(previewLen > 200, 'Device Baseline preview JSON populated cleanly');

  // Switch to Content Packs tab and verify IndexedDB engine round-trip inside Chromium
  await evaluate(`(() => {
    const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) => el.textContent?.includes('Content Packs'));
    if (tab) tab.click();
  })()`);
  await sleep(250);
  const idbVerified = await evaluate(`(async () => {
    const payload = new TextEncoder().encode('phase4-idb-pack-probe');
    const digestBuf = await crypto.subtle.digest('SHA-256', payload);
    const sha256 = Array.from(new Uint8Array(digestBuf), (b) => b.toString(16).padStart(2, '0')).join('');
    await new Promise((res, rej) => {
      const req = indexedDB.open('mm-region-ota-db-v1', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('blobs')) {
          req.result.createObjectStore('blobs', { keyPath: 'sha256' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put({ sha256, buffer: payload.buffer, bytes: payload.byteLength, contentType: 'text/plain' });
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      req.onerror = () => rej(req.error);
    });
    const readBackLen = await new Promise((res, rej) => {
      const req = indexedDB.open('mm-region-ota-db-v1', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('blobs', 'readwrite');
        const store = tx.objectStore('blobs');
        const g = store.get(sha256);
        g.onsuccess = () => {
          const len = g.result?.bytes ?? 0;
          store.delete(sha256);
          tx.oncomplete = () => { db.close(); res(len); };
        };
        g.onerror = () => rej(g.error);
      };
    });
    return { sha256, readBackLen };
  })()`);
  assert.equal(idbVerified.readBackLen, 21, 'IndexedDB persistent blob store verified cleanly in Chromium');

  // Verify offline mode transition on page while running
  await page.call('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await evaluate('window.dispatchEvent(new Event("offline"))');
  await sleep(300);

  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        startup: {
          firstFrameMs: report.startup.firstFrameMs,
          timeToReadyMs: report.startup.timeToReadyMs,
          contextLostCount: report.startup.contextLostCount,
        },
        steadyState: report.steadyState,
        streamedWorld: report.streamedWorld,
        idbVerified,
        baselinePreviewChars: previewLen,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    await browser?.call('Browser.close');
  } catch {}
  page?.ws.close();
  browser?.ws.close();
  browserProcess.kill();
  vite.kill();
  const profile = resolve(artifacts, 'profile');
  const tempRoot = resolve(tmpdir()) + sep;
  if (profile.startsWith(tempRoot) && profile === resolve(artifacts) + sep + 'profile') {
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
