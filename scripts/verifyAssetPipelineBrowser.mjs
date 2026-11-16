import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MANIFEST_PATH = resolve('content/manifests/assets.v2.json');
const VISUAL_OUT = resolve('artifacts/phase2-pipeline/visual');
fs.mkdirSync(VISUAL_OUT, { recursive: true });

if (!fs.existsSync(MANIFEST_PATH)) {
  throw new Error('Run `node --experimental-strip-types pipelines/asset-optimize/runPipeline.mjs` first.');
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const findUrl = (assetId, lod = 0) => {
  const entry = manifest.assets.find((a) => a.assetId === assetId);
  const lodEntry = entry?.lods?.find((l) => l.level === lod);
  if (!lodEntry?.url) throw new Error(`Missing LOD${lod} url for ${assetId}`);
  return '/' + lodEntry.url.replace(/^\/+/, '');
};

const PAIRS = [
  {
    id: 'boy',
    beforeUrl: '/src/assets/boy.glb',
    afterUrl: findUrl('character:boy-base', 0),
    // boy textures clamp 4096->1024 + WebP re-encode; tiny texel differences allowed
    maxMeanDiff: 6.0,
  },
  {
    id: 'girl',
    beforeUrl: '/src/assets/girl.glb',
    afterUrl: findUrl('character:girl-base', 0),
    maxMeanDiff: 6.0,
  },
  {
    id: 'ghost-woman',
    beforeUrl: '/public/models/ghost-woman.glb',
    afterUrl: findUrl('character:ghost-woman', 0),
    maxMeanDiff: 6.0,
  },
  {
    id: 'canolia-character',
    beforeUrl: '/public/models/canolia-character.glb',
    afterUrl: findUrl('character:canolia-animated', 0),
    maxMeanDiff: 1.5,
  },
  {
    id: 'canolia-blend-lod1',
    beforeUrl: findUrl('character:canolia-reference-animated', 0),
    afterUrl: findUrl('character:canolia-reference-animated', 1),
    maxMeanDiff: 8.0,
  },
];

const profile = await mkdtemp(join(tmpdir(), 'asset-visual-'));
const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198', '--strictPort'],
  { windowsHide: true, stdio: 'ignore' }
);
const chrome = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--no-first-run',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--remote-debugging-port=9358',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' }
);

let ws;
try {
  let tabs;
  for (let i = 0; i < 80; i++) {
    try {
      tabs = await (await fetch('http://127.0.0.1:9358/json/list')).json();
      await fetch('http://127.0.0.1:5198/');
      break;
    } catch {}
    await sleep(200);
  }
  const blank = tabs.find((t) => t.type === 'page' && t.url === 'about:blank') || tabs[0];
  ws = new WebSocket(blank.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(m.id);
        m.error ? p.reject(m.error) : p.resolve(m.result);
      }
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails);
    }
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 60000);
      pending.set(n, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) =>
    (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 400, height: 400, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: 'http://127.0.0.1:5198/candle-preview.html' });
  await sleep(600);

  const report = [];
  for (const pair of PAIRS) {
    const res = await evaluate(`(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      async function renderUrl(url) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(256, 256, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#222a36');
        const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
        const dir = new THREE.DirectionalLight('#ffffff', 2.0);
        dir.position.set(2, 4, 3);
        scene.add(dir, new THREE.AmbientLight('#dbeafe', 1.1));
        const loader = new GLTFLoader();
        const t0 = performance.now();
        const gltf = await loader.loadAsync(url + '?t=' + Date.now());
        scene.add(gltf.scene);
        gltf.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.1);
        cam.position.set(center.x, center.y + maxDim * 0.15, center.z + maxDim * 2.1);
        cam.lookAt(center);
        renderer.render(scene, cam);
        const totalMs = Number((performance.now() - t0).toFixed(2));
        const gl = renderer.getContext();
        const pixels = new Uint8Array(256 * 256 * 4);
        gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const dataUrl = canvas.toDataURL('image/png');
        const memInfo = { ...renderer.info.memory, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
        renderer.dispose();
        return { totalMs, pixels: Array.from(pixels), dataUrl, memInfo, size: { x: size.x, y: size.y, z: size.z } };
      }
      const before = await renderUrl(${JSON.stringify(pair.beforeUrl)});
      const after = await renderUrl(${JSON.stringify(pair.afterUrl)});
      let absDiff = 0;
      let nonEmptyBefore = 0;
      let nonEmptyAfter = 0;
      for (let i = 0; i < before.pixels.length; i += 4) {
        const bBg = Math.abs(before.pixels[i] - 34) <= 2 && Math.abs(before.pixels[i+1] - 42) <= 2 && Math.abs(before.pixels[i+2] - 54) <= 2;
        const aBg = Math.abs(after.pixels[i] - 34) <= 2 && Math.abs(after.pixels[i+1] - 42) <= 2 && Math.abs(after.pixels[i+2] - 54) <= 2;
        if (!bBg) nonEmptyBefore++;
        if (!aBg) nonEmptyAfter++;
        absDiff += Math.abs(before.pixels[i] - after.pixels[i]) + Math.abs(before.pixels[i+1] - after.pixels[i+1]) + Math.abs(before.pixels[i+2] - after.pixels[i+2]);
      }
      const meanChannelDiff = Number((absDiff / (256 * 256 * 3)).toFixed(3));
      return {
        beforeMs: before.totalMs,
        afterMs: after.totalMs,
        beforeMem: before.memInfo,
        afterMem: after.memInfo,
        beforeSize: before.size,
        afterSize: after.size,
        silhouettePixelsBefore: nonEmptyBefore,
        silhouettePixelsAfter: nonEmptyAfter,
        meanChannelDiff,
        beforePng: before.dataUrl,
        afterPng: after.dataUrl
      };
    })()`);

    fs.writeFileSync(
      join(VISUAL_OUT, `${pair.id}-before.png`),
      Buffer.from(res.beforePng.replace(/^data:image\/png;base64,/, ''), 'base64'),
    );
    fs.writeFileSync(
      join(VISUAL_OUT, `${pair.id}-after.png`),
      Buffer.from(res.afterPng.replace(/^data:image\/png;base64,/, ''), 'base64'),
    );
    assert.ok(res.silhouettePixelsAfter > 500, `${pair.id} rendered visible pixels (${res.silhouettePixelsAfter})`);
    assert.ok(
      res.meanChannelDiff <= pair.maxMeanDiff,
      `${pair.id} mean pixel diff ${res.meanChannelDiff} <= ${pair.maxMeanDiff}`,
    );
    report.push({
      id: pair.id,
      beforeMs: res.beforeMs,
      afterMs: res.afterMs,
      beforeTris: res.beforeMem.tris,
      afterTris: res.afterMem.tris,
      silhouettePixelsBefore: res.silhouettePixelsBefore,
      silhouettePixelsAfter: res.silhouettePixelsAfter,
      meanChannelDiff: res.meanChannelDiff,
    });
  }

  assert.deepEqual(errors, []);
  fs.writeFileSync(join(VISUAL_OUT, 'visual-report.json'), JSON.stringify({ passed: true, report }, null, 2));
  console.log(JSON.stringify({ passed: true, report }, null, 2));
} finally {
  ws?.close();
  chrome.kill();
  vite.kill();
}
