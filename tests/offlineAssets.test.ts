import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { listMotions } from '../src/animation/core/MotionRegistry.ts';
import { validateManifest } from '../src/game/mapTileStore.ts';

const ROOT = resolve(import.meta.dirname, '..');

function assertValidGlb(filePath: string) {
  assert.ok(existsSync(filePath), `Missing local GLB asset: ${filePath}`);
  const stat = statSync(filePath);
  assert.ok(stat.size > 1024, `Expected non-empty GLB asset (${stat.size} bytes): ${filePath}`);
  const fd = readFileSync(filePath);
  const magic = fd.subarray(0, 4).toString('ascii');
  assert.equal(magic, 'glTF', `Invalid GLB magic header in ${filePath}`);
}

test('HTML and stylesheet contain no external font or runtime script CDNs', () => {
  const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('viewport-fit=cover'), 'Expected viewport-fit=cover for Android safe areas');
  assert.ok(!/<script[^>]+src=["']https?:\/\//i.test(indexHtml), 'Unexpected external runtime <script src>');
  assert.ok(!/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:\/\//i.test(indexHtml), 'Unexpected external <link rel="stylesheet">');

  const styleCss = readFileSync(join(ROOT, 'src/style.css'), 'utf8');
  assert.ok(!/@import\s+url\(\s*['"]?https?:\/\//i.test(styleCss), 'Found external CSS @import url(http...) in src/style.css');
});

test('all Shared Motion Library GLB clips exist locally in public/motions', () => {
  const motions = listMotions();
  assert.ok(motions.length >= 24, `Expected >=24 motion entries, found ${motions.length}`);
  for (const motion of motions) {
    assert.ok(motion.assetUrl.startsWith('/motions/'), `Expected local /motions/ URL, got ${motion.assetUrl}`);
    const localPath = join(ROOT, 'public', motion.assetUrl.slice(1));
    assertValidGlb(localPath);
  }
});

test('core character models and static media assets are bundled locally', () => {
  assertValidGlb(join(ROOT, 'src/assets/boy.glb'));
  assertValidGlb(join(ROOT, 'src/assets/girl.glb'));
  assertValidGlb(join(ROOT, 'public/models/canolia-character.glb'));
  assertValidGlb(join(ROOT, 'public/models/ghost-woman.glb'));

  const ghostMotions = ['depressed', 'freaky', 'flee_01', 'dig', 'laugh_01', 'flee_02', 'fall'];
  for (const clip of ghostMotions) {
    assertValidGlb(join(ROOT, 'public/motions/ghost', `${clip}.glb`));
  }

  const localImages = [
    'src/assets/kalay_sign_face.png',
    'src/assets/burmese_lion_emblem.png',
    'public/kalay_sign_face.png',
    'public/burmese_lion_emblem.png',
    'public/favicon.ico',
    'public/favicon.jpg',
    'public/favicon.png',
    'public/ogp.png',
    'public/app-icon.webp',
  ];
  for (const rel of localImages) {
    const abs = join(ROOT, rel);
    assert.ok(existsSync(abs), `Missing local image asset: ${rel}`);
    assert.ok(statSync(abs).size > 100, `Empty local image asset: ${rel}`);
  }
});

test('Android splash screens use branded PNG artwork and splash theme resources exist', () => {
  const splashDirs = [
    'drawable',
    'drawable-land-mdpi',
    'drawable-land-hdpi',
    'drawable-land-xhdpi',
    'drawable-land-xxhdpi',
    'drawable-land-xxxhdpi',
    'drawable-port-mdpi',
    'drawable-port-hdpi',
    'drawable-port-xhdpi',
    'drawable-port-xxhdpi',
    'drawable-port-xxxhdpi',
  ];
  for (const dir of splashDirs) {
    const splashPng = join(ROOT, 'android/app/src/main/res', dir, 'splash.png');
    assert.ok(existsSync(splashPng), `Missing Android splash image: ${splashPng}`);
    const hdr = readFileSync(splashPng);
    assert.equal(hdr.subarray(1, 4).toString('ascii'), 'PNG', `Invalid PNG signature in ${splashPng}`);
    // Branded emerald + icon splash is substantially richer than Capacitor's default ~4-17KB white cross
    assert.ok(hdr.byteLength > 25_000, `Unexpectedly tiny default splash PNG (${hdr.byteLength} bytes): ${splashPng}`);
  }

  for (const extraPng of ['drawable/splash_badge.png', 'drawable/splash_icon.png']) {
    const abs = join(ROOT, 'android/app/src/main/res', extraPng);
    assert.ok(existsSync(abs), `Missing splash badge asset: ${extraPng}`);
    assert.equal(readFileSync(abs).subarray(1, 4).toString('ascii'), 'PNG');
  }

  for (const xmlPath of [
    'android/app/src/main/res/drawable/splash_screen.xml',
    'android/app/src/main/res/values/colors.xml',
    'android/app/src/main/res/values-v31/styles.xml',
  ]) {
    assert.ok(existsSync(join(ROOT, xmlPath)), `Missing Android splash resource XML: ${xmlPath}`);
  }

  const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('src="/app-icon.webp"'), 'Web boot splash should render /app-icon.webp');
  assert.ok(!indexHtml.includes('className="boot-dots"'), 'index.html boot splash must use HTML class attribute');
});

test('Android launcher icons use WebP across all mipmap densities without legacy PNG duplicates', () => {
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  const names = ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground'];
  for (const density of densities) {
    for (const name of names) {
      const webpPath = join(ROOT, 'android/app/src/main/res', `mipmap-${density}`, `${name}.webp`);
      const pngPath = join(ROOT, 'android/app/src/main/res', `mipmap-${density}`, `${name}.png`);
      assert.ok(existsSync(webpPath), `Missing Android WebP launcher icon: ${webpPath}`);
      assert.ok(!existsSync(pngPath), `Duplicate legacy PNG launcher icon present: ${pngPath}`);
      const hdr = readFileSync(webpPath);
      assert.equal(hdr.subarray(0, 4).toString('ascii'), 'RIFF', `Invalid RIFF header in ${webpPath}`);
      assert.equal(hdr.subarray(8, 12).toString('ascii'), 'WEBP', `Invalid WEBP signature in ${webpPath}`);
    }
  }
});

test('local map tile dataset manifest and every tile payload exist under public/map', () => {
  const dataset = JSON.parse(readFileSync(join(ROOT, 'src/data/sitharFieldDataset.json'), 'utf8'));
  assert.ok(typeof dataset.manifest === 'string' && dataset.manifest.startsWith('/map/'));

  const manifestAbs = join(ROOT, 'public', dataset.manifest.slice(1));
  assert.ok(existsSync(manifestAbs), `Missing map manifest: ${manifestAbs}`);
  const manifest = validateManifest(JSON.parse(readFileSync(manifestAbs, 'utf8')));

  const manifestDir = join(manifestAbs, '..');
  for (const tile of manifest.tiles) {
    const tileAbs = join(manifestDir, tile.url);
    assert.ok(existsSync(tileAbs), `Missing map tile: ${tileAbs}`);
    const raw = readFileSync(tileAbs);
    assert.equal(raw.byteLength, tile.bytes, `Byte size mismatch for tile ${tile.url}`);
    const parsed = JSON.parse(raw.toString('utf8'));
    assert.equal(parsed.type, 'FeatureCollection');
    assert.equal(parsed.features.length, tile.featureCount);
  }
});

test('Capacitor and Android configuration enforce offline bundle and HTTPS security', () => {
  const capConfig = readFileSync(join(ROOT, 'capacitor.config.ts'), 'utf8');
  assert.ok(capConfig.includes("webDir: 'dist'"));
  assert.ok(capConfig.includes("androidScheme: 'https'"));
  assert.ok(capConfig.includes('cleartext: false'));
  assert.ok(capConfig.includes('allowMixedContent: false'));

  const manifest = readFileSync(join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.ok(manifest.includes('android.permission.INTERNET'));
  assert.ok(manifest.includes('android.permission.ACCESS_NETWORK_STATE'));
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));
  assert.ok(manifest.includes('android:hardwareAccelerated="true"'));
});
