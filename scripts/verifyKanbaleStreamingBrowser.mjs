// Headless Chromium E2E test for Phase 3 Kanbale versioned chunk streaming:
// Spawn (unloaded) -> Teleport to Kanbale -> Travel East -> Teleport back to Myothar (unload) -> Return (reuse)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const artifacts = await mkdtemp(join(tmpdir(), 'kanbale-streaming-e2e-'));
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
assert.ok(chrome, 'Chrome or Edge is required');

const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5194', '--strictPort'],
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
    '--remote-debugging-port=9354',
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
  throw new Error(`Local server unavailable: ${url}`);
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
  await fetchReady('http://127.0.0.1:5194/tests/fixtures/worldPerformance.html');
  const version = await (await fetchReady('http://127.0.0.1:9354/json/version')).json();
  browser = await connect(version.webSocketDebuggerUrl);
  const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
  const targets = await (await fetch('http://127.0.0.1:9354/json/list')).json();
  page = await connect(targets.find((t) => t.id === targetId).webSocketDebuggerUrl);
  const errors = [];
  page.on('Runtime.exceptionThrown', (e) =>
    errors.push(e.exceptionDetails.exception?.description ?? e.exceptionDetails.text),
  );
  page.on('Runtime.consoleAPICalled', (e) => {
    if (e.type === 'error') errors.push(e.args.map((a) => a.value ?? a.description).join(' '));
  });
  await page.call('Runtime.enable');
  await page.call('Page.enable');
  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
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
  const until = async (expression) => {
    for (let i = 0; i < 450; i++) {
      if (errors.length) throw new Error(errors.join('\n'));
      if (await evaluate(expression)) return;
      await sleep(200);
    }
    const diag = await evaluate('({loading:window.perfLoading,sample:window.perfSample,error:window.perfError})');
    throw new Error(`Timed out: ${expression} state=${JSON.stringify(diag)}`);
  };

  console.error('[e2e] navigating...');
  await page.call('Page.navigate', {
    url: 'http://127.0.0.1:5194/tests/fixtures/worldPerformance.html',
  });
  console.error('[e2e] waiting for spawn ready...');
  await until('window.perfLoading?.blocking === false');
  console.error('[e2e] spawn ready!');
  await sleep(1200);

  // 1. Spawn in Myothar: 0 Kanbale chunks loaded
  const atSpawn = await evaluate('window.perfSample');
  console.error('[e2e] atSpawn:', JSON.stringify(atSpawn.kanbaleChunks));
  assert.deepEqual(atSpawn.kanbaleChunks, [], 'no Kanbale chunks mounted at Myothar spawn');
  assert.equal(atSpawn.streamedStats.residentChunks, 0);
  assert.equal(atSpawn.streamedStats.buildingColliders, 0);
  assert.equal(atSpawn.poolStats.totalRefs, 0);

  // 2. Teleport to Kanbale Farmhouse / School (458.67, -464.24)
  console.error('[e2e] teleporting to Kanbale West...');
  await evaluate('window.perfView(458.67, -464.24, 30)');
  await until('(window.perfSample?.kanbaleChunks?.length ?? 0) >= 1 && (window.perfSample?.streamedStats?.buildingColliders ?? 0) > 0');
  await sleep(1200);
  const atKanbaleWest = await evaluate('window.perfSample');
  console.error('[e2e] atKanbaleWest:', JSON.stringify({ chunks: atKanbaleWest.kanbaleChunks, colliders: atKanbaleWest.streamedStats.buildingColliders }));
  assert.ok(atKanbaleWest.kanbaleChunks.length >= 1 && atKanbaleWest.kanbaleChunks.length <= 4, 'bounded desktop Kanbale tiles mounted');
  assert.ok(atKanbaleWest.kanbaleLandmarks.includes('kanbale-custom-farmhouse'), 'custom Farmhouse TSX landmark preserved');
  assert.ok(atKanbaleWest.streamedStats.buildingColliders > 0, 'streamed building collision registered');
  assert.ok(atKanbaleWest.streamedStats.roadPlots > 0, 'streamed road plots registered for bots');

  // 3. Move to East Kanbale (1385, -804) -> loads East chunks & reuses shared pool assets
  console.error('[e2e] moving to Kanbale East...');
  await evaluate('window.perfView(1385, -804, 30)');
  await until('(window.perfSample?.poolStats?.reuseHits ?? 0) > 0');
  await sleep(1000);
  const atKanbaleEast = await evaluate('window.perfSample');
  console.error('[e2e] atKanbaleEast:', JSON.stringify({ chunks: atKanbaleEast.kanbaleChunks, reuseHits: atKanbaleEast.poolStats.reuseHits }));
  assert.ok(atKanbaleEast.kanbaleChunks.length >= 1 && atKanbaleEast.kanbaleChunks.length <= 4);
  assert.ok(atKanbaleEast.poolStats.reuseHits > 0, 'shared pool geometries/materials reused across chunks');

  // 4. Teleport back to Myothar ward.spawn (139.87, 239.14) -> Kanbale chunks unmount, colliders & pool refs release cleanly
  console.error('[e2e] teleporting back to spawn...');
  await evaluate('window.perfView(139.87, 239.14, 25)');
  await until('(window.perfSample?.kanbaleChunks?.length ?? 0) === 0');
  await sleep(800);
  const afterReturn = await evaluate('window.perfSample');
  console.error('[e2e] afterReturn:', JSON.stringify({ chunks: afterReturn.kanbaleChunks, poolRefs: afterReturn.poolStats.totalRefs }));
  assert.deepEqual(afterReturn.kanbaleChunks, [], 'all Kanbale chunks unloaded after teleport back to spawn');
  assert.equal(afterReturn.streamedStats.residentChunks, 0, 'streamed registry cleared on unload');
  assert.equal(afterReturn.streamedStats.buildingColliders, 0, 'building colliders released');
  assert.equal(afterReturn.streamedStats.labels, 0, 'streamed labels released');
  assert.equal(afterReturn.poolStats.totalRefs, 0, 'all pool refs released cleanly');
  assert.equal(afterReturn.poolStats.geometriesActive, 0, 'shared pool geometries disposed cleanly when idle');
  assert.equal(afterReturn.poolStats.materialsActive, 0, 'shared pool materials disposed cleanly when idle');

  // 5. Teleport back to Kanbale West -> chunks re-mount cleanly
  await evaluate('window.perfView(458.67, -464.24, 30)');
  await until('(window.perfSample?.kanbaleChunks?.length ?? 0) >= 1 && (window.perfSample?.streamedStats?.buildingColliders ?? 0) > 0');
  const secondVisit = await evaluate('window.perfSample');
  assert.deepEqual(errors, []);

  console.log(
    JSON.stringify(
      {
        passed: true,
        atSpawn: { chunks: atSpawn.kanbaleChunks.length, colliders: atSpawn.streamedStats.buildingColliders, poolGeos: atSpawn.poolStats.geometriesActive },
        atKanbaleWest: { chunks: atKanbaleWest.kanbaleChunks, landmarks: atKanbaleWest.kanbaleLandmarks, colliders: atKanbaleWest.streamedStats.buildingColliders, calls: atKanbaleWest.calls, tris: atKanbaleWest.triangles },
        atKanbaleEast: { chunks: atKanbaleEast.kanbaleChunks, reuseHits: atKanbaleEast.poolStats.reuseHits, activeGeos: atKanbaleEast.poolStats.geometriesActive },
        afterReturn: { chunks: afterReturn.kanbaleChunks.length, colliders: afterReturn.streamedStats.buildingColliders, poolRefs: afterReturn.poolStats.totalRefs, activeGeos: afterReturn.poolStats.geometriesActive },
        secondVisit: { chunks: secondVisit.kanbaleChunks, colliders: secondVisit.streamedStats.buildingColliders },
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
